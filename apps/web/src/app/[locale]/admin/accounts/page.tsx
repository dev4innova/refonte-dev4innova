import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminNotice } from "@/components/admin/admin-notice";
import { AuthForm } from "@/components/auth/auth-form";
import { authForm } from "@/components/auth/labels";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getStaffRole, requireSession } from "@/lib/admin";
import { resetPassword } from "@/lib/auth/actions";

type Props = { params: Promise<{ locale: Locale }> };

/** Accounts (ADR-0019): temporary password for someone who forgot theirs (staff admins). */
export default function AccountsPage({ params }: Props) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-64 animate-pulse rounded-xl bg-muted" />}>
      <Accounts params={params} />
    </Suspense>
  );
}

async function Accounts({ params }: Props) {
  const { locale } = await params;
  const session = await requireSession(getPathname({ locale, href: "/admin/accounts" }));
  if ((await getStaffRole(session.accessToken)) !== "staff_admin") return <AdminNotice locale={locale} kind="forbidden" />;
  const [t, { labels, fields }] = await Promise.all([getTranslations({ locale, namespace: "Auth" }), authForm(locale, "reset")]);
  return (
    <section aria-labelledby="accounts-reset" className="flex max-w-xl flex-col gap-4">
      <h1 id="accounts-reset" className="text-display-md font-semibold">
        {t("reset.title")}
      </h1>
      <p className="text-muted-foreground">{t("reset.intro")}</p>
      <AuthForm action={resetPassword} fields={fields} labels={labels} />
    </section>
  );
}
