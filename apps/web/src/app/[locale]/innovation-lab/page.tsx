import { Bot, Layers, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Section } from "@/components/layout/section";
import { CtaBand } from "@/components/marketing/cta-band";
import { PageHeader } from "@/components/marketing/page-header";
import { Steps } from "@/components/marketing/steps";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pageMetadata } from "@/i18n/metadata";
import type { Locale } from "@/i18n/routing";

type Props = { params: Promise<{ locale: Locale }> };

const TOPICS = [
  { key: "agents", icon: Bot },
  { key: "multimodal", icon: Layers },
  { key: "sovereign", icon: ShieldCheck },
] as const;
const PROGRAM = ["frame", "build", "test", "decide"] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "InnovationLab" });
  return pageMetadata({
    locale,
    href: "/innovation-lab",
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** Innovation Lab (TASK-052). */
export default async function InnovationLabPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, tCommon] = await Promise.all([
    getTranslations("InnovationLab"),
    getTranslations("Common"),
  ]);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />

      <Section variant="card" aria-labelledby="lab-explore">
        <h2 id="lab-explore" className="mb-10 text-display-md font-semibold">
          {t("explore.title")}
        </h2>
        <ul className="grid gap-6 md:grid-cols-3">
          {TOPICS.map(({ key, icon: Icon }) => (
            <li key={key} className="flex">
              <Card className="w-full">
                <CardHeader>
                  <Icon aria-hidden="true" className="size-8 text-primary-ink" />
                  <CardTitle>{t(`explore.${key}.title`)}</CardTitle>
                  <CardDescription>{t(`explore.${key}.text`)}</CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section aria-labelledby="lab-program">
        <div className="mb-10 flex max-w-2xl flex-col gap-4">
          <h2 id="lab-program" className="text-display-md font-semibold">
            {t("program.title")}
          </h2>
          <p className="text-lg text-muted-foreground">{t("program.lead")}</p>
        </div>
        <Steps
          steps={PROGRAM.map((step) => ({
            key: step,
            title: t(`program.${step}.title`),
            text: t(`program.${step}.text`),
          }))}
        />
      </Section>

      <CtaBand title={t("ctaTitle")} text={t("ctaText")} actionLabel={tCommon("contactUs")} />
    </>
  );
}
