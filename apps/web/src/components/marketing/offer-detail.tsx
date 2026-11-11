import { Check, type LucideIcon } from "lucide-react";
import type * as React from "react";

import { Section } from "@/components/layout/section";
import { Breadcrumb, type BreadcrumbItem } from "@/components/marketing/breadcrumb";
import { CtaBand } from "@/components/marketing/cta-band";
import { OfferGrid, type OfferItem } from "@/components/marketing/offer-grid";
import { PageHeader } from "@/components/marketing/page-header";

export type OfferDetailProps = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  summary: string;
  description: string;
  breadcrumb: { label: string; items: BreadcrumbItem[] };
  lists: { title: string; items: string[] }[];
  /** Free text block (e.g. "Who is it for?"). */
  aside?: { title: string; text: string };
  related: { title: string; linkLabel: string; items: OfferItem[] };
  cta: { title: string; text: string; actionLabel: string };
  /** Decorative illustration of the page header. */
  illustration?: React.ReactNode;
};

/** Detail page of a solution or a service. */
export function OfferDetail(props: OfferDetailProps) {
  const { icon: Icon } = props;
  return (
    <>
      <PageHeader
        eyebrow={props.eyebrow}
        title={props.title}
        lead={props.summary}
        before={<Breadcrumb label={props.breadcrumb.label} items={props.breadcrumb.items} />}
        illustration={props.illustration}
      />

      <Section variant="card">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="flex flex-col gap-10">
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-tint text-tint-foreground">
                <Icon aria-hidden="true" className="size-6" />
              </span>
              <p className="text-lg">{props.description}</p>
            </div>
            {props.aside ? (
              <div className="flex flex-col gap-3">
                <h2 className="text-heading-lg font-semibold">{props.aside.title}</h2>
                <p className="text-muted-foreground">{props.aside.text}</p>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-10">
            {props.lists.map((list) => (
              <CheckList key={list.title} title={list.title} items={list.items} />
            ))}
          </div>
        </div>
      </Section>

      {props.related.items.length > 0 ? (
        <Section aria-label={props.related.title}>
          <h2 className="mb-10 text-display-md font-semibold">{props.related.title}</h2>
          <OfferGrid items={props.related.items} linkLabel={props.related.linkLabel} />
        </Section>
      ) : null}

      <CtaBand title={props.cta.title} text={props.cta.text} actionLabel={props.cta.actionLabel} />
    </>
  );
}

function CheckList({ title, items }: { title: string; items: string[] }): React.ReactNode {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-heading-lg font-semibold">{title}</h2>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary-ink" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
