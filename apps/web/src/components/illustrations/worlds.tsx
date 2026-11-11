import { IllustrationSvg, LABEL, TEXT, type IllustrationProps } from "./illustration";

export type LabBoardLabels = { idea: string; prototype: string; module: string };

/* The three stages of an Innovation Lab experiment, drawn at the origin of each 128 × 128 tile. */
function IdeaTile() {
  return (
    <>
      <rect width="128" height="128" rx="12" stroke="var(--illu-stroke)" strokeWidth="1.5" strokeDasharray="4 4" />
      <path d="M24 90c12-30 30-46 46-30s26 6 38-20" stroke="var(--illu-stroke)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="34" cy="30" r="8" stroke="var(--illu-stroke)" strokeWidth="1.5" />
    </>
  );
}

function PrototypeTile() {
  return (
    <>
      <rect width="128" height="128" rx="12" fill="var(--illu-fill)" stroke="var(--illu-stroke)" strokeWidth="1.5" />
      <rect x="16" y="18" width="96" height="14" rx="4" fill="var(--illu-solid)" />
      <rect x="16" y="40" width="60" height="60" rx="6" stroke="var(--illu-stroke)" />
      <path d="M86 46h26M86 60h20M86 74h26" stroke="var(--illu-stroke)" />
    </>
  );
}

function ModuleTile() {
  return (
    <>
      <rect width="128" height="128" rx="12" fill="var(--illu-fill)" stroke="var(--illu-signal)" strokeWidth="1.5" />
      <rect x="16" y="24" width="96" height="24" rx="6" fill="var(--illu-signal)" />
      <g fill="var(--illu-stroke-soft)">
        <rect x="16" y="56" width="96" height="10" rx="5" />
        <rect x="16" y="74" width="70" height="10" rx="5" />
        <rect x="16" y="92" width="84" height="10" rx="5" />
      </g>
    </>
  );
}

/**
 * Innovation Lab board: idea (sketch), prototype (mock-up), reusable module (component).
 * Tiles side by side from 640 px, stacked below.
 */
export function LabBoard({ labels, className }: IllustrationProps & { labels: LabBoardLabels }) {
  const tiles = [
    { key: "idea", Tile: IdeaTile, label: labels.idea },
    { key: "prototype", Tile: PrototypeTile, label: labels.prototype },
    { key: "module", Tile: ModuleTile, label: labels.module },
  ] as const;
  return (
    <div data-slot="lab-board" className={className}>
      <IllustrationSvg viewBox="0 0 480 270" name="lab-board" className="hidden sm:block">
        <path d="M144 134h32M304 134h32" stroke="var(--illu-signal)" strokeWidth="1.5" />
        {tiles.map(({ key, Tile, label }, index) => (
          <g key={key} transform={`translate(${16 + index * 160} 70)`}>
            <Tile />
            <text y="156" {...LABEL}>
              {label}
            </text>
          </g>
        ))}
      </IllustrationSvg>
      <IllustrationSvg viewBox="0 0 320 300" name="lab-board-compact" className="sm:hidden">
        <path d="M80 104v12M80 204v12" stroke="var(--illu-signal)" strokeWidth="1.5" />
        {tiles.map(({ key, Tile, label }, index) => (
          <g key={key} transform={`translate(32 ${8 + index * 100}) scale(0.72)`}>
            <Tile />
            <text x="150" y="70" {...LABEL} fontSize={15}>
              {label}
            </text>
          </g>
        ))}
      </IllustrationSvg>
    </div>
  );
}

export type AcademyPathLabels = {
  module1: string;
  module2: string;
  quiz: string;
  quizMark: string;
  certificate: string;
  verifiable: string;
};

/** Academy path: modules completed, a quiz, then a certificate that can be verified online. */
export function AcademyPath({ labels, className }: IllustrationProps & { labels: AcademyPathLabels }) {
  return (
    <IllustrationSvg viewBox="0 0 480 270" name="academy-path" className={className}>
      <path
        d="M40 200c60 0 60-60 120-60s60 60 120 60 60-80 120-80"
        stroke="var(--illu-stroke)"
        strokeWidth="1.5"
        strokeDasharray="5 5"
      />
      <g fill="var(--illu-fill)" stroke="var(--illu-ink)" strokeWidth="1.5">
        <circle cx="40" cy="200" r="16" />
        <circle cx="160" cy="140" r="16" />
        <circle cx="280" cy="200" r="16" />
      </g>
      <path d="M33 200l5 5 9-10M153 140l5 5 9-10" stroke="var(--illu-ink)" strokeWidth="1.6" strokeLinecap="round" />
      <text x="280" y="205" textAnchor="middle" className="font-heading" fontWeight="600" fontSize="12" fill="var(--illu-ink)">
        {labels.quizMark}
      </text>
      <circle cx="400" cy="120" r="34" fill="var(--illu-fill)" stroke="var(--illu-signal)" strokeWidth="2" />
      <path
        d="M386 150l-8 34 22-12 22 12-8-34"
        stroke="var(--illu-signal)"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="var(--illu-fill)"
      />
      <path d="M388 118l8 8 16-16" stroke="var(--illu-signal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <text x="16" y="244" {...LABEL}>
        {labels.module1}
      </text>
      <text x="132" y="180" {...LABEL}>
        {labels.module2}
      </text>
      <text x="280" y="244" textAnchor="middle" {...LABEL}>
        {labels.quiz}
      </text>
      <text x="400" y="72" textAnchor="middle" {...LABEL}>
        {labels.certificate}
      </text>
      <rect x="340" y="200" width="120" height="22" rx="11" fill="var(--illu-fill)" stroke="var(--illu-stroke-soft)" />
      <text x="400" y="215" textAnchor="middle" {...TEXT} fontSize={10}>
        {labels.verifiable}
      </text>
    </IllustrationSvg>
  );
}
