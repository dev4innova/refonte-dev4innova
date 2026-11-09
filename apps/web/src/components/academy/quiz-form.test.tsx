import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { axeViolations } from "@/test/axe";

import messages from "../../../messages/fr.json";

import { QuizForm } from "./quiz-form";

const submitQuiz = vi.fn();
vi.mock("@/app/[locale]/account/academy/actions", () => ({ submitQuiz: (...args: unknown[]) => submitQuiz(...args) }));
vi.mock("@/i18n/navigation", async () => {
  const { mockI18nNavigation } = await import("@/test/i18n-navigation");
  return mockI18nNavigation(() => "/account/academy");
});

const quiz = {
  module_id: "m",
  course_slug: "ia",
  course_title: "IA",
  module_title: "Les bases",
  pass_percent: 70,
  best_score: null,
  passed: false,
  questions: [
    { id: "q1", prompt: "Un LLM prédit…", options: ["Une image", "Le mot suivant"] },
    { id: "q2", prompt: "Une hallucination est…", options: ["Une invention", "Un bug"] },
  ],
};

function renderQuiz() {
  return render(
    <NextIntlClientProvider locale="fr" messages={{ Academy: messages.Academy }}>
      <QuizForm quiz={quiz} locale="fr" />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("QuizForm", () => {
  it("is an accessible group of radio buttons per question", async () => {
    const { container } = renderQuiz();
    expect(screen.getByRole("group", { name: /Un LLM prédit/ })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("warns about unanswered questions before sending", async () => {
    const user = userEvent.setup();
    renderQuiz();
    await user.click(screen.getByRole("radio", { name: "Le mot suivant" }));
    await user.click(screen.getByRole("button", { name: "Valider mes réponses" }));
    expect(screen.getByRole("alert")).toHaveTextContent("1 question est restée sans réponse");
    expect(submitQuiz).not.toHaveBeenCalled();
    submitQuiz.mockResolvedValue({
      ok: true,
      data: {
        score: 50,
        passed: false,
        pass_percent: 70,
        course_completed: false,
        certificate_code: null,
        results: [
          { question_id: "q1", chosen: 1, correct_option: 1, correct: true, explanation: "" },
          { question_id: "q2", chosen: null, correct_option: 0, correct: false, explanation: "Elle invente." },
        ],
      },
    });
    await user.click(screen.getByRole("button", { name: "Valider quand même" }));
    expect(submitQuiz).toHaveBeenCalledWith("m", { q1: 1 }, "fr");
    expect(await screen.findByRole("status")).toHaveTextContent("Score : 50 %");
    expect(screen.getByText("Bonne réponse : Une invention")).toBeInTheDocument();
    expect(screen.getByText("Elle invente.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Recommencer" }));
    expect(screen.getAllByRole("radio").every((r) => !(r as HTMLInputElement).checked)).toBe(true);
  });
});
