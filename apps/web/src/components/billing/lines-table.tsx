import { getLocale, getTranslations } from "next-intl/server";

import { money, rateLabel } from "@/lib/billing";

type Line = { description: string; quantity: string; unit_price_cents: number; vat_rate_bp: number; net_cents: number };
type Totals = { net_cents: number; vat_cents: number; gross_cents: number; extra?: { label: string; cents: number }[] };

/** Lines and totals of a quote or an invoice. */
export async function LinesTable({ lines, totals, caption }: { lines: Line[]; totals: Totals; caption: string }) {
  const [t, locale] = await Promise.all([getTranslations("Billing.quote"), getLocale()]);
  const quantity = (value: string) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number(value));
  const rows = [
    [t("net"), totals.net_cents],
    [t("vatTotal"), totals.vat_cents],
    [t("gross"), totals.gross_cents],
    ...(totals.extra ?? []).map((e) => [e.label, e.cents] as const),
  ] as const;
  return (
    <div className="relative overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[36rem] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border text-left text-xs text-muted-foreground uppercase">
          <tr>
            <th scope="col" className="p-3">{t("description")}</th>
            <th scope="col" className="p-3 text-right">{t("quantity")}</th>
            <th scope="col" className="p-3 text-right">{t("unitPrice")}</th>
            <th scope="col" className="p-3 text-right">{t("vat")}</th>
            <th scope="col" className="p-3 text-right">{t("total")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {lines.map((line, index) => (
            <tr key={index}>
              <td className="p-3">{line.description}</td>
              <td className="p-3 text-right">{quantity(line.quantity)}</td>
              <td className="p-3 text-right whitespace-nowrap">{money(line.unit_price_cents, locale)}</td>
              <td className="p-3 text-right">{rateLabel(line.vat_rate_bp, locale)}</td>
              <td className="p-3 text-right whitespace-nowrap">{money(line.net_cents, locale)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border">
          {rows.map(([label, cents], index) => (
            <tr key={label} className={index === 2 ? "font-semibold" : undefined}>
              <th scope="row" colSpan={4} className="p-3 text-right font-medium">{label}</th>
              <td className="p-3 text-right whitespace-nowrap">{money(cents, locale)}</td>
            </tr>
          ))}
        </tfoot>
      </table>
    </div>
  );
}
