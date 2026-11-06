import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { designSystemContent as c } from "@/content/design-system";

export const metadata: Metadata = {
  title: c.metaTitle,
  robots: { index: false, follow: false },
};

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-8 text-display-md font-semibold">
      {children}
    </h2>
  );
}

/** Internal showcase of the design system (TASK-020 to TASK-031). */
export default function DesignSystemPage() {
  return (
    <>
      <Section variant="card">
        <h1 className="text-display-lg font-bold">{c.title}</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{c.lead}</p>
      </Section>

      <Section aria-labelledby="ds-colors">
        <SectionTitle id="ds-colors">{c.sections.colors}</SectionTitle>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {c.colors.map((color) => (
            <li key={color.token} className="overflow-hidden rounded-lg border bg-card">
              <div className={`h-20 border-b ${color.className}`} />
              <div className="p-3">
                <p className="text-sm font-medium">{color.label}</p>
                <p className="font-mono text-xs text-muted-foreground">--{color.token}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section variant="card" aria-labelledby="ds-typography">
        <SectionTitle id="ds-typography">{c.sections.typography}</SectionTitle>
        <div className="flex flex-col gap-6">
          {c.typography.map((item, index) => (
            <p key={item.sample} className={`${index < 5 ? "font-heading" : ""} ${item.className}`}>
              {item.sample}
            </p>
          ))}
        </div>
      </Section>

      <Section aria-labelledby="ds-spacing">
        <SectionTitle id="ds-spacing">{c.sections.spacing}</SectionTitle>
        <ul className="flex flex-col gap-3">
          {c.spacing.map((space) => (
            <li key={space.label} className="flex items-center gap-4">
              <span className="w-16 font-mono text-sm text-muted-foreground">{space.label}</span>
              <span className={`block h-4 rounded-sm bg-primary ${space.className}`} />
            </li>
          ))}
        </ul>
      </Section>

      <Section variant="card" aria-labelledby="ds-buttons">
        <SectionTitle id="ds-buttons">{c.sections.buttons}</SectionTitle>
        <div className="flex flex-wrap items-center gap-3">
          <Button>{c.buttons.primary}</Button>
          <Button variant="secondary">{c.buttons.secondary}</Button>
          <Button variant="outline">{c.buttons.outline}</Button>
          <Button variant="ghost">{c.buttons.ghost}</Button>
          <Button variant="link">{c.buttons.link}</Button>
          <Button loading>{c.buttons.loading}</Button>
          <Button disabled>{c.buttons.disabled}</Button>
          <Button size="icon" variant="outline" aria-label={c.buttons.icon}>
            <ArrowRight aria-hidden="true" />
          </Button>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button size="sm">{c.buttons.primary}</Button>
          <Button size="md">{c.buttons.primary}</Button>
          <Button size="lg">{c.buttons.primary}</Button>
        </div>
      </Section>

      <Section aria-labelledby="ds-cards">
        <SectionTitle id="ds-cards">{c.sections.cards}</SectionTitle>
        <div className="grid gap-6 md:grid-cols-3">
          {c.cards.map((card) => (
            <Card key={card.title} variant={card.variant} interactive>
              <CardHeader>
                <CardTitle>{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent />
              <CardFooter>
                <Button asChild variant={card.variant === "inverse" ? "inverse" : "outline"} size="sm">
                  <Link href="/solutions">
                    {card.action}
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </Section>

      <Section variant="card" aria-labelledby="ds-forms">
        <SectionTitle id="ds-forms">{c.sections.forms}</SectionTitle>
        <form className="grid max-w-2xl gap-6" action="#">
          <FormField label={c.form.name} required requiredLabel={c.form.required}>
            <Input name="name" autoComplete="name" />
          </FormField>
          <FormField label={c.form.email} description={c.form.emailHelp} error={c.form.emailError}>
            <Input name="email" type="email" autoComplete="email" defaultValue="contact@" />
          </FormField>
          <FormField label={c.form.message}>
            <Textarea name="message" />
          </FormField>
          <FormField label={c.form.consent} inline>
            <Checkbox name="consent" />
          </FormField>
          <div>
            <Button type="submit">{c.form.submit}</Button>
          </div>
        </form>
      </Section>

      <Section aria-labelledby="ds-motion">
        <SectionTitle id="ds-motion">{c.sections.motion}</SectionTitle>
        <div className="flex flex-wrap gap-6">
          <div className="grid size-32 animate-fade-in place-items-center rounded-xl bg-card shadow-card">
            {c.motion.fade}
          </div>
          <div className="grid size-32 animate-slide-up place-items-center rounded-xl bg-card shadow-card">
            {c.motion.slide}
          </div>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">{c.motion.note}</p>
      </Section>

      <Section variant="inverse" aria-labelledby="ds-inverse">
        <h2 id="ds-inverse" className="text-display-md font-semibold">
          {c.inverse.title}
        </h2>
        <p className="mt-4 max-w-2xl text-inverse-muted-foreground">
          {c.inverse.text}{" "}
          <Link href="/solutions" className="font-medium text-primary-on-inverse underline underline-offset-4">
            {c.sections.inverse}
          </Link>
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button>{c.inverse.action}</Button>
          <Button variant="inverse">{c.inverse.secondary}</Button>
        </div>
      </Section>
    </>
  );
}
