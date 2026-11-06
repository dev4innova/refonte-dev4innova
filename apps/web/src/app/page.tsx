import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { siteContent } from "@/content/site";

// Placeholder hero until the corporate homepage (TASK-047).
export default function Home() {
  const { home, nav } = siteContent;

  return (
    <Section variant="inverse" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 right-[-10%] size-[36rem] rounded-full bg-primary/25 blur-3xl"
      />
      <div className="relative flex max-w-3xl animate-slide-up flex-col gap-8">
        <p className="font-heading text-sm font-semibold tracking-[0.2em] text-primary-on-inverse uppercase">
          {home.eyebrow}
        </p>
        <h1 className="text-display-xl font-bold">{home.title}</h1>
        <p className="max-w-2xl text-lg text-inverse-muted-foreground">{home.lead}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href={nav.cta.href}>
              {home.primaryCta}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="inverse">
            <Link href="/solutions">{home.secondaryCta}</Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
