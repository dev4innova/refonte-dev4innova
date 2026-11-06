import { Building2, LogOut } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { serverApi } from "@/lib/api";
import { redirectToLogin } from "@/lib/auth/redirect";
import { getSession } from "@/lib/auth/session";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account" });
  // Private page: never indexed.
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/** Client area (TASK-044): the static shell is prerendered, the user's data is streamed. */
export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Account");

  return (
    <Section>
      <h1 className="text-display-md font-semibold">{t("title")}</h1>
      <Suspense fallback={<p className="mt-6 text-muted-foreground">{t("loading")}</p>}>
        <AccountDetails locale={locale} />
      </Suspense>
    </Section>
  );
}

async function AccountDetails({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "Account" });
  const accountPath = getPathname({ locale, href: "/account" });

  // Authoritative check (the proxy only looks for the cookie).
  const session = await getSession();
  if (!session) redirectToLogin(accountPath);

  let me;
  try {
    const { data, response } = await serverApi(session.accessToken).GET("/api/v1/me");
    if (response.status === 401) redirectToLogin(accountPath);
    me = data;
  } catch (error) {
    if (isRedirect(error)) throw error;
    me = undefined;
  }

  if (!me) {
    return (
      <p role="alert" className="mt-6 text-destructive">
        {t("error")}
      </p>
    );
  }

  return (
    <div className="mt-8 flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <p className="text-lg font-medium">{me.display_name ?? me.email}</p>
        {me.display_name && me.email ? <p className="text-muted-foreground">{me.email}</p> : null}
      </div>

      <section aria-labelledby="account-organizations" className="flex flex-col gap-4">
        <h2 id="account-organizations" className="text-heading-lg font-semibold">
          {t("organizations")}
        </h2>
        {me.memberships.length === 0 ? (
          <p className="text-muted-foreground">{t("noOrganization")}</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {me.memberships.map((membership) => (
              <li key={membership.organization_id}>
                <Card>
                  <CardHeader>
                    <CardTitle as="h3" className="flex items-center gap-2">
                      <Building2 aria-hidden="true" className="size-5 text-primary" />
                      {membership.organization_name}
                    </CardTitle>
                    <CardDescription>
                      {t("role", { role: t(`roles.${membership.role}`) })}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action="/api/auth/logout" method="post">
        <Button type="submit" variant="outline">
          <LogOut aria-hidden="true" />
          {t("signOut")}
        </Button>
      </form>
    </div>
  );
}

function isRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}
