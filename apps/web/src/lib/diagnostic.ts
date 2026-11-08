import type { components } from "@dev4innova/api-client";

/* AI business diagnostic (EPIC 10): shared types and helpers (client and server). */

export type Questionnaire = components["schemas"]["QuestionnaireOut"];
export type DiagnosticResult = components["schemas"]["DiagnosticResult"];
export type Recommendation = components["schemas"]["RecommendationOut"];
export type DiagnosticSummary = components["schemas"]["DiagnosticSummary"];

export const UNLOCK_FIELDS = ["name", "email", "company", "consent"] as const;

export const HORIZONS = ["quick_win", "short_term", "mid_term"] as const;
export type Horizon = (typeof HORIZONS)[number];

/** Questions of a step that still have no answer. */
export function unanswered(questionIds: string[], answers: Record<string, string>): string[] {
  return questionIds.filter((id) => !answers[id]);
}

/** Polygon points of a radar chart (scores 0-100), starting at the top, clockwise. */
export function radarPoints(scores: number[], center: number, radius: number): string {
  return scores
    .map((score, index) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * index) / scores.length;
      const r = (radius * Math.max(0, Math.min(100, score))) / 100;
      return `${(center + r * Math.cos(angle)).toFixed(1)},${(center + r * Math.sin(angle)).toFixed(1)}`;
    })
    .join(" ");
}
