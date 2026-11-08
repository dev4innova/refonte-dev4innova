import { radarPoints } from "@/lib/diagnostic";

type Axis = { id: string; label: string; score: number };

/**
 * Radar chart of the five dimensions (decorative: the same figures are given as text next
 * to it, so it is hidden from assistive technologies).
 */
export function RadarChart({ axes, size = 320 }: { axes: Axis[]; size?: number }) {
  const center = size / 2;
  const radius = size / 2 - 64;
  const scores = axes.map((a) => a.score);
  const ring = (value: number) => radarPoints(axes.map(() => value), center, radius);
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${size} ${size}`} className="h-auto w-full max-w-sm text-foreground">
      {[25, 50, 75, 100].map((value) => (
        <polygon key={value} points={ring(value)} fill="none" stroke="currentColor" strokeOpacity={0.15} />
      ))}
      {axes.map((axis, index) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * index) / axes.length;
        const x = center + (radius + 14) * Math.cos(angle);
        const y = center + (radius + 14) * Math.sin(angle);
        const anchor = Math.abs(Math.cos(angle)) < 0.2 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
        return (
          <g key={axis.id}>
            <line x1={center} y1={center} x2={center + radius * Math.cos(angle)} y2={center + radius * Math.sin(angle)} stroke="currentColor" strokeOpacity={0.15} />
            <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" className="fill-current text-[11px]">
              {axis.score}
            </text>
          </g>
        );
      })}
      <polygon points={radarPoints(scores, center, radius)} fill="var(--primary)" fillOpacity={0.18} stroke="var(--primary)" strokeWidth={2} />
    </svg>
  );
}
