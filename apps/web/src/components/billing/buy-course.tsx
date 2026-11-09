"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { buyCourse } from "@/app/[locale]/account/portal/[org]/billing/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { NativeSelect } from "@/components/ui/native-select";
import type { BillingOrganization } from "@/lib/billing";

import { useCheckout } from "./client-forms";

/** Buys a paid course through Stripe Checkout, billed to an organization or personally. */
export function BuyCourse({ slug, locale, organizations }: { slug: string; locale: "fr" | "en"; organizations: BillingOrganization[] }) {
  const t = useTranslations("Billing.course");
  const { pending, error, go } = useCheckout();
  const companies = organizations.filter((o) => !o.slug.startsWith("perso-"));
  const [organization, setOrganization] = useState("");
  return (
    <div className="flex flex-col gap-3">
      {companies.length > 0 ? (
        <FormField label={t("buyAs")}>
          <NativeSelect value={organization} onChange={(e) => setOrganization(e.target.value)}>
            <option value="">{t("personal")}</option>
            {companies.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </NativeSelect>
        </FormField>
      ) : null}
      <Button size="lg" loading={pending} onClick={() => go(() => buyCourse(slug, organization, locale))}>{t("buy")}</Button>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
