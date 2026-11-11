import { IllustrationSvg, LABEL, type IllustrationProps } from "./illustration";

export type AccountHubLabels = { hub: string; projects: string; academy: string; ai: string };

/* Connectors from the account to each space, drawn as signals in a loop. */
const LINKS = ["M240 200V170H115V136", "M240 200V170H365V136", "M240 236V300"] as const;

/**
 * The client area: one account opens three spaces (projects, courses, AI tools). Signals travel
 * from the account to each space in a loop (still under reduced motion). Decorative: the page states the same in text.
 */
export function AccountHub({ labels, className }: IllustrationProps & { labels: AccountHubLabels }) {
  return (
    <IllustrationSvg viewBox="0 0 480 420" name="account-hub" className={className}>
      <path d={LINKS.join(" ")} stroke="var(--illu-stroke)" strokeWidth="1.5" strokeDasharray="3 4" />
      {LINKS.map((d, index) => (
        <path
          key={d}
          className="illu-pulse"
          style={{ animationDelay: `${0.4 + index * 1.2}s` }}
          pathLength={1}
          d={d}
          stroke="var(--illu-signal)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}

      {/* Projects: milestones and a progress bar. */}
      <rect x="40" y="40" width="150" height="96" rx="12" fill="var(--illu-fill)" stroke="var(--illu-stroke)" />
      <text x="56" y="64" {...LABEL}>
        {labels.projects}
      </text>
      <path d="M56 86h118" stroke="var(--illu-stroke-soft)" strokeWidth="6" strokeLinecap="round" />
      <path className="illu-breathe" d="M56 86h70" stroke="var(--illu-signal)" strokeWidth="6" strokeLinecap="round" />
      <g fill="var(--illu-solid)">
        <circle cx="62" cy="112" r="6" />
        <circle cx="90" cy="112" r="6" />
      </g>
      <circle cx="118" cy="112" r="6" fill="var(--illu-fill)" stroke="var(--illu-stroke)" />

      {/* Courses: a certificate seal. */}
      <rect x="290" y="40" width="150" height="96" rx="12" fill="var(--illu-fill)" stroke="var(--illu-stroke)" />
      <text x="306" y="64" {...LABEL}>
        {labels.academy}
      </text>
      <path d="M306 86h70M306 100h50" stroke="var(--illu-stroke-soft)" strokeWidth="6" strokeLinecap="round" />
      <circle className="illu-blink" cx="410" cy="104" r="14" fill="var(--illu-fill)" stroke="var(--illu-signal)" strokeWidth="2" />
      <path d="M404 104l4 4 8-8" stroke="var(--illu-signal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* The account. */}
      <rect x="170" y="200" width="140" height="36" rx="18" fill="var(--illu-solid)" />
      <circle cx="194" cy="218" r="7" stroke="var(--illu-on-solid)" strokeWidth="1.5" />
      <path d="M186 230c2-5 14-5 16 0" stroke="var(--illu-on-solid)" strokeWidth="1.5" />
      <text x="212" y="222" {...LABEL} fontSize={10} letterSpacing={1.2} fill="var(--illu-on-solid)">
        {labels.hub}
      </text>
      <circle className="illu-breathe" cx="240" cy="218" r="48" stroke="var(--illu-signal)" strokeOpacity="0.4" />

      {/* AI tools: a conversation. */}
      <rect x="120" y="300" width="240" height="96" rx="12" fill="var(--illu-fill)" stroke="var(--illu-stroke)" />
      <text x="136" y="324" {...LABEL}>
        {labels.ai}
      </text>
      <rect x="136" y="336" width="120" height="18" rx="9" fill="var(--illu-stroke-soft)" />
      <rect className="illu-breathe" x="200" y="362" width="144" height="18" rx="9" fill="var(--illu-signal)" />
    </IllustrationSvg>
  );
}
