import type { getTranslations } from "next-intl/server";

import type { SignalToSystemLabels } from "./signal-to-system";
import type { SolutionIllustrationLabels } from "./solutions";
import type { AcademyPathLabels, LabBoardLabels } from "./worlds";

type IllustrationsTranslator = Awaited<ReturnType<typeof getTranslations<"Illustrations">>>;

export type IllustrationLabels = {
  signalToSystem: SignalToSystemLabels;
  solutions: SolutionIllustrationLabels;
  lab: LabBoardLabels;
  academy: AcademyPathLabels;
};

/** Translated labels of every illustration (namespace `Illustrations`, FR/EN). */
export function illustrationLabels(t: IllustrationsTranslator): IllustrationLabels {
  return {
    signalToSystem: {
      assistant: t("signalToSystem.assistant"),
      tool: t("signalToSystem.tool"),
      document: t("signalToSystem.document"),
      forecast: t("signalToSystem.forecast"),
    },
    solutions: {
      "ai-assistants": { action: t("solutions.ai-assistants.action") },
      "document-automation": {
        invoice: t("solutions.document-automation.invoice"),
        amount: t("solutions.document-automation.amount"),
      },
      "data-intelligence": { forecast: t("solutions.data-intelligence.forecast") },
      "generative-content": {
        validate: t("solutions.generative-content.validate"),
        tone: t("solutions.generative-content.tone"),
        formal: t("solutions.generative-content.formal"),
        direct: t("solutions.generative-content.direct"),
        languages: t("solutions.generative-content.languages"),
      },
      "ai-integration": {
        hub: t("solutions.ai-integration.hub"),
        tools: [
          t("solutions.ai-integration.tools.crm"),
          t("solutions.ai-integration.tools.erp"),
          t("solutions.ai-integration.tools.messaging"),
          t("solutions.ai-integration.tools.intranet"),
          t("solutions.ai-integration.tools.dms"),
          t("solutions.ai-integration.tools.calendar"),
        ],
      },
    },
    lab: { idea: t("lab.idea"), prototype: t("lab.prototype"), module: t("lab.module") },
    academy: {
      module1: t("academy.module1"),
      module2: t("academy.module2"),
      quiz: t("academy.quiz"),
      quizMark: t("academy.quizMark"),
      certificate: t("academy.certificate"),
      verifiable: t("academy.verifiable"),
    },
  };
}
