"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { type ProductInput, saveProduct } from "@/app/[locale]/admin/billing/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { centsToInput, INTERVALS, type Interval, parseEuros, parseRate, PRODUCT_KINDS, type Product, type ProductKind } from "@/lib/billing";

import { useBillingAdminAction } from "./use-billing-admin-action";

/** Adds a product to the catalog, or edits one (TASK-110). */
export function ProductForm({ product, courses }: { product?: Product; courses: { id: string; title: string }[] }) {
  const t = useTranslations("Admin.billing.products");
  const tBilling = useTranslations("Billing");
  const locale = useLocale();
  const { pending, error, run } = useBillingAdminAction();
  const [kind, setKind] = useState<ProductKind>((product?.kind as ProductKind) ?? "service");
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        const data = new FormData(event.currentTarget);
        const text = (key: string) => String(data.get(key) ?? "").trim();
        const price = parseEuros(text("price"));
        const vat = parseRate(text("vat"));
        if (price === undefined || price === null || vat === undefined) {
          run(async () => ({ ok: false as const, error: "validation" }));
          return;
        }
        const input: ProductInput = {
          code: text("code"),
          kind,
          name: { fr: text("name_fr"), en: text("name_en") },
          description: { fr: text("description_fr"), en: text("description_en") },
          unitPriceCents: price,
          vatRateBp: vat,
          interval: (text("interval") || null) as Interval | null,
          courseId: text("course_id"),
          active: data.get("active") === "on",
        };
        run(() => saveProduct(product?.id ?? null, input), () => {
          setSaved(true);
          if (!product) (event.target as HTMLFormElement).reset();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={t("code")} required requiredLabel="*">
          <Input name="code" required pattern="[A-Za-z0-9][A-Za-z0-9_\-]{1,59}" defaultValue={product?.code} />
        </FormField>
        <FormField label={t("kind")}>
          <NativeSelect value={kind} disabled={Boolean(product)} onChange={(e) => setKind(e.target.value as ProductKind)}>
            {PRODUCT_KINDS.map((k) => <option key={k} value={k}>{t(`kinds.${k}`)}</option>)}
          </NativeSelect>
        </FormField>
        <FormField label={`${t("nameField")} (FR)`} required requiredLabel="*">
          <Input name="name_fr" lang="fr" required maxLength={1000} defaultValue={product?.name.fr} />
        </FormField>
        <FormField label={`${t("nameField")} (EN)`} required requiredLabel="*">
          <Input name="name_en" lang="en" required maxLength={1000} defaultValue={product?.name.en} />
        </FormField>
        <FormField label={`${t("description")} (FR)`}>
          <Input name="description_fr" lang="fr" maxLength={1000} defaultValue={product?.description.fr} />
        </FormField>
        <FormField label={`${t("description")} (EN)`}>
          <Input name="description_en" lang="en" maxLength={1000} defaultValue={product?.description.en} />
        </FormField>
        <FormField label={t("price")} required requiredLabel="*">
          <Input name="price" inputMode="decimal" required defaultValue={product ? centsToInput(product.unit_price_cents, locale) : ""} />
        </FormField>
        <FormField label={t("vat")} required requiredLabel="*">
          <Input name="vat" inputMode="decimal" required defaultValue={product ? String(product.vat_rate_bp / 100) : "20"} />
        </FormField>
        {kind === "subscription" ? (
          <FormField label={t("interval")}>
            <NativeSelect name="interval" defaultValue={product?.interval ?? "month"}>
              {INTERVALS.map((i) => <option key={i} value={i}>{tBilling(`interval.${i}`)}</option>)}
            </NativeSelect>
          </FormField>
        ) : null}
        {kind === "course" ? (
          <FormField label={t("course")} required requiredLabel="*">
            <NativeSelect name="course_id" required defaultValue={product?.course_id ?? ""}>
              <option value="" disabled>{t("chooseCourse")}</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </NativeSelect>
          </FormField>
        ) : null}
      </div>
      <label className="inline-flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={product?.active ?? true} className="size-4 accent-primary" />
        {t("active")}
      </label>
      <div>
        <Button type="submit" variant="secondary" loading={pending}>{t("save")}</Button>
      </div>
      {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
      {saved && !error ? <p role="status" className="text-sm text-muted-foreground">{t("saved")}</p> : null}
    </form>
  );
}
