import { IllustrationSvg, LABEL, TEXT, type IllustrationProps } from "./illustration";

/* The three branches of the circuit, from the filament to each module. */
const PULSES = [
  "M101 179V120h120l40 40h86",
  "M101 179V120h120v170h126",
  "M101 179V120h120v290h126",
] as const;
const NODES = [
  [221, 120],
  [347, 160],
  [221, 290],
  [347, 290],
  [347, 410],
] as const;

export type SignalToSystemLabels = {
  assistant: string;
  tool: string;
  document: string;
  forecast: string;
};

/**
 * Signature visual "From signal to system": the filament of the brand bulb becomes a circuit
 * that powers three modules (assistant, document, forecast). Drawn once on load; with `loop`,
 * a signal then travels along the circuit to each module, nodes blink and modules breathe
 * (still under reduced motion).
 * Full version from 640 px, compact version below.
 */
export function SignalToSystem({
  labels,
  loop = false,
  className,
}: IllustrationProps & { labels: SignalToSystemLabels; loop?: boolean }) {
  const live = (name: string) => (loop ? name : undefined);
  return (
    <div data-slot="signal-to-system" className={className}>
      <SignalToSystemCompact loop={loop} className="sm:hidden" />
      <IllustrationSvg viewBox="0 0 560 520" name="signal-to-system" className="hidden sm:block">
        <g stroke="var(--illu-stroke)" strokeWidth="1.5">
          <path d="M70 250c0-12-5-20-14-31-11-12-17-25-17-40a52 52 0 1 1 104 0c0 15-7 28-17 40-9 11-14 19-14 31z" />
          {loop ? (
            <circle
              className="illu-breathe"
              cx="101"
              cy="179"
              r="34"
              stroke="none"
              fill="var(--illu-signal)"
              fillOpacity="0.12"
            />
          ) : null}
          <path d="M78 262h46M80 272h42M86 282h30" strokeLinecap="round" />
        </g>
        <path
          className="illu-draw"
          pathLength={1}
          d="M92 250v-36c-12-6-13-20-3-21 5 0 8 4 9 9 1-5 4-9 9-9 10 1 9 15-3 21v36 M101 179V120h120l40 40h86 M221 120v170h126 M221 290v120h126"
          stroke="var(--illu-signal)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {loop
          ? PULSES.map((d, index) => (
              <path
                key={d}
                className="illu-pulse"
                style={{ animationDelay: `${1.4 + index * 1.2}s` }}
                pathLength={1}
                d={d}
                stroke="var(--illu-ink)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))
          : null}
        <g className="illu-fade-late" fill="var(--illu-signal)">
          {NODES.map(([cx, cy], index) => (
            <circle
              key={`${cx}-${cy}`}
              className={live("illu-blink")}
              style={loop ? { animationDelay: `${1.4 + index * 0.6}s` } : undefined}
              cx={cx}
              cy={cy}
              r="4"
            />
          ))}
        </g>
        <g className="illu-fade-late">
          <rect x="347" y="96" width="190" height="128" rx="14" fill="var(--illu-fill)" stroke="var(--illu-stroke)" />
          <text x="363" y="122" {...LABEL}>
            {labels.assistant}
          </text>
          <rect x="363" y="136" width="120" height="22" rx="11" fill="var(--illu-solid)" />
          <rect className={live("illu-breathe")} x="400" y="166" width="121" height="22" rx="11" fill="var(--illu-signal)" />
          <rect x="363" y="196" width="104" height="16" rx="8" stroke="var(--illu-stroke)" strokeDasharray="3 3" />
          <text x="371" y="207" {...TEXT} fontSize={8.5} fill="var(--illu-label)">
            {labels.tool}
          </text>
        </g>
        <g className="illu-fade-late">
          <rect x="347" y="246" width="190" height="96" rx="14" fill="var(--illu-fill)" stroke="var(--illu-stroke)" />
          <text x="363" y="272" {...LABEL}>
            {labels.document}
          </text>
          <rect x="363" y="284" width="70" height="44" rx="4" stroke="var(--illu-stroke)" />
          <path d="M370 294h46M370 302h40M370 310h50M370 318h30" stroke="var(--illu-label)" />
          <path
            d="M447 290h60M447 306h60M447 322h68"
            stroke="var(--illu-stroke-soft)"
            strokeLinecap="round"
            strokeWidth="5"
          />
          <circle className={live("illu-blink")} cx="521" cy="290" r="5" fill="var(--illu-signal)" />
        </g>
        <g className="illu-fade-late">
          <rect x="347" y="364" width="190" height="116" rx="14" fill="var(--illu-fill)" stroke="var(--illu-stroke)" />
          <text x="363" y="390" {...LABEL}>
            {labels.forecast}
          </text>
          <path
            d="M363 456l28-14 26 6 28-22 26 8 26-20"
            stroke="var(--illu-ink)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M471 414l26-8v18l-26 14z" fill="var(--illu-signal)" fillOpacity="0.25" />
          <path
            className={live("illu-flow")}
            d="M471 424l26-10"
            stroke="var(--illu-signal)"
            strokeWidth="2"
            strokeDasharray="4 3"
          />
          <path d="M363 466h158" stroke="var(--illu-stroke)" />
        </g>
        <path d="M20 20h12M26 14v12M528 494h12M534 488v12" stroke="var(--illu-stroke)" />
      </IllustrationSvg>
    </div>
  );
}

/** Compact variant (phones): the filament and a single module. */
export function SignalToSystemCompact({ loop = false, className }: IllustrationProps & { loop?: boolean }) {
  return (
    <IllustrationSvg viewBox="0 0 320 120" name="signal-to-system-compact" className={className}>
      <path
        d="M30 90V60c-9-4-10-15-2-16 4 0 6 3 7 7 1-4 3-7 7-7 8 1 7 12-2 16v30"
        stroke="var(--illu-signal)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        className="illu-draw"
        pathLength={1}
        d="M37 44V20h90l20 20h40"
        stroke="var(--illu-signal)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {loop ? (
        <path
          className="illu-pulse"
          pathLength={1}
          d="M37 44V20h90l20 20h40"
          stroke="var(--illu-ink)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ) : null}
      <rect x="187" y="14" width="120" height="80" rx="12" fill="var(--illu-fill)" stroke="var(--illu-stroke)" />
      <rect x="199" y="30" width="72" height="14" rx="7" fill="var(--illu-solid)" />
      <rect
        className={loop ? "illu-breathe" : undefined}
        x="223"
        y="52"
        width="72"
        height="14"
        rx="7"
        fill="var(--illu-signal)"
      />
      <path d="M199 80h60" stroke="var(--illu-stroke)" strokeDasharray="3 3" />
    </IllustrationSvg>
  );
}
