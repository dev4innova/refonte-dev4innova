import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { authForm } from "@/components/auth/labels";
import { Section } from "@/components/layout/section";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { signIn } from "@/lib/auth/actions";

type Props = { params: Promise<{ locale: Locale }>; searchParams: Promise<{ returnTo?: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return { title: t("signIn.metaTitle"), robots: { index: false, follow: true } };
}

/** Sign-in with a built-in account (ADR-0019). */
export default async function SignInPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  return (
    <Section>
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-display-md font-semibold">{t("signIn.title")}</h1>
          <p className="text-muted-foreground">{t("signIn.intro")}</p>
        </div>
        <Suspense fallback={<div aria-hidden="true" className="h-72 animate-pulse rounded-xl bg-muted" />}>
          <SignInForm locale={locale} searchParams={searchParams} />
        </Suspense>
        <p className="text-sm text-muted-foreground">{t("signIn.forgot")}</p>
      </div>
    </Section>
  );
}

async function SignInForm({ locale, searchParams }: { locale: Locale; searchParams: Props["searchParams"] }) {
  const { returnTo = "" } = await searchParams;
  const [{ labels, fields }, t] = await Promise.all([authForm(locale, "signIn"), getTranslations({ locale, namespace: "Auth" })]);
  return (
    <AuthForm
      action={signIn.bind(null, locale, returnTo)}
      fields={fields}
      labels={labels}
      footer={
        <p className="text-sm">
          {t("signIn.noAccount")}{" "}
          <Link href={{ pathname: "/sign-up", query: returnTo ? { returnTo } : {} }} className="font-medium text-primary-ink underline-offset-4 hover:underline">
            {t("signIn.signUpLink")}
          </Link>
        </p>
      }
    />
  );
}
