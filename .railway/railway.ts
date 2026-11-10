/*
 * DEV4INNOVA production on Railway, as code (ADR-0018, docs/deployment/railway.md).
 *
 *   railway config plan    # preview the changes, nothing is modified
 *   railway config apply   # apply them (asks for confirmation)
 *
 * This file owns the whole project: services, databases, domains and every variable of
 * every service ("managed" variables: a variable missing here is removed on apply).
 * Secrets are never written here: they are declared with preserve(), which keeps the value
 * stored in Railway, and are entered once with `make railway-secrets`.
 *
 * Only edit SETTINGS below. Values still set to CHANGE_ME stop the plan with an error.
 */
import {
  database,
  defineRailway,
  github,
  group,
  preserve,
  project,
  redis,
  service,
} from "railway/iac";

const CHANGE_ME = "CHANGE_ME";

/** Non-secret production settings (versioned on purpose). */
const SETTINGS = {
  repository: "dev4innova/refonte-dev4innova",
  branch: "main",
  /**
   * Railway region EU West (Amsterdam, NL). Placement (multiRegionConfig) takes the
   * deployment region ID, "europe-west4-drams3a"; "europe-west4" is only its provider-region
   * label (see `railway scale`).
   */
  region: "europe-west4-drams3a",
  /** Public site https://www.<domain> and API https://api.<domain>. */
  domain: "dev4innova.com",
  /** Zitadel production instance (docs/architecture/authentication.md). */
  auth: {
    issuer: CHANGE_ME, // e.g. https://dev4innova-xxxxxx.zitadel.cloud
    projectId: CHANGE_ME, // audience of the access tokens
    webClientId: CHANGE_ME, // PKCE client of the web application
  },
  /** S3-compatible object storage in the EU (Scaleway fr-par by default). */
  storage: {
    endpoint: "https://s3.fr-par.scw.cloud",
    region: "fr-par",
    mediaBucket: CHANGE_ME, // public read: CMS media
    portalBucket: CHANGE_ME, // private: client portal files
    backupBucket: CHANGE_ME, // private and versioned: database dumps
  },
  /** Seller details printed on every invoice (public legal information). */
  seller: {
    name: "DEV4INNOVA",
    legalForm: CHANGE_ME, // e.g. SAS au capital de 1 000 €
    address: CHANGE_ME,
    siren: CHANGE_ME,
    vatNumber: CHANGE_ME,
    email: CHANGE_ME,
  },
  schedules: {
    /** Database dump to S3 (UTC). */
    backup: "43 1 * * *",
    /** Purges of inactive AI sessions and never-unlocked diagnostics (UTC). */
    daily: "17 2 * * *",
  },
};

/** Fails the plan while a setting has not been filled in. */
function assertConfigured(value: unknown, path = "SETTINGS"): void {
  if (value === CHANGE_ME) throw new Error(`${path} is still CHANGE_ME in .railway/railway.ts`);
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) assertConfigured(child, `${path}.${key}`);
  }
}

export default defineRailway(() => {
  assertConfigured(SETTINGS);
  const { region, domain, auth, storage, seller, schedules } = SETTINGS;
  const siteUrl = `https://www.${domain}`;
  const apiUrl = `https://api.${domain}`;

  // Deployed from main once every CI check is green ("Wait for CI").
  const source = github(SETTINGS.repository, { branch: SETTINGS.branch, checkSuites: true });
  const oneReplica = { [region]: 1 };

  // PostgreSQL 17, like CI, Docker Compose and the backup image (pg_dump must not be older
  // than the server). Railway's postgres() helper would pick the latest major version.
  const postgres = database("postgres", "postgres", {
    image: "ghcr.io/railwayapp-templates/postgres-ssl:17",
    output: "DATABASE_URL",
    defaultMountPath: "/var/lib/postgresql/data",
    region,
  });
  const cache = redis("redis", { region });
  // Private network only: the services reach both databases on *.railway.internal. Railway
  // opens a public TCP proxy when it creates PostgreSQL; a null entry removes it (on the
  // next apply after a creation) and is a no-op when no proxy exists.
  postgres.networking = { tcpProxies: { "5432": null } };
  cache.networking = { tcpProxies: { "6379": null } };

  /** Settings read by the API and by the scheduled jobs (same image, same guard). */
  const apiSettings = {
    APP_ENV: "production",
    LOG_LEVEL: "INFO",
    DATABASE_URL: postgres.env.DATABASE_URL, // postgresql://…, the API adds the asyncpg driver
    REDIS_URL: cache.env.REDIS_URL,
    SITE_URL: siteUrl,
    API_PUBLIC_URL: apiUrl,
    CORS_ALLOWED_ORIGINS: JSON.stringify([siteUrl]),
    AUTH_ISSUER: auth.issuer,
    AUTH_AUDIENCE: auth.projectId,
  };

  const api = service("api", {
    source,
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "infra/docker/api.Dockerfile",
      watchPatterns: ["apps/api/**", "infra/docker/api.Dockerfile"],
    },
    // Migrations run before the new version takes traffic; on failure nothing switches.
    preDeploy: "alembic upgrade head",
    healthcheck: "/api/v1/health/ready",
    healthcheckTimeout: 120,
    deploy: {
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
      // Zero downtime: both versions overlap, then the old one finishes its requests.
      overlapSeconds: 30,
      drainingSeconds: 30,
    },
    replicas: oneReplica,
    // Public for the Stripe webhooks; the web app uses the private network.
    domains: [{ domain: `api.${domain}`, port: 8000 }],
    env: {
      ...apiSettings,
      PORT: "8000",
      // Only the web app and Railway's proxy reach the API.
      TRUST_FORWARDED_FOR: "true",
      MEDIA_S3_ENDPOINT_URL: storage.endpoint,
      MEDIA_S3_REGION: storage.region,
      MEDIA_S3_BUCKET: storage.mediaBucket,
      MEDIA_PUBLIC_BASE_URL: `https://${storage.mediaBucket}.${new URL(storage.endpoint).host}`,
      PORTAL_S3_BUCKET: storage.portalBucket,
      BILLING_SELLER_NAME: seller.name,
      BILLING_SELLER_LEGAL_FORM: seller.legalForm,
      BILLING_SELLER_ADDRESS: seller.address,
      BILLING_SELLER_SIREN: seller.siren,
      BILLING_SELLER_VAT_NUMBER: seller.vatNumber,
      BILLING_SELLER_EMAIL: seller.email,
      // Secrets: entered with `make railway-secrets`, never in this file.
      MEDIA_S3_ACCESS_KEY_ID: preserve(),
      MEDIA_S3_SECRET_ACCESS_KEY: preserve(),
      ANTHROPIC_API_KEY: preserve(),
      OPENAI_API_KEY: preserve(),
      GEMINI_API_KEY: preserve(),
      STRIPE_SECRET_KEY: preserve(),
      STRIPE_WEBHOOK_SECRET: preserve(),
      BILLING_SELLER_IBAN: preserve(),
      BILLING_SELLER_BIC: preserve(),
      SENTRY_DSN: preserve(),
    },
  });

  const web = service("web", {
    source,
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "infra/docker/web.Dockerfile",
      watchPatterns: ["apps/web/**", "packages/**", "pnpm-lock.yaml", "infra/docker/web.Dockerfile"],
    },
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    deploy: {
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
      overlapSeconds: 30,
      drainingSeconds: 30,
    },
    replicas: oneReplica,
    domains: [{ domain: `www.${domain}`, port: 3000 }],
    env: {
      PORT: "3000",
      // Private network (IPv6): the API listens on "::".
      API_URL: "http://${{api.RAILWAY_PRIVATE_DOMAIN}}:8000",
      // Also a Docker build argument: Railway passes service variables to the build.
      SITE_URL: siteUrl,
      ALLOW_INDEXING: "true",
      AUTH_ISSUER: auth.issuer,
      AUTH_PROJECT_ID: auth.projectId,
      AUTH_CLIENT_ID: auth.webClientId,
      SENTRY_ENVIRONMENT: "production",
      AUTH_SESSION_SECRET: preserve(),
      SENTRY_DSN: preserve(),
      // Same DSN for the browser, read at build time.
      NEXT_PUBLIC_SENTRY_DSN: "${{SENTRY_DSN}}",
    },
  });

  const jobs = service("jobs", {
    source,
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "infra/docker/api.Dockerfile",
      watchPatterns: ["apps/api/**", "infra/docker/api.Dockerfile"],
    },
    start: "python -m app.cli daily",
    deploy: { cronSchedule: schedules.daily, restartPolicyType: "NEVER" },
    replicas: oneReplica,
    env: { ...apiSettings, SENTRY_DSN: api.env.SENTRY_DSN },
  });

  const backup = service("backup", {
    source,
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "infra/docker/backup.Dockerfile",
      watchPatterns: ["infra/backup/**", "infra/docker/backup.Dockerfile"],
    },
    deploy: { cronSchedule: schedules.backup, restartPolicyType: "NEVER" },
    replicas: oneReplica,
    env: {
      DATABASE_URL: postgres.env.DATABASE_URL,
      BACKUP_S3_BUCKET: storage.backupBucket,
      BACKUP_S3_ENDPOINT_URL: storage.endpoint,
      BACKUP_RETENTION_DAYS: "30",
      AWS_DEFAULT_REGION: storage.region,
      // Dedicated key, allowed on the backup bucket only.
      AWS_ACCESS_KEY_ID: preserve(),
      AWS_SECRET_ACCESS_KEY: preserve(),
    },
  });

  return project("dev4innova", {
    resources: [
      group("Application", [web, api]),
      group("Data", [postgres, cache]),
      group("Scheduled jobs", [jobs, backup]),
    ],
  });
});
