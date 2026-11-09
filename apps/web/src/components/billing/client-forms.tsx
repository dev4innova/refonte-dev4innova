"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import {
  acceptQuote,
  declineQuote,
  payInvoice,
  type ProfileInput,
  saveProfile,
  setCancellation,
  subscribe,
} from "@/app/[locale]/account/portal/[org]/billing/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import type { Profile } from "@/lib/billing";
import type { BillingResult } from "@/lib/billing-actions";

import { useBillingAction } from "./use-billing-action";

/** Billing details of the organization, copied onto each invoice at issue. */
export function ProfileForm({ org, profile }: { org: string; profile: Profile | null }) {
  const t = useTranslations("Billing");
  const { pending, error, run } = useBillingAction();
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        const data = new FormData(event.currentTarget);
        const text = (key: string) => String(data.get(key) ?? "");
        const input: ProfileInput = {
          legalName: text("legal_name"),
          address: text("address"),
          postalCode: text("postal_code"),
          city: text("city"),
          country: text("country"),
          vatNumber: text("vat_number"),
          siren: text("siren"),
          email: text("email"),
        };
        run(() => saveProfile(org, input), () => setSaved(true));
      }}
    >
      <FormField label={t("profile.legalName")} required requiredLabel={t("required")}>
        <Input name="legal_name" required minLength={2} maxLength={200} defaultValue={profile?.legal_name} autoComplete="organization" />
      </FormField>
      <FormField label={t("profile.address")} required requiredLabel={t("required")}>
        <Input name="address" required minLength={3} maxLength={300} defaultValue={profile?.address} autoComplete="street-address" />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_7rem]">
        <FormField label={t("profile.postalCode")} required requiredLabel={t("required")}>
          <Input name="postal_code" required maxLength={20} defaultValue={profile?.postal_code} autoComplete="postal-code" />
        </FormField>
        <FormField label={t("profile.city")} required requiredLabel={t("required")}>
          <Input name="city" required maxLength={120} defaultValue={profile?.city} autoComplete="address-level2" />
        </FormField>
        <FormField label={t("profile.country")}>
          <Input name="country" maxLength={2} defaultValue={profile?.country ?? "FR"} autoComplete="country" />
        </FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={t("profile.vatNumber")}>
          <Input name="vat_number" maxLength={30} defaultValue={profile?.vat_number ?? ""} />
        </FormField>
        <FormField label={t("profile.siren")}>
          <Input name="siren" maxLength={17} inputMode="numeric" defaultValue={profile?.siren ?? ""} />
        </FormField>
      </div>
      <FormField label={t("profile.email")} required requiredLabel={t("required")}>
        <Input name="email" type="email" required maxLength={320} defaultValue={profile?.email} autoComplete="email" />
      </FormField>
      <div>
        <Button type="submit" variant="secondary" loading={pending}>{t("profile.save")}</Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      {saved && !error ? <p role="status" className="text-sm text-muted-foreground">{t("profile.saved")}</p> : null}
    </form>
  );
}

/** Online acceptance ("bon pour accord") or refusal of a quote (TASK-111). */
export function QuoteDecision({ org, quoteId, deposit }: { org: string; quoteId: string; deposit: number }) {
  const t = useTranslations("Billing.quote");
  const router = useRouter();
  const accept = useBillingAction();
  const decline = useBillingAction();
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        aria-labelledby="quote-accept"
        className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          accept.run(() => acceptQuote(org, quoteId, name), ({ invoiceId }) =>
            router.push({ pathname: "/account/portal/[org]/billing/invoices/[invoice]", params: { org, invoice: invoiceId } }),
          );
        }}
      >
        <h2 id="quote-accept" className="text-heading-sm font-semibold">{t("acceptTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("acceptText", { deposit: deposit > 0 && deposit < 100 ? String(deposit) : "none" })}</p>
        <FormField label={t("name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={200} autoComplete="name" />
        </FormField>
        <div className="flex items-start gap-2">
          <Checkbox id="quote-agree" checked={agreed} onCheckedChange={(value) => setAgreed(value === true)} required />
          <Label htmlFor="quote-agree" className="text-sm leading-snug">{t("agree")}</Label>
        </div>
        <div>
          <Button type="submit" loading={accept.pending} disabled={!agreed}>{t("accept")}</Button>
        </div>
        {accept.error ? <p role="alert" className="text-sm font-medium text-destructive">{accept.error}</p> : null}
      </form>
      <form
        aria-labelledby="quote-decline"
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (window.confirm(t("declineConfirm"))) decline.run(() => declineQuote(org, quoteId, reason));
        }}
      >
        <h2 id="quote-decline" className="text-heading-sm font-semibold">{t("declineTitle")}</h2>
        <FormField label={t("reason")}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} rows={3} />
        </FormField>
        <div>
          <Button type="submit" variant="outline" loading={decline.pending}>{t("decline")}</Button>
        </div>
        {decline.error ? <p role="alert" className="text-sm font-medium text-destructive">{decline.error}</p> : null}
      </form>
    </div>
  );
}

/** Sends the browser to a Checkout page opened by a Server Action. */
function useCheckout() {
  const t = useTranslations("Billing.errors");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function go(action: () => Promise<BillingResult<{ url: string }>>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(t(result.error));
        return;
      }
      window.location.assign(result.data.url);
    });
  }
  return { pending, error, go };
}

export function PayButton({ org, invoiceId, locale, label }: { org: string; invoiceId: string; locale: "fr" | "en"; label: string }) {
  const { pending, error, go } = useCheckout();
  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button size="lg" loading={pending} onClick={() => go(() => payInvoice(org, invoiceId, locale))}>{label}</Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

export function SubscribeButton({ org, productId, locale, label, name }: { org: string; productId: string; locale: "fr" | "en"; label: string; name: string }) {
  const { pending, error, go } = useCheckout();
  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" loading={pending} aria-label={name} onClick={() => go(() => subscribe(org, productId, locale))}>{label}</Button>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}

export function CancelSubscription({ org, id, cancelling }: { org: string; id: string; cancelling: boolean }) {
  const t = useTranslations("Billing.overview");
  const { pending, error, run } = useBillingAction();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant="ghost"
        loading={pending}
        onClick={() => {
          if (cancelling || window.confirm(t("cancelConfirm"))) run(() => setCancellation(org, id, !cancelling));
        }}
      >
        {cancelling ? t("resume") : t("cancel")}
      </Button>
      {error ? <span role="alert" className="text-xs font-medium text-destructive">{error}</span> : null}
    </span>
  );
}

export { useCheckout };
