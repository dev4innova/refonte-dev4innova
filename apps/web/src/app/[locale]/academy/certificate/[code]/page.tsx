import { BadgeCheck, Download, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getFormatter, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { duration, normalizeCode } from "@/lib/academy";
import { serverApi } from "@/lib/api";

type Props = { params: Promise<{ locale: Locale; code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Academy.certificate" });
  // Personal data: shared on purpose by its holder, never indexed.
  return { title: t("metaTitle"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/** Public verification of a certificate by its code (TASK-109). */
export default function CertificatePage({ params }: Props) {
  return (
    <Section>
      <Suspense fallback={<div aria-hidden="true" className="h-80 animate-pulse rounded-xl bg-muted" />}>
        <CertificateCheck params={params} />
      </Suspense>
    </Section>
  );
}

async function CertificateCheck({ params }: Props) {
  const { locale, code: raw } = await params;
  await connection();
  const [t, tAcademy, format] = await Promise.all([
    getTranslations({ locale, namespace: "Academy.certificate" }),
    getTranslations({ locale, namespace: "Academy" }),
    getFormatter({ locale }),
  ]);
  const code = normalizeCode(decodeURIComponent(raw));
  const certificate = code
    ? await serverApi()
        .GET("/api/v1/academy/certificates/{code}", { params: { path: { code }, query: { locale } } })
        .then((r) => r.data)
        .catch(() => undefined)
    : undefined;

  if (!certificate) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4 text-center">
        <h1 className="text-display-md font-semibold">{t("title")}</h1>
        <p role="alert" className="text-muted-foreground">{t("notFound")}</p>
      </div>
    );
  }
  const units = { hour: tAcademy("units.hour"), minute: tAcademy("units.minute") };
  const rows = [
    [t("learner"), certificate.learner_name],
    [t("course"), certificate.course_title],
    [t("date"), format.dateTime(new Date(certificate.issued_at), { dateStyle: "long" })],
    ...(certificate.duration_minutes ? [[t("duration"), duration(certificate.duration_minutes, units)]] : []),
    [t("code"), certificate.code],
  ];
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-display-md font-semibold">{t("title")}</h1>
      {certificate.valid ? (
        <p className="inline-flex items-center gap-2 font-semibold text-foreground">
          <BadgeCheck aria-hidden="true" className="size-6 text-primary-ink" />
          {t("valid")}
        </p>
      ) : (
        <p role="alert" className="inline-flex items-center gap-2 font-semibold text-destructive">
          <ShieldAlert aria-hidden="true" className="size-6" />
          {t("revoked")}
        </p>
      )}
      <dl className="grid gap-x-6 gap-y-3 rounded-xl border border-border bg-card p-6 sm:grid-cols-[12rem_minmax(0,1fr)]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="font-medium break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <a href={`/api/academy/certificates/${certificate.code}?locale=${locale}`}>
            <Download aria-hidden="true" />
            {t("download")}
          </a>
        </Button>
        {certificate.course_slug ? (
          <Button asChild variant="outline">
            <Link href={{ pathname: "/academy/[slug]", params: { slug: certificate.course_slug } }}>{t("seeCourse")}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
