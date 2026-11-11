import { ArrowRight } from "lucide-react";

import { IllustrationPanel } from "@/components/illustrations/illustration";
import { SolutionIllustration, type SolutionIllustrationLabels } from "@/components/illustrations/solutions";
import { BentoCell, BentoGrid } from "@/components/studio/bento-grid";
import { SOLUTIONS, type SolutionSlug } from "@/config/offer";
import { Link } from "@/i18n/navigation";

/* Bento of the solutions (doc 04 § 3.3): sizes in the order of SOLUTIONS. */
const BENTO = [
  { size: "lg", surface: "card" },
  { size: "md", surface: "card" },
  { size: "md", surface: "card" },
  { size: "lg", surface: "card" },
  { size: "wide", surface: "inverse" },
] as const;

export type SolutionsBentoProps = {
  items: Record<SolutionSlug, { title: string; summary: string }>;
  labels: SolutionIllustrationLabels;
  linkLabel: string;
  /** Heading level of the cell titles (h3 under a section h2, h2 under the page h1). */
  headingLevel?: "h2" | "h3";
};

/** The five solutions, each with its illustration; the whole cell links to its page. */
export function SolutionsBento({ items, labels, linkLabel, headingLevel: Heading = "h3" }: SolutionsBentoProps) {
  return (
    <BentoGrid>
      {SOLUTIONS.map(({ slug }, index) => {
        const cell = BENTO[index] ?? BENTO[1];
        const wide = cell.size === "wide";
        return (
          <BentoCell
            key={slug}
            size={cell.size}
            surface={cell.surface}
            className={wide ? "lg:grid lg:grid-cols-[1fr_1.4fr] lg:items-center lg:gap-10" : undefined}
          >
            <IllustrationPanel className={wide ? "lg:order-2" : undefined}>
              <SolutionIllustration slug={slug} labels={labels} />
            </IllustrationPanel>
            <div className="flex flex-col gap-3">
              <Heading className="font-heading text-heading-lg font-semibold">
                <Link href={{ pathname: "/solutions/[slug]", params: { slug } }} data-stretched>
                  {items[slug].title}
                </Link>
              </Heading>
              <p className="text-muted-foreground in-data-[variant=inverse]:text-inverse-muted-foreground">
                {items[slug].summary}
              </p>
              <span
                aria-hidden="true"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-ink in-data-[variant=inverse]:text-primary-on-inverse"
              >
                {linkLabel}
                <ArrowRight className="size-4 transition-transform duration-base ease-out-soft group-hover/cell:translate-x-1" />
              </span>
            </div>
          </BentoCell>
        );
      })}
    </BentoGrid>
  );
}
