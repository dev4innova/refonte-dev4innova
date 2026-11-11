export type Step = { key: string; title: string; text: string };

/** Numbered process, as a real ordered list for assistive technologies. */
export function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {steps.map((step, index) => (
        <li key={step.key} className="flex flex-col gap-3 border-t-2 border-primary pt-5">
          <span aria-hidden="true" className="font-heading text-sm font-semibold text-primary-ink">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="text-heading-sm font-semibold">{step.title}</h3>
          <p className="text-muted-foreground">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
