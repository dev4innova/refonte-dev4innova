import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { authForm } from "@/components/auth/labels";
import { Section } from "@/components/layout/section";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { signUp } from "@/lib/auth/actions";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ returnTo?: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return { title: t("signUp.metaTitle"), robots: { index: false, follow: true } };
}

/** Account creation (ADR-0019): open to everyone, like the Academy's free courses. */
export default async function SignUpPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  return (
    <Section>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-display-md font-semibold">{t("signUp.title")}</h1>
          <p className="text-muted-foreground">{t("signUp.intro")}</p>
        </div>
        <Suspense fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-xl bg-muted" />}>
          <SignUpForm locale={locale} searchParams={searchParams} />
        </Suspense>
        <p className="text-sm text-muted-foreground">
          <Link href="/privacy" className="underline-offset-4 hover:underline">
            {t("signUp.privacy")}
          </Link>
        </p>
      </div>
    </Section>
  );
}

async function SignUpForm({ locale, searchParams }: { locale: Locale; searchParams: Props["searchParams"] }) {
  const { returnTo = "" } = await searchParams;
  const [{ labels, fields }, t] = await Promise.all([authForm(locale, "signUp"), getTranslations({ locale, namespace: "Auth" })]);
  return (
    <AuthForm
      action={signUp.bind(null, locale, returnTo)}
      fields={fields}
      labels={labels}
      footer={
        <p className="text-sm">
          {t("signUp.hasAccount")}{" "}
          <Link href={{ pathname: "/sign-in", query: returnTo ? { returnTo } : {} }} className="font-medium text-primary-ink underline-offset-4 hover:underline">
            {t("signUp.signInLink")}
          </Link>
        </p>
      }
    />
  );
}
