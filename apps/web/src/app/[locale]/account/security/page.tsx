import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { authForm } from "@/components/auth/labels";
import { Section } from "@/components/layout/section";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { serverApi } from "@/lib/api";
import { changePassword } from "@/lib/auth/actions";
import { redirectToLogin } from "@/lib/auth/redirect";
import { getSession } from "@/lib/auth/session";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return { title: t("security.metaTitle"), robots: { index: false, follow: false } };
}

/** Password change (ADR-0019): the other sessions of the account are signed out. */
export default async function SecurityPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  return (
    <Section>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-display-md font-semibold">{t("security.title")}</h1>
          <p className="text-muted-foreground">{t("security.intro")}</p>
        </div>
        <Suspense fallback={<div aria-hidden="true" className="h-80 animate-pulse rounded-xl bg-muted" />}>
          <PasswordForm locale={locale} />
        </Suspense>
        <Link href="/account" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {t("security.back")}
        </Link>
      </div>
    </Section>
  );
}

async function PasswordForm({ locale }: { locale: Locale }) {
  const returnTo = getPathname({ locale, href: "/account/security" });
  const session = await getSession();
  if (!session) redirectToLogin(returnTo);
  const { data: me, response } = await serverApi(session.accessToken)
    .GET("/api/v1/me")
    .catch(() => ({ data: undefined, response: undefined }));
  if (response?.status === 401) redirectToLogin(returnTo);
  const { labels, fields } = await authForm(locale, "security");
  return <AuthForm action={changePassword.bind(null, me?.email ?? "")} fields={fields} labels={labels} />;
}
