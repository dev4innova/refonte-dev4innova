import type { SolutionSlug } from "@/config/offer";

import { IllustrationSvg, LABEL, TEXT, type IllustrationProps } from "./illustration";

/* One illustration per solution (doc 05, #2 to #6): each shows what the solution does. */

/** Assistants and agents: an assistant that answers and acts in the tools (tool call). */
export function AssistantsIllustration({
  labels,
  className,
}: IllustrationProps & { labels: { action: string } }) {
  return (
    <IllustrationSvg viewBox="0 0 400 225" name="ai-assistants" className={className}>
      <rect x="40" y="34" width="190" height="34" rx="17" fill="var(--illu-fill)" stroke="var(--illu-stroke-soft)" />
      <path d="M58 51h130" stroke="var(--illu-stroke-soft)" strokeWidth="6" strokeLinecap="round" />
      <rect x="120" y="84" width="200" height="56" rx="18" fill="var(--illu-solid)" />
      <path d="M140 104h150M140 120h110" stroke="var(--illu-on-solid)" strokeOpacity="0.55" strokeWidth="6" strokeLinecap="round" />
      <rect x="120" y="152" width="200" height="28" rx="8" fill="var(--illu-fill)" stroke="var(--illu-signal)" strokeDasharray="4 3" />
      <circle cx="136" cy="166" r="5" fill="var(--illu-signal)" />
      <text x="148" y="170" {...TEXT}>
        {labels.action}
      </text>
      <path d="M330 112h30v54h-30" stroke="var(--illu-stroke)" strokeDasharray="3 4" />
    </IllustrationSvg>
  );
}

/** Document automation: fields extracted from a document and checked. */
export function DocumentsIllustration({
  labels,
  className,
}: IllustrationProps & { labels: { invoice: string; amount: string } }) {
  return (
    <IllustrationSvg viewBox="0 0 400 225" name="document-automation" className={className}>
      <rect x="60" y="24" width="120" height="170" rx="6" fill="var(--illu-fill)" stroke="var(--illu-stroke-soft)" />
      <path d="M76 50h70M76 66h88M76 82h60" stroke="var(--illu-stroke-soft)" strokeWidth="5" strokeLinecap="round" />
      <g fill="var(--illu-signal)" fillOpacity="0.18" stroke="var(--illu-signal)">
        <rect x="72" y="100" width="96" height="16" rx="3" />
        <rect x="72" y="128" width="70" height="16" rx="3" />
      </g>
      <path d="M180 108h40M180 136h40" stroke="var(--illu-signal)" strokeDasharray="3 3" />
      <g fill="var(--illu-fill)" stroke="var(--illu-stroke-soft)">
        <rect x="224" y="96" width="136" height="24" rx="6" />
        <rect x="224" y="124" width="136" height="24" rx="6" />
      </g>
      <text x="234" y="112" {...TEXT}>
        {labels.invoice}
      </text>
      <text x="234" y="140" {...TEXT}>
        {labels.amount}
      </text>
      <g fill="var(--illu-solid)">
        <circle cx="348" cy="108" r="6" />
        <circle cx="348" cy="136" r="6" />
      </g>
      <path d="M345 108l2 2 4-4M345 136l2 2 4-4" stroke="var(--illu-on-solid)" strokeWidth="1.5" />
    </IllustrationSvg>
  );
}

/** Analysis and prediction: history, then a forecast with its confidence band and an alert. */
export function ForecastIllustration({
  labels,
  className,
}: IllustrationProps & { labels: { forecast: string } }) {
  return (
    <IllustrationSvg viewBox="0 0 400 225" name="data-intelligence" className={className}>
      <path d="M40 190h320M40 30v160" stroke="var(--illu-stroke-soft)" />
      <path
        d="M40 160l40-18 40 10 40-30 40 6 40-28"
        stroke="var(--illu-ink)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M240 100l40-14 40-20 40-10v58l-40 6-40 4h-40z" fill="var(--illu-signal)" fillOpacity="0.14" />
      <path
        d="M240 100l40-10 40-14 40-8"
        stroke="var(--illu-signal)"
        strokeWidth="2.5"
        strokeDasharray="6 5"
        strokeLinecap="round"
      />
      <path d="M240 30v160" stroke="var(--illu-stroke)" strokeDasharray="2 4" />
      <text x="248" y="44" {...LABEL}>
        {labels.forecast}
      </text>
      <circle cx="360" cy="68" r="6" fill="var(--illu-signal)" />
    </IllustrationSvg>
  );
}

/** Generative AI: content produced in your tone, validated by a person. */
export function ContentIllustration({
  labels,
  className,
}: IllustrationProps & {
  labels: { validate: string; tone: string; formal: string; direct: string; languages: string };
}) {
  return (
    <IllustrationSvg viewBox="0 0 400 225" name="generative-content" className={className}>
      <rect x="40" y="30" width="200" height="164" rx="10" fill="var(--illu-fill)" stroke="var(--illu-stroke-soft)" />
      <path
        d="M60 56h150M60 74h160M60 92h120M60 116h150"
        stroke="var(--illu-stroke-soft)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M60 134h100" stroke="var(--illu-signal)" strokeOpacity="0.55" strokeWidth="6" strokeLinecap="round" />
      <rect x="60" y="156" width="80" height="24" rx="6" fill="var(--illu-solid)" />
      <text x="100" y="172" textAnchor="middle" {...TEXT} fill="var(--illu-on-solid)">
        {labels.validate}
      </text>
      <text x="262" y="56" {...LABEL}>
        {labels.tone}
      </text>
      <path d="M262 76h100" stroke="var(--illu-stroke-soft)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="318" cy="76" r="8" fill="var(--illu-fill)" stroke="var(--illu-signal)" strokeWidth="2.5" />
      <text x="262" y="98" {...TEXT} fontSize={10} fill="var(--illu-label)">
        {labels.formal}
      </text>
      <text x="362" y="98" textAnchor="end" {...TEXT} fontSize={10} fill="var(--illu-label)">
        {labels.direct}
      </text>
      <rect x="262" y="120" width="100" height="22" rx="11" stroke="var(--illu-stroke-soft)" />
      <text x="312" y="135" textAnchor="middle" {...TEXT} fontSize={10.5}>
        {labels.languages}
      </text>
    </IllustrationSvg>
  );
}

/** Integration: AI as a hub connected to the tools teams already use. */
export function IntegrationIllustration({
  labels,
  className,
}: IllustrationProps & { labels: { hub: string; tools: [string, string, string, string, string, string] } }) {
  const positions = [
    { x: 70, y: 92 },
    { x: 390, y: 92 },
    { x: 110, y: 26 },
    { x: 350, y: 26 },
    { x: 110, y: 158 },
    { x: 350, y: 158 },
  ];
  return (
    <IllustrationSvg viewBox="0 0 560 213" name="ai-integration" className={className}>
      <path
        d="M280 106H120M280 106h160M280 106L160 40M280 106l120-66M280 106L160 172M280 106l120 66"
        stroke="var(--illu-stroke)"
        strokeDasharray="3 4"
      />
      <circle cx="280" cy="106" r="38" fill="var(--illu-solid)" />
      <circle cx="280" cy="106" r="48" stroke="var(--illu-signal)" strokeWidth="1.5" />
      <text x="280" y="111" textAnchor="middle" className="font-heading" fontWeight="600" fontSize="15" fill="var(--illu-on-solid)">
        {labels.hub}
      </text>
      {labels.tools.map((tool, index) => {
        const { x, y } = positions[index]!;
        return (
          <g key={tool}>
            <rect x={x} y={y} width="100" height="28" rx="14" fill="var(--illu-fill)" stroke="var(--illu-stroke-soft)" />
            <text x={x + 50} y={y + 18} textAnchor="middle" {...TEXT} fontSize={12}>
              {tool}
            </text>
          </g>
        );
      })}
    </IllustrationSvg>
  );
}

export type SolutionIllustrationLabels = {
  "ai-assistants": { action: string };
  "document-automation": { invoice: string; amount: string };
  "data-intelligence": { forecast: string };
  "generative-content": { validate: string; tone: string; formal: string; direct: string; languages: string };
  "ai-integration": { hub: string; tools: [string, string, string, string, string, string] };
};

/** The illustration of a solution, by slug (Solutions bento, solution pages). */
export function SolutionIllustration({
  slug,
  labels,
  className,
}: IllustrationProps & { slug: SolutionSlug; labels: SolutionIllustrationLabels }) {
  switch (slug) {
    case "ai-assistants":
      return <AssistantsIllustration labels={labels[slug]} className={className} />;
    case "document-automation":
      return <DocumentsIllustration labels={labels[slug]} className={className} />;
    case "data-intelligence":
      return <ForecastIllustration labels={labels[slug]} className={className} />;
    case "generative-content":
      return <ContentIllustration labels={labels[slug]} className={className} />;
    case "ai-integration":
      return <IntegrationIllustration labels={labels[slug]} className={className} />;
  }
}
