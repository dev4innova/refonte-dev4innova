import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContactForm } from "@/components/contact/contact-form";
import { Section } from "@/components/layout/section";
import { PageHeader } from "@/components/marketing/page-header";
import { pageMetadata } from "@/i18n/metadata";
import type { Locale } from "@/i18n/routing";
import { CONTACT_TOPICS } from "@/lib/contact/schema";

import { submitContact } from "./actions";

type Props = { params: Promise<{ locale: Locale }> };

const STEPS = ["a", "b", "c"] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Contact" });
  return pageMetadata({
    locale,
    href: "/contact",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** Contact page (TASK-055) with the contact form (TASK-057). */
export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Contact");

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <Section variant="card">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <ContactForm
            action={submitContact.bind(null, locale)}
            labels={{
              fields: {
                name: t("form.name"),
                email: t("form.email"),
                company: t("form.company"),
                topic: t("form.topic"),
                message: t("form.message"),
                consent: t("form.consent"),
              },
              messageHelp: t("form.messageHelp"),
              privacyLink: t("form.privacyLink"),
              required: t("form.required"),
              optional: t("form.optional"),
              submit: t("form.submit"),
              sending: t("form.sending"),
              honeypot: t("form.honeypot"),
              topics: Object.fromEntries(
                CONTACT_TOPICS.map((topic) => [topic, t(`topics.${topic}`)]),
              ) as Record<(typeof CONTACT_TOPICS)[number], string>,
              success: { title: t("success.title"), text: t("success.text") },
              errors: {
                summary: t("errors.summary"),
                name: t("errors.name"),
                email: t("errors.email"),
                company: t("errors.company"),
                message: t("errors.message"),
                consent: t("errors.consent"),
                rateLimited: t("errors.rateLimited"),
                unavailable: t("errors.unavailable"),
              },
            }}
          />
          <aside aria-labelledby="contact-next" className="flex flex-col gap-6">
            <h2 id="contact-next" className="text-heading-lg font-semibold">
              {t("asideTitle")}
            </h2>
            <ol className="flex flex-col gap-5">
              {STEPS.map((step, index) => (
                <li key={step} className="flex items-start gap-4">
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
                  >
                    {index + 1}
                  </span>
                  <span className="pt-1">{t(`asideSteps.${step}`)}</span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </Section>
    </>
  );
}
