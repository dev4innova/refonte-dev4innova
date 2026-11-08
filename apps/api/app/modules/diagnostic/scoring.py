"""Scoring engine (TASK-090) and recommendations (TASK-091). Deterministic and explainable:
a dimension score is the share of the maximum points (0-100); the overall score is the mean
of the five dimensions (equal weights); the maturity level follows fixed bands."""

from dataclasses import dataclass
from typing import Literal

from app.modules.diagnostic.questionnaire import DIMENSIONS, MAX_SCORE, OPTIONS, QUESTIONS, Text

Level = Literal["discovery", "experimentation", "structuring", "transformation"]
Horizon = Literal["quick_win", "short_term", "mid_term"]

LEVELS: tuple[tuple[int, Level, Text, Text], ...] = (
    (
        0,
        "discovery",
        Text("Découverte", "Discovery"),
        Text(
            "L'IA est encore peu présente : le moment est idéal pour poser des bases solides et choisir des premiers cas d'usage simples.",
            "AI is still barely present: it is the right time to lay solid foundations and pick simple first use cases.",
        ),
    ),
    (
        25,
        "experimentation",
        Text("Expérimentation", "Experimentation"),
        Text(
            "Des initiatives existent, souvent isolées : il s'agit maintenant de les cadrer, de les mesurer et de les partager.",
            "Initiatives exist, often isolated: the next step is to frame them, measure them and share them.",
        ),
    ),
    (
        50,
        "structuring",
        Text("Structuration", "Structuring"),
        Text(
            "Les fondations sont en place : vous pouvez industrialiser les cas d'usage qui fonctionnent et les étendre.",
            "The foundations are in place: you can industrialize the use cases that work and extend them.",
        ),
    ),
    (
        75,
        "transformation",
        Text("Transformation", "Transformation"),
        Text(
            "L'IA est un levier piloté de votre organisation : l'enjeu est de garder l'avance et de maîtriser les risques à l'échelle.",
            "AI is a managed lever of your organization: the challenge is to stay ahead and control risks at scale.",
        ),
    ),
)


def level_for(score: int) -> Level:
    current: Level = "discovery"
    for threshold, level, _, _ in LEVELS:
        if score >= threshold:
            current = level
    return current


def level_texts(level: Level) -> tuple[Text, Text]:
    for _, key, label, description in LEVELS:
        if key == level:
            return label, description
    raise KeyError(level)


class InvalidAnswersError(ValueError):
    def __init__(self, missing: list[str], invalid: list[str]) -> None:
        super().__init__("Invalid answers")
        self.missing = missing
        self.invalid = invalid


def validate(answers: dict[str, str]) -> None:
    """Every question answered once, with one of its own options."""
    missing = [qid for qid in QUESTIONS if qid not in answers]
    invalid = [
        qid
        for qid, option in answers.items()
        if qid not in QUESTIONS or option not in OPTIONS or not option.startswith(f"{qid}.")
    ]
    if missing or invalid:
        raise InvalidAnswersError(missing, invalid)


@dataclass(frozen=True)
class Scores:
    dimensions: dict[str, int]
    overall: int
    level: Level


def score(answers: dict[str, str]) -> Scores:
    validate(answers)
    dimensions = {}
    for dimension in DIMENSIONS:
        points = sum(OPTIONS[answers[q.id]].score for q in dimension.questions)
        dimensions[dimension.id] = round(100 * points / (MAX_SCORE * len(dimension.questions)))
    overall = round(sum(dimensions.values()) / len(dimensions))
    return Scores(dimensions=dimensions, overall=overall, level=level_for(overall))


# --- Recommendations (TASK-091) ------------------------------------------------------


@dataclass(frozen=True)
class Recommendation:
    id: str
    dimension: str
    title: Text
    text: Text
    horizon: Horizon
    service: str
    """Slug of the DEV4INNOVA service (CMS) that helps with it."""


def _r(
    rid: str,
    dimension: str,
    horizon: Horizon,
    service: str,
    title: tuple[str, str],
    text: tuple[str, str],
) -> Recommendation:
    return Recommendation(rid, dimension, Text(*title), Text(*text), horizon, service)


# For each dimension: what to do when it is low (score < 50), then when it is solid.
CATALOG: dict[str, tuple[tuple[Recommendation, ...], tuple[Recommendation, ...]]] = {
    "strategy": (
        (
            _r(
                "strategy.workshop",
                "strategy",
                "quick_win",
                "ai-strategy",
                (
                    "Organiser un atelier d'identification des cas d'usage",
                    "Run a use case discovery workshop",
                ),
                (
                    "Réunissez direction et métiers une demi-journée pour lister les irritants et les tâches à faible valeur, puis retenez 3 cas d'usage simples à fort impact.",
                    "Bring leadership and business teams together for half a day to list pain points and low-value tasks, then pick 3 simple, high-impact use cases.",
                ),
            ),
            _r(
                "strategy.roadmap",
                "strategy",
                "short_term",
                "ai-strategy",
                ("Bâtir une feuille de route IA sur 12 mois", "Build a 12-month AI roadmap"),
                (
                    "Priorisez les cas d'usage selon leur valeur, leur faisabilité et leurs risques, avec un budget et des indicateurs de réussite pour chacun.",
                    "Prioritize use cases by value, feasibility and risk, with a budget and success indicators for each.",
                ),
            ),
        ),
        (
            _r(
                "strategy.portfolio",
                "strategy",
                "mid_term",
                "ai-strategy",
                ("Piloter un portefeuille de cas d'usage", "Manage a use case portfolio"),
                (
                    "Suivez la valeur produite par chaque solution, arrêtez ce qui ne fonctionne pas et réinvestissez dans ce qui crée de la valeur.",
                    "Track the value of each solution, stop what does not work and reinvest in what creates value.",
                ),
            ),
        ),
    ),
    "data": (
        (
            _r(
                "data.inventory",
                "data",
                "quick_win",
                "integration-deployment",
                ("Cartographier vos données et documents clés", "Map your key data and documents"),
                (
                    "Recensez où se trouvent les données et documents utiles à vos cas d'usage prioritaires, qui en est responsable et dans quel état ils sont.",
                    "List where the data and documents useful to your priority use cases are, who owns them and what state they are in.",
                ),
            ),
            _r(
                "data.classification",
                "data",
                "short_term",
                "ai-strategy",
                (
                    "Définir ce qui peut être confié à une IA",
                    "Define what may be entrusted to an AI",
                ),
                (
                    "Classez vos données (publiques, internes, confidentielles, personnelles) et fixez pour chaque niveau les outils autorisés.",
                    "Classify your data (public, internal, confidential, personal) and set the allowed tools for each level.",
                ),
            ),
        ),
        (
            _r(
                "data.knowledge_base",
                "data",
                "mid_term",
                "custom-development",
                (
                    "Créer une base de connaissances interrogeable",
                    "Build a searchable knowledge base",
                ),
                (
                    "Vos documents structurés peuvent alimenter un assistant interne qui répond en citant ses sources, avec des droits d'accès respectés.",
                    "Your structured documents can feed an internal assistant that answers with sources, respecting access rights.",
                ),
            ),
        ),
    ),
    "technology": (
        (
            _r(
                "technology.approved_tools",
                "technology",
                "quick_win",
                "integration-deployment",
                (
                    "Fournir un outil d'IA encadré à vos équipes",
                    "Give your teams a managed AI tool",
                ),
                (
                    "Plutôt que des usages individuels non maîtrisés, mettez à disposition un assistant sécurisé, avec des règles claires et une protection des données.",
                    "Instead of unmanaged individual use, provide a secure assistant with clear rules and data protection.",
                ),
            ),
            _r(
                "technology.pilot",
                "technology",
                "short_term",
                "custom-development",
                ("Lancer un pilote sur un processus précis", "Run a pilot on a specific process"),
                (
                    "Automatisez un traitement répétitif (courriels, documents, saisie) sur un périmètre limité, mesurez le temps gagné, puis décidez de l'étendre.",
                    "Automate a repetitive task (emails, documents, data entry) on a limited scope, measure the time saved, then decide whether to extend it.",
                ),
            ),
        ),
        (
            _r(
                "technology.integration",
                "technology",
                "mid_term",
                "integration-deployment",
                (
                    "Intégrer l'IA au cœur de vos outils métiers",
                    "Integrate AI into your business tools",
                ),
                (
                    "Connectez l'IA à vos applications (CRM, ERP, GED) par des API pour supprimer les ressaisies et fiabiliser les processus.",
                    "Connect AI to your applications (CRM, ERP, document management) through APIs to remove re-keying and secure processes.",
                ),
            ),
        ),
    ),
    "skills": (
        (
            _r(
                "skills.awareness",
                "skills",
                "quick_win",
                "training-support",
                ("Sensibiliser toutes les équipes", "Raise awareness across all teams"),
                (
                    "Une session courte sur les usages, les limites et les bons réflexes (vérification, confidentialité) lève les craintes et fait émerger des idées.",
                    "A short session on uses, limits and good habits (checking, confidentiality) eases concerns and brings out ideas.",
                ),
            ),
            _r(
                "skills.champions",
                "skills",
                "short_term",
                "training-support",
                ("Désigner et former des référents IA", "Appoint and train AI champions"),
                (
                    "Un référent par service, formé et disposant de temps, accompagne ses collègues et remonte les cas d'usage.",
                    "One champion per team, trained and given time, supports colleagues and reports use cases.",
                ),
            ),
        ),
        (
            _r(
                "skills.academy",
                "skills",
                "mid_term",
                "training-support",
                (
                    "Mettre en place des parcours de formation métiers",
                    "Set up job-specific learning paths",
                ),
                (
                    "Des formations adaptées à chaque métier entretiennent la montée en compétences au rythme des nouveaux outils.",
                    "Training tailored to each job keeps skills growing at the pace of new tools.",
                ),
            ),
        ),
    ),
    "governance": (
        (
            _r(
                "governance.policy",
                "governance",
                "quick_win",
                "ai-strategy",
                ("Rédiger une charte d'usage de l'IA", "Write an AI use policy"),
                (
                    "Une page suffit pour commencer : outils autorisés, données interdites, vérification humaine obligatoire, personne à contacter.",
                    "One page is enough to start: allowed tools, forbidden data, mandatory human review, who to contact.",
                ),
            ),
            _r(
                "governance.compliance",
                "governance",
                "short_term",
                "ai-strategy",
                (
                    "Identifier vos obligations (AI Act, RGPD)",
                    "Identify your obligations (AI Act, GDPR)",
                ),
                (
                    "Classez vos usages selon le niveau de risque de l'AI Act et vérifiez les bases légales des données personnelles traitées.",
                    "Classify your uses by AI Act risk level and check the legal bases of the personal data processed.",
                ),
            ),
        ),
        (
            _r(
                "governance.monitoring",
                "governance",
                "mid_term",
                "run-and-improve",
                ("Suivre vos solutions IA dans la durée", "Monitor your AI solutions over time"),
                (
                    "Contrôlez régulièrement la qualité des réponses, les coûts et les incidents, avec une supervision humaine définie.",
                    "Regularly check answer quality, costs and incidents, with defined human oversight.",
                ),
            ),
        ),
    ),
}


def recommendations(dimensions: dict[str, int]) -> list[Recommendation]:
    """Weakest dimensions first; low dimensions get their foundations, solid ones the next step."""
    ordered = sorted(dimensions.items(), key=lambda item: (item[1], item[0]))
    result: list[Recommendation] = []
    for dimension, value in ordered:
        low, high = CATALOG[dimension]
        result.extend(low if value < 50 else high)
    return result


def priorities(dimensions: dict[str, int], count: int = 3) -> list[Recommendation]:
    """The first recommendation of each of the `count` weakest dimensions."""
    seen: set[str] = set()
    first: list[Recommendation] = []
    for recommendation in recommendations(dimensions):
        if recommendation.dimension not in seen:
            seen.add(recommendation.dimension)
            first.append(recommendation)
    return first[:count]
