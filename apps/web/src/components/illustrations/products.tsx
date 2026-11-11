import { IllustrationSvg, LABEL, TEXT, type IllustrationProps } from "./illustration";

/* Products built by DEV4INNOVA (homepage, "Our work"): schematic views, not screenshots.
 * Real screenshots replace them in batch L6, inside a ProductFrame with a demo caption. */

export type DiagnosticReportLabels = { score: string; level: string };

/** Diagnostic: an overall score and the five axes as bars. */
export function DiagnosticReportIllustration({
  labels,
  className,
}: IllustrationProps & { labels: DiagnosticReportLabels }) {
  const bars = [0.85, 0.4, 0.6, 0.5, 0.7];
  return (
    <IllustrationSvg viewBox="0 0 400 225" name="diagnostic-report" className={className}>
      <rect x="32" y="28" width="336" height="170" rx="12" fill="var(--illu-fill)" stroke="var(--illu-stroke-soft)" />
      <text x="56" y="66" {...LABEL}>
        {labels.score}
      </text>
      <text x="56" y="112" className="font-heading" fontSize="32" fontWeight="700" fill="var(--illu-signal)">
        {labels.level}
      </text>
      <path d="M56 140h96M56 156h72" stroke="var(--illu-stroke-soft)" strokeWidth="6" strokeLinecap="round" />
      {bars.map((value, index) => (
        <g key={index}>
          <path d={`M208 ${62 + index * 26}h136`} stroke="var(--illu-stroke-soft)" strokeWidth="6" strokeLinecap="round" />
          <path
            d={`M208 ${62 + index * 26}h${Math.round(136 * value)}`}
            stroke={index === 0 ? "var(--illu-signal)" : "var(--illu-ink)"}
            strokeWidth="6"
            strokeLinecap="round"
          />
        </g>
      ))}
    </IllustrationSvg>
  );
}

export type PortalLabels = { milestones: string; deliverable: string; validate: string };

/** Client portal: project milestones, a deliverable waiting for approval. */
export function PortalIllustration({ labels, className }: IllustrationProps & { labels: PortalLabels }) {
  return (
    <IllustrationSvg viewBox="0 0 400 225" name="client-portal" className={className}>
      <text x="40" y="44" {...LABEL}>
        {labels.milestones}
      </text>
      <path d="M52 76h296" stroke="var(--illu-stroke)" strokeWidth="1.5" />
      <path d="M52 76h148" stroke="var(--illu-ink)" strokeWidth="2" />
      <g fill="var(--illu-solid)">
        <circle cx="52" cy="76" r="9" />
        <circle cx="126" cy="76" r="9" />
      </g>
      <path d="M48 76l3 3 5-6M122 76l3 3 5-6" stroke="var(--illu-on-solid)" strokeWidth="1.5" />
      <circle cx="200" cy="76" r="9" fill="var(--illu-fill)" stroke="var(--illu-signal)" strokeWidth="2" />
      <g fill="var(--illu-fill)" stroke="var(--illu-stroke)">
        <circle cx="274" cy="76" r="9" />
        <circle cx="348" cy="76" r="9" />
      </g>
      <rect x="40" y="112" width="320" height="76" rx="10" fill="var(--illu-fill)" stroke="var(--illu-stroke-soft)" />
      <rect x="58" y="130" width="30" height="38" rx="4" stroke="var(--illu-stroke)" />
      <path d="M64 142h18M64 150h14M64 158h18" stroke="var(--illu-stroke)" />
      <text x="104" y="146" {...TEXT}>
        {labels.deliverable}
      </text>
      <path d="M104 162h90" stroke="var(--illu-stroke-soft)" strokeWidth="5" strokeLinecap="round" />
      <rect x="252" y="136" width="90" height="28" rx="8" fill="var(--illu-signal)" />
      <text x="297" y="154" textAnchor="middle" {...TEXT} fill="var(--illu-on-solid)">
        {labels.validate}
      </text>
    </IllustrationSvg>
  );
}

export type CertificateLabels = { certificate: string; code: string; verified: string };

/** Academy certificate, verifiable online by its code. */
export function CertificateIllustration({
  labels,
  className,
}: IllustrationProps & { labels: CertificateLabels }) {
  return (
    <IllustrationSvg viewBox="0 0 400 225" name="academy-certificate" className={className}>
      <rect x="60" y="26" width="220" height="160" rx="8" fill="var(--illu-fill)" stroke="var(--illu-stroke-soft)" />
      <rect x="70" y="36" width="200" height="140" rx="4" stroke="var(--illu-stroke-soft)" strokeDasharray="2 3" />
      <text x="170" y="68" textAnchor="middle" {...LABEL}>
        {labels.certificate}
      </text>
      <path d="M112 92h116M130 108h80" stroke="var(--illu-stroke-soft)" strokeWidth="6" strokeLinecap="round" />
      <text x="170" y="150" textAnchor="middle" className="font-mono" fontSize="11" fill="var(--illu-ink)">
        {labels.code}
      </text>
      <circle cx="268" cy="168" r="22" fill="var(--illu-fill)" stroke="var(--illu-signal)" strokeWidth="2" />
      <path d="M258 168l7 7 13-14" stroke="var(--illu-signal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M296 168h24" stroke="var(--illu-stroke)" strokeDasharray="3 3" />
      <rect x="320" y="154" width="64" height="28" rx="14" fill="var(--illu-fill)" stroke="var(--illu-stroke-soft)" />
      <text x="352" y="172" textAnchor="middle" {...TEXT} fontSize={10}>
        {labels.verified}
      </text>
    </IllustrationSvg>
  );
}

const VALUE_ICONS = {
  /* Frame: a target, its center in red. */
  strategy: (
    <>
      <circle cx="22" cy="22" r="17" />
      <circle cx="22" cy="22" r="9" />
      <circle cx="22" cy="22" r="2.5" fill="var(--illu-signal)" stroke="none" />
    </>
  ),
  /* Build: code in a window. */
  build: (
    <>
      <rect x="6" y="9" width="32" height="24" rx="3" />
      <path d="M14 18l-4 4 4 4M30 18l4 4-4 4M24 15l-4 14" />
      <path d="M6 37h32" stroke="var(--illu-signal)" />
    </>
  ),
  /* Run: a rising trend. */
  run: (
    <>
      <path d="M8 30l9-9 6 6 13-13" />
      <path d="M28 14h8v8" />
      <path d="M8 37h28" stroke="var(--illu-signal)" />
    </>
  ),
} as const;

/** Pictograms of the three commitments of the value proposition (frame, build, run). */
export function ValueIcon({ name, className }: IllustrationProps & { name: keyof typeof VALUE_ICONS }) {
  return (
    <svg
      viewBox="0 0 44 44"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-slot="illustration"
      data-illustration={`value-${name}`}
      className={className}
    >
      {VALUE_ICONS[name]}
    </svg>
  );
}
