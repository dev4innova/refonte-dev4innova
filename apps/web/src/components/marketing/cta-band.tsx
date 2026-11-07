import { ArrowRight } from "lucide-react";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export type CtaBandProps = {
  title: string;
  text?: string;
  actionLabel: string;
  /** Defaults to the contact page. */
  href?: "/contact";
};

/** Closing call to action of a page. */
export function CtaBand({ title, text, actionLabel, href = "/contact" }: CtaBandProps) {
  return (
    <Section variant="inverse">
      <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 className="text-display-md font-semibold">{title}</h2>
          {text ? <p className="text-lg text-inverse-muted-foreground">{text}</p> : null}
        </div>
        <Button asChild size="lg" className="shrink-0">
          <Link href={href}>
            {actionLabel}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </Section>
  );
}
