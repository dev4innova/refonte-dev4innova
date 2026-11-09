"use client";

import { Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { type QuoteInput, saveQuote } from "@/app/[locale]/admin/billing/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { type BillingOrganization, centsToInput, lineTotals, money, parseEuros, parseRate, type Product, type Quote } from "@/lib/billing";

import { useBillingAdminAction } from "./use-billing-admin-action";

type Row = { key: number; productId: string; description: string; quantity: string; price: string; vat: string };

function pick(value: Record<string, string | undefined>, locale: string): string {
  return value[locale] || value.fr || "";
}

/** Writes a draft quote: client, terms, lines from the catalog or free (TASK-111). */
export function QuoteEditor({ organizations, products, quote }: { organizations?: BillingOrganization[]; products: Product[]; quote?: Quote }) {
  const t = useTranslations("Admin.billing.quotes");
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const { pending, error, run } = useBillingAdminAction();
  const [saved, setSaved] = useState(false);
  // 30 days from now, computed once (not during each render).
  const [defaultValidity] = useState(() => new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>(
    quote
      ? quote.lines.map((l, i) => ({
          key: i,
          productId: l.product_id ?? "",
          description: l.description,
          quantity: String(Number(l.quantity)).replace(".", locale === "fr" ? "," : "."),
          price: centsToInput(l.unit_price_cents, locale),
          vat: String(l.vat_rate_bp / 100).replace(".", locale === "fr" ? "," : "."),
        }))
      : [{ key: 0, productId: "", description: "", quantity: "1", price: "", vat: "20" }],
  );
  const services = products.filter((p) => p.kind !== "course" || p.active);
  const parsed = rows.map((r) => ({
    quantity: Number(r.quantity.replace(",", ".")) || 0,
    unitPriceCents: parseEuros(r.price) ?? 0,
    vatRateBp: parseRate(r.vat) ?? 0,
  }));
  const totals = lineTotals(parsed);

  function update(key: number, patch: Partial<Row>) {
    setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function choose(key: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    update(key, product ? {
      productId,
      description: pick(product.name, locale),
      price: centsToInput(product.unit_price_cents, locale),
      vat: String(product.vat_rate_bp / 100).replace(".", locale === "fr" ? "," : "."),
    } : { productId: "" });
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        const data = new FormData(event.currentTarget);
        const text = (key: string) => String(data.get(key) ?? "");
        const input: QuoteInput = {
          organizationId: text("organization_id"),
          title: text("title"),
          notes: text("notes"),
          validUntil: text("valid_until"),
          depositPercent: Number(text("deposit") || 0),
          lines: rows.map((r, i) => ({
            productId: r.productId,
            description: r.description,
            quantity: r.quantity,
            unitPriceCents: parsed[i]!.unitPriceCents,
            vatRateBp: parsed[i]!.vatRateBp,
          })),
        };
        run(() => saveQuote(quote?.id ?? null, input), ({ id: saved_id }) => {
          if (quote) setSaved(true);
          else router.push({ pathname: "/admin/billing/quotes/[id]", params: { id: saved_id } });
        });
      }}
    >
      {organizations ? (
        <FormField label={t("organization")} required requiredLabel="*">
          <NativeSelect name="organization_id" required defaultValue="">
            <option value="" disabled>{t("choose")}</option>
            {organizations.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.slug})</option>)}
          </NativeSelect>
        </FormField>
      ) : null}
      <FormField label={t("titleField")} required requiredLabel="*">
        <Input name="title" required minLength={2} maxLength={200} defaultValue={quote?.title} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("validUntil")} required requiredLabel="*">
          <Input name="valid_until" type="date" required defaultValue={quote?.valid_until ?? defaultValidity} />
        </FormField>
        <FormField label={t("deposit")}>
          <Input name="deposit" type="number" min={0} max={100} defaultValue={quote?.deposit_percent ?? 30} />
        </FormField>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-heading-sm font-semibold">{t("lines")}</legend>
        {rows.map((row, index) => (
          <div key={row.key} className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[12rem_minmax(0,1fr)_6rem_9rem_6rem_auto] md:items-end">
            <FormField label={t("product")}>
              <NativeSelect size="sm" value={row.productId} onChange={(e) => choose(row.key, e.target.value)}>
                <option value="">{t("freeLine")}</option>
                {services.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
              </NativeSelect>
            </FormField>
            <FormField label={t("description")}>
              <Input value={row.description} onChange={(e) => update(row.key, { description: e.target.value })} required minLength={2} maxLength={500} />
            </FormField>
            <FormField label={t("quantity")}>
              <Input value={row.quantity} onChange={(e) => update(row.key, { quantity: e.target.value })} inputMode="decimal" required />
            </FormField>
            <FormField label={t("unitPrice")}>
              <Input value={row.price} onChange={(e) => update(row.key, { price: e.target.value })} inputMode="decimal" required aria-invalid={parseEuros(row.price) === undefined || undefined} />
            </FormField>
            <FormField label={t("vat")}>
              <Input value={row.vat} onChange={(e) => update(row.key, { vat: e.target.value })} inputMode="decimal" required aria-invalid={parseRate(row.vat) === undefined || undefined} />
            </FormField>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("removeLine", { number: index + 1 })}
              disabled={rows.length === 1}
              onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ))}
        <div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setRows([...rows, { key: Math.max(...rows.map((r) => r.key)) + 1, productId: "", description: "", quantity: "1", price: "", vat: "20" }])}
          >
            <Plus aria-hidden="true" />
            {t("addLine")}
          </Button>
        </div>
        <p id={`${id}-totals`} aria-live="polite" className="text-sm font-medium">
          {t("totals", { net: money(totals.net, locale), vat: money(totals.vat, locale), gross: money(totals.gross, locale) })}
        </p>
      </fieldset>
      <FormField label={t("notes")}>
        <Textarea name="notes" maxLength={5000} rows={3} defaultValue={quote?.notes} />
      </FormField>
      <div>
        <Button type="submit" loading={pending}>{quote ? t("save") : t("create")}</Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      {saved && !error ? <p role="status" className="text-sm text-muted-foreground">{t("saved")}</p> : null}
    </form>
  );
}
