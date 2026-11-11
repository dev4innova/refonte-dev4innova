#!/usr/bin/env node
/*
 * Screenshots of the products built by DEV4INNOVA, for the homepage ("Our work",
 * doc 05 § 2 of docs/refonte-creative-tech-studio). Reproducible: same demo data, same
 * framing, every time.
 *
 * 1. Creates (or reuses) demonstration data through the API: a client account
 *    "Camille Démo", its organization "Démo SA", a portal project with tasks and a
 *    deliverable, a published Academy course followed to the certificate, and an AI
 *    diagnostic. Nothing is real client data.
 * 2. Captures four screens in French and English at 1440 × 900, device scale 2.
 * 3. Writes WebP files (1600 px wide) to apps/web/public/captures/, encoded by Chromium
 *    itself (no image library needed).
 *
 * LOCAL ONLY: it creates accounts and content. It refuses any host other than localhost.
 *
 * Prerequisites: the API and the web app running locally (make services, make api-dev,
 * then the web app, e.g. pnpm --filter @dev4innova/web start), the object storage of the
 * portal (MinIO from make services; without it the deliverable is skipped), and a staff
 * account:
 *   sign up on the website, then  make grant-staff email=... role=staff_admin
 *
 * Usage (from apps/web):
 *   CAPTURE_STAFF_EMAIL=... CAPTURE_STAFF_PASSWORD=... node scripts/capture-products.mjs
 * Optional: CAPTURE_API_URL (http://localhost:8000), CAPTURE_WEB_URL (http://localhost:3000).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

const API = process.env.CAPTURE_API_URL ?? "http://localhost:8000";
const WEB = process.env.CAPTURE_WEB_URL ?? "http://localhost:3000";
const OUT = path.resolve(import.meta.dirname, "../public/captures");
const LOCALES = ["fr", "en"];
const VIEWPORT = { width: 1440, height: 900 };

const CLIENT = {
  email: "camille.demo@demo.dev4innova.com",
  password: "Demo-capture-2026!",
  display_name: "Camille Démo",
};
const ORGANIZATION = { name: "Démo SA", slug: "demo-sa" };
const COURSE_SLUG = "demo-ia-au-quotidien";

for (const url of [API, WEB]) {
  const { hostname } = new URL(url);
  if (!["localhost", "127.0.0.1"].includes(hostname)) {
    throw new Error(`Refusing ${url}: this script creates demo data and only runs locally.`);
  }
}
const staffEmail = process.env.CAPTURE_STAFF_EMAIL;
const staffPassword = process.env.CAPTURE_STAFF_PASSWORD;
if (!staffEmail || !staffPassword) {
  throw new Error("Set CAPTURE_STAFF_EMAIL and CAPTURE_STAFF_PASSWORD (a staff_admin account).");
}

/* ---- API helpers --------------------------------------------------------------- */

async function api(method, route, { token, json, form } = {}) {
  const response = await fetch(`${API}${route}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(json ? { "Content-Type": "application/json" } : {}),
    },
    body: json ? JSON.stringify(json) : form,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { status: response.status, data };
}

async function ok(method, route, options) {
  const { status, data } = await api(method, route, options);
  if (status >= 400) throw new Error(`${method} ${route} → ${status} ${JSON.stringify(data)}`);
  return data;
}

async function signIn(email, password) {
  return (await ok("POST", "/api/v1/auth/sign-in", { json: { email, password } })).token;
}

const both = (fr, en) => ({ fr, en });

/* ---- Demo data ------------------------------------------------------------------ */

async function clientToken() {
  const created = await api("POST", "/api/v1/auth/sign-up", { json: { ...CLIENT, locale: "fr" } });
  if (created.status < 400) return created.data.token;
  return signIn(CLIENT.email, CLIENT.password);
}

async function organization(token) {
  const mine = await ok("GET", "/api/v1/organizations", { token });
  const existing = mine.find((org) => org.slug === ORGANIZATION.slug);
  if (existing) return existing.id;
  return (await ok("POST", "/api/v1/organizations", { token, json: ORGANIZATION })).id;
}

async function project(staff, organizationId) {
  const { items } = await ok("GET", `/api/v1/admin/portal/projects?organization_id=${organizationId}`, {
    token: staff,
  });
  const found = items.find((p) => p.organization.id === organizationId);
  if (found) return found.id;

  const created = await ok("POST", "/api/v1/admin/portal/projects", {
    token: staff,
    json: {
      organization_id: organizationId,
      name: "Assistant du service client",
      description:
        "Assistant conversationnel branché sur la base de connaissances et le CRM (projet de démonstration).",
      status: "in_progress",
      start_date: "2026-09-07",
      due_date: "2026-12-18",
    },
  });
  for (const [title, status] of [
    ["Atelier de cadrage et cas d'usage", "done"],
    ["Prototype de l'assistant", "done"],
    ["Intégration au CRM", "in_progress"],
    ["Recette avec les conseillers", "client_review"],
    ["Formation des équipes", "todo"],
  ]) {
    await ok("POST", `/api/v1/admin/portal/projects/${created.id}/tasks`, {
      token: staff,
      json: { title, status },
    });
  }
  const form = new FormData();
  form.set("title", "Spécifications de l'intégration CRM");
  form.set("description", "Version 1, à valider avant le développement.");
  form.set(
    "file",
    new Blob(["Specifications (demonstration document).\n"], { type: "text/plain" }),
    "specifications.txt",
  );
  // Needs the object storage (MinIO in local development): skipped with a warning without it.
  const deliverable = await api("POST", `/api/v1/admin/portal/projects/${created.id}/deliverables`, {
    token: staff,
    form,
  });
  if (deliverable.status >= 400) {
    console.warn(`  (deliverable skipped: ${deliverable.status}, is the object storage running?)`);
  }
  return created.id;
}

async function course(staff) {
  const courses = await ok("GET", "/api/v1/admin/academy/courses", { token: staff });
  const existing = courses.find((c) => c.slug === COURSE_SLUG);
  if (existing?.status === "published") return existing.id;
  // A draft left by an interrupted run: start again from a clean course.
  if (existing) await ok("DELETE", `/api/v1/admin/academy/courses/${existing.id}`, { token: staff });

  const created = await ok("POST", "/api/v1/admin/academy/courses", {
    token: staff,
    json: {
      slug: COURSE_SLUG,
      visibility: "public",
      level: "beginner",
      duration_minutes: 45,
      title: both("L'IA générative au quotidien", "Generative AI in everyday work"),
      summary: both(
        "Comprendre, utiliser et encadrer les assistants IA dans votre travail (formation de démonstration).",
        "Understand, use and frame AI assistants in your work (demonstration course).",
      ),
      description_md: both(
        "Une formation courte pour adopter l'IA générative en confiance.",
        "A short course to adopt generative AI with confidence.",
      ),
    },
  });
  const withModule = await ok("POST", `/api/v1/admin/academy/courses/${created.id}/modules`, {
    token: staff,
    json: {
      title: both("Bien rédiger ses demandes", "Writing good prompts"),
      summary: both("Contexte, consigne et format attendu.", "Context, instruction and expected format."),
    },
  });
  const firstModule = withModule.outline.at(-1);
  for (const [fr, en] of [
    ["Ce qu'un assistant IA sait faire", "What an AI assistant can do"],
    ["Donner du contexte et vérifier", "Giving context and checking"],
  ]) {
    await ok("POST", `/api/v1/admin/academy/modules/${firstModule.id}/lessons`, {
      token: staff,
      json: {
        title: both(fr, en),
        body_md: both(`## ${fr}\n\nContenu de démonstration.`, `## ${en}\n\nDemonstration content.`),
        duration_minutes: 10,
      },
    });
  }
  await ok("POST", `/api/v1/admin/academy/modules/${firstModule.id}/questions`, {
    token: staff,
    json: {
      prompt: both(
        "Que faire d'une réponse générée par l'IA avant de l'envoyer ?",
        "What should you do with an AI answer before sending it?",
      ),
      options: [
        both("La relire et la vérifier", "Review and check it"),
        both("L'envoyer telle quelle", "Send it as is"),
      ],
      correct_option: 0,
      explanation: both("Une personne reste responsable du contenu.", "A person stays responsible for the content."),
    },
  });
  await ok("POST", `/api/v1/admin/academy/courses/${created.id}/publish`, { token: staff });
  return created.id;
}

async function certificate(client) {
  await api("POST", `/api/v1/academy/courses/${COURSE_SLUG}/enroll`, { token: client });
  const mine = await ok("GET", `/api/v1/me/academy/courses/${COURSE_SLUG}`, { token: client });
  if (mine.certificate_code) return mine;
  for (const courseModule of mine.outline) {
    for (const lesson of courseModule.lessons ?? []) {
      await ok("POST", `/api/v1/me/academy/lessons/${lesson.id}/complete`, { token: client });
    }
    const quiz = await api("GET", `/api/v1/me/academy/quizzes/${courseModule.id}`, { token: client });
    if (quiz.status === 200 && quiz.data.questions?.length) {
      const answers = Object.fromEntries(quiz.data.questions.map((q) => [q.id, 0]));
      await ok("POST", `/api/v1/me/academy/quizzes/${courseModule.id}`, { token: client, json: { answers } });
    }
  }
  return ok("GET", `/api/v1/me/academy/courses/${COURSE_SLUG}`, { token: client });
}

async function diagnostic(locale) {
  const questionnaire = await ok("GET", `/api/v1/diagnostic/questionnaire?locale=${locale}`);
  // A credible, mixed profile: stronger on strategy and technology than on data.
  const levels = { strategy: 3, data: 1, technology: 2, skills: 1, governance: 2 };
  const answers = {};
  for (const dimension of questionnaire.dimensions) {
    for (const [index, question] of dimension.questions.entries()) {
      const level = Math.max(0, Math.min(3, (levels[dimension.id] ?? 1) + (index % 2 ? -1 : 0)));
      answers[question.id] = question.options[level].id;
    }
  }
  const { token } = await ok("POST", "/api/v1/diagnostic", { json: { locale, answers } });
  // Unlocked, as a visitor who left an email: the full report is shown.
  await ok("POST", `/api/v1/diagnostic/unlock?token=${encodeURIComponent(token)}`, {
    json: { name: CLIENT.display_name, email: CLIENT.email, company: ORGANIZATION.name, consent: true },
  });
  return token;
}

/* ---- Screenshots ---------------------------------------------------------------- */

const PATHS = {
  fr: {
    diagnostic: (token) => `/fr/diagnostic-ia/resultat/${token}`,
    ai: (org) => `/fr/espace-client/ia/${org}`,
    portal: (org, project) => `/fr/espace-client/portail/${org}/projets/${project}`,
    certificate: (code) => `/fr/academy/certificat/${code}`,
  },
  en: {
    diagnostic: (token) => `/en/ai-diagnostic/result/${token}`,
    ai: (org) => `/en/account/ai/${org}`,
    portal: (org, project) => `/en/account/portal/${org}/projects/${project}`,
    certificate: (code) => `/en/academy/certificate/${code}`,
  },
};

/** Resizes a PNG to 1600 px wide and encodes it as WebP, in the browser. */
async function toWebp(page, png) {
  const dataUrl = await page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = Math.round((image.height * 1600) / image.width);
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.8);
  }, `data:image/png;base64,${png.toString("base64")}`);
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

async function shoot(browser, token, locale, route, file) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    // Native controls (file input) are labelled in the language of the screenshot.
    locale: locale === "fr" ? "fr-FR" : "en-US",
  });
  await context.addCookies([{ name: "d4i_session", value: token, url: WEB, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  await page.goto(`${WEB}${route}`, { waitUntil: "networkidle" });
  // The site chrome (header, footer) is not part of the product.
  await page.addStyleTag({
    content: '[data-slot="site-header"],[data-slot="site-footer"]{display:none!important}',
  });
  await page.waitForTimeout(400);
  const png = await page.screenshot({ clip: { x: 0, y: 0, ...VIEWPORT } });
  await writeFile(path.join(OUT, file), await toWebp(page, png));
  await context.close();
  console.log(`  ${file}  ← ${route}`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const staff = await signIn(staffEmail, staffPassword);
  const client = await clientToken();
  const org = await organization(client);
  const projectId = await project(staff, org);
  await course(staff);
  const learner = await certificate(client);
  if (!learner.certificate_code) throw new Error("The demo course did not issue a certificate.");

  // Same override as playwright.config.ts (a preinstalled Chromium).
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  for (const locale of LOCALES) {
    // One browser per language: native controls (file input) follow the browser language.
    const browser = await chromium.launch({
      ...(executablePath ? { executablePath } : {}),
      args: [`--lang=${locale === "fr" ? "fr-FR" : "en-US"}`],
    });
    try {
      const token = await diagnostic(locale);
      const paths = PATHS[locale];
      await shoot(browser, client, locale, paths.diagnostic(token), `diagnostic-${locale}.webp`);
      await shoot(browser, client, locale, paths.ai(org), `ai-tools-${locale}.webp`);
      await shoot(browser, client, locale, paths.portal(org, projectId), `portal-${locale}.webp`);
      await shoot(browser, client, locale, paths.certificate(learner.certificate_code), `academy-${locale}.webp`);
    } finally {
      await browser.close();
    }
  }
}

await main();
