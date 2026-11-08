"""AI maturity questionnaire (TASK-089), versioned in code and reviewed in pull requests.

Five dimensions of four questions; each question has four answers scored 0 to 3. Profile
questions are not scored. Each diagnostic stores the version it was answered with: change
the version whenever questions, answers or scores change.
"""

from dataclasses import dataclass
from typing import Literal

VERSION = "2026-11"
Locale = Literal["fr", "en"]


@dataclass(frozen=True)
class Text:
    fr: str
    en: str

    def get(self, locale: Locale) -> str:
        return self.fr if locale == "fr" else self.en


@dataclass(frozen=True)
class Option:
    id: str
    label: Text
    score: int


@dataclass(frozen=True)
class Question:
    id: str
    label: Text
    options: tuple[Option, ...]


@dataclass(frozen=True)
class Dimension:
    id: str
    label: Text
    description: Text
    questions: tuple[Question, ...]


def _q(qid: str, fr: str, en: str, answers: list[tuple[str, str]]) -> Question:
    """Four answers, from the least to the most mature (scores 0 to 3)."""
    assert len(answers) == 4
    return Question(
        id=qid,
        label=Text(fr, en),
        options=tuple(
            Option(f"{qid}.{i}", Text(a_fr, a_en), i) for i, (a_fr, a_en) in enumerate(answers)
        ),
    )


DIMENSIONS: tuple[Dimension, ...] = (
    Dimension(
        "strategy",
        Text("Stratégie et cas d'usage", "Strategy and use cases"),
        Text(
            "La place de l'IA dans vos objectifs et vos priorités.",
            "How AI fits your goals and priorities.",
        ),
        (
            _q(
                "strategy.vision",
                "L'IA fait-elle partie de la stratégie de votre organisation ?",
                "Is AI part of your organization's strategy?",
                [
                    ("Pas encore abordée", "Not discussed yet"),
                    ("Évoquée, sans plan précis", "Mentioned, without a clear plan"),
                    (
                        "Objectifs définis pour certains métiers",
                        "Goals set for some business areas",
                    ),
                    (
                        "Feuille de route IA portée par la direction",
                        "AI roadmap owned by leadership",
                    ),
                ],
            ),
            _q(
                "strategy.use_cases",
                "Avez-vous identifié des cas d'usage de l'IA ?",
                "Have you identified AI use cases?",
                [
                    ("Aucun pour l'instant", "None so far"),
                    ("Quelques idées, non évaluées", "A few ideas, not assessed"),
                    ("Cas d'usage priorisés selon leur valeur", "Use cases prioritized by value"),
                    (
                        "Portefeuille de cas d'usage suivi et mesuré",
                        "Portfolio of use cases tracked and measured",
                    ),
                ],
            ),
            _q(
                "strategy.budget",
                "Quels moyens consacrez-vous à l'IA ?",
                "What resources do you dedicate to AI?",
                [
                    ("Aucun budget", "No budget"),
                    ("Un budget ponctuel pour des tests", "A one-off budget for trials"),
                    ("Un budget annuel dédié", "A dedicated annual budget"),
                    (
                        "Un investissement pluriannuel, avec suivi du retour",
                        "A multi-year investment, with return tracking",
                    ),
                ],
            ),
            _q(
                "strategy.measure",
                "Mesurez-vous les résultats de vos initiatives IA ?",
                "Do you measure the results of your AI initiatives?",
                [
                    ("Pas encore d'initiative", "No initiative yet"),
                    ("Pas de mesure", "No measurement"),
                    ("Des indicateurs pour certains projets", "Indicators for some projects"),
                    (
                        "Des indicateurs de valeur suivis systématiquement",
                        "Value indicators tracked systematically",
                    ),
                ],
            ),
        ),
    ),
    Dimension(
        "data",
        Text("Données", "Data"),
        Text(
            "La disponibilité, la qualité et l'encadrement de vos données.",
            "Availability, quality and control of your data.",
        ),
        (
            _q(
                "data.access",
                "Vos données utiles sont-elles accessibles ?",
                "Is your useful data accessible?",
                [
                    (
                        "Dispersées (fichiers, e-mails, outils isolés)",
                        "Scattered (files, emails, isolated tools)",
                    ),
                    ("Centralisées en partie", "Partly centralized"),
                    (
                        "Majoritairement centralisées et documentées",
                        "Mostly centralized and documented",
                    ),
                    (
                        "Plateforme de données gouvernée et à jour",
                        "Governed, up-to-date data platform",
                    ),
                ],
            ),
            _q(
                "data.quality",
                "Comment jugez-vous la qualité de vos données ?",
                "How do you rate the quality of your data?",
                [
                    ("Inconnue ou faible", "Unknown or poor"),
                    ("Variable selon les sources", "Uneven across sources"),
                    ("Bonne, avec des contrôles ponctuels", "Good, with occasional checks"),
                    (
                        "Contrôlée en continu, avec des responsables identifiés",
                        "Continuously checked, with named owners",
                    ),
                ],
            ),
            _q(
                "data.documents",
                "Vos documents (contrats, procédures, offres) sont-ils exploitables ?",
                "Can your documents (contracts, procedures, offers) be used?",
                [
                    ("Sur papier ou non classés", "On paper or unsorted"),
                    ("Numérisés mais dispersés", "Digitized but scattered"),
                    ("Classés dans des outils partagés", "Organized in shared tools"),
                    ("Structurés, indexés et à jour", "Structured, indexed and up to date"),
                ],
            ),
            _q(
                "data.rules",
                "Savez-vous quelles données peuvent être confiées à une IA ?",
                "Do you know which data may be entrusted to an AI?",
                [
                    ("Aucune règle", "No rule"),
                    ("Des règles informelles", "Informal rules"),
                    ("Une classification des données définie", "A defined data classification"),
                    (
                        "Une classification appliquée et contrôlée (RGPD, confidentialité)",
                        "A classification applied and checked (GDPR, confidentiality)",
                    ),
                ],
            ),
        ),
    ),
    Dimension(
        "technology",
        Text("Technologie et outils", "Technology and tools"),
        Text(
            "Vos outils, votre système d'information et son ouverture.",
            "Your tools, your information system and how open it is.",
        ),
        (
            _q(
                "technology.tools",
                "Utilisez-vous déjà des outils d'IA ?",
                "Do you already use AI tools?",
                [
                    ("Aucun", "None"),
                    ("Des usages individuels, non encadrés", "Individual, unmanaged use"),
                    (
                        "Des outils fournis et encadrés par l'organisation",
                        "Tools provided and managed by the organization",
                    ),
                    (
                        "Des solutions IA intégrées aux processus métiers",
                        "AI solutions built into business processes",
                    ),
                ],
            ),
            _q(
                "technology.integration",
                "Votre système d'information permet-il d'intégrer de nouveaux outils ?",
                "Can your information system integrate new tools?",
                [
                    ("Difficilement", "With difficulty"),
                    ("Au cas par cas", "Case by case"),
                    ("Oui, grâce à des connecteurs (API)", "Yes, through connectors (APIs)"),
                    (
                        "Oui : architecture ouverte et automatisée",
                        "Yes: open and automated architecture",
                    ),
                ],
            ),
            _q(
                "technology.automation",
                "Vos tâches répétitives sont-elles automatisées ?",
                "Are your repetitive tasks automated?",
                [
                    ("Peu ou pas", "Little or not at all"),
                    ("Quelques automatisations simples", "A few simple automations"),
                    ("Plusieurs processus automatisés", "Several processes automated"),
                    ("Automatisation généralisée et pilotée", "Widespread, managed automation"),
                ],
            ),
            _q(
                "technology.security",
                "La sécurité de vos outils numériques est-elle maîtrisée ?",
                "Is the security of your digital tools under control?",
                [
                    ("Peu de mesures", "Few measures"),
                    ("Des mesures de base", "Basic measures"),
                    ("Une politique de sécurité appliquée", "An applied security policy"),
                    (
                        "Une sécurité pilotée (audits, accès, journalisation)",
                        "Managed security (audits, access, logging)",
                    ),
                ],
            ),
        ),
    ),
    Dimension(
        "skills",
        Text("Compétences et organisation", "Skills and organization"),
        Text(
            "Les connaissances de vos équipes et le portage des projets.",
            "Your teams' knowledge and who drives projects.",
        ),
        (
            _q(
                "skills.awareness",
                "Vos équipes connaissent-elles les possibilités et les limites de l'IA ?",
                "Do your teams know what AI can and cannot do?",
                [
                    ("Peu", "Hardly"),
                    ("Quelques personnes curieuses", "A few curious people"),
                    ("Une sensibilisation organisée", "Organized awareness sessions"),
                    (
                        "Des formations régulières, adaptées aux métiers",
                        "Regular training, tailored to each job",
                    ),
                ],
            ),
            _q(
                "skills.expertise",
                "Disposez-vous de compétences pour mener des projets IA ?",
                "Do you have the skills to run AI projects?",
                [
                    ("Aucune", "None"),
                    ("Ponctuelles ou externes", "Occasional or external"),
                    ("Des référents IA identifiés", "Identified AI champions"),
                    ("Une équipe ou un partenaire dédié", "A dedicated team or partner"),
                ],
            ),
            _q(
                "skills.adoption",
                "Comment vos équipes accueillent-elles l'IA ?",
                "How do your teams welcome AI?",
                [
                    ("Avec inquiétude ou rejet", "With concern or rejection"),
                    ("Avec attentisme", "Wait and see"),
                    (
                        "Avec intérêt, et des initiatives locales",
                        "With interest, and local initiatives",
                    ),
                    (
                        "Avec adhésion et partage des bonnes pratiques",
                        "With buy-in and shared good practices",
                    ),
                ],
            ),
            _q(
                "skills.sponsor",
                "Qui porte les sujets IA ?",
                "Who drives AI topics?",
                [
                    ("Personne", "Nobody"),
                    ("Une personne motivée, sans mandat", "A motivated person, without a mandate"),
                    ("Un responsable désigné", "An appointed lead"),
                    (
                        "La direction, avec une gouvernance claire",
                        "Leadership, with clear governance",
                    ),
                ],
            ),
        ),
    ),
    Dimension(
        "governance",
        Text("Gouvernance et éthique", "Governance and ethics"),
        Text(
            "Les règles, la conformité et la maîtrise des risques.",
            "Rules, compliance and risk control.",
        ),
        (
            _q(
                "governance.policy",
                "Existe-t-il une charte d'usage de l'IA ?",
                "Is there an AI use policy?",
                [
                    ("Non", "No"),
                    ("En réflexion", "Being considered"),
                    ("Rédigée et diffusée", "Written and shared"),
                    ("Appliquée et mise à jour", "Applied and kept up to date"),
                ],
            ),
            _q(
                "governance.regulation",
                "Suivez-vous les obligations réglementaires (AI Act, RGPD) ?",
                "Do you follow regulatory obligations (AI Act, GDPR)?",
                [
                    ("Non", "No"),
                    ("Une veille ponctuelle", "Occasional monitoring"),
                    (
                        "Obligations identifiées pour nos usages",
                        "Obligations identified for our uses",
                    ),
                    ("Conformité organisée et documentée", "Organized, documented compliance"),
                ],
            ),
            _q(
                "governance.risks",
                "Évaluez-vous les risques des usages de l'IA (erreurs, biais, confidentialité) ?",
                "Do you assess the risks of AI use (errors, bias, confidentiality)?",
                [
                    ("Non", "No"),
                    ("Au cas par cas", "Case by case"),
                    ("Avant chaque projet", "Before each project"),
                    (
                        "En continu, avec un contrôle humain défini",
                        "Continuously, with defined human oversight",
                    ),
                ],
            ),
            _q(
                "governance.vendors",
                "Comment choisissez-vous vos fournisseurs d'IA ?",
                "How do you choose your AI vendors?",
                [
                    ("Sans critère particulier", "Without specific criteria"),
                    ("Sur le prix ou la notoriété", "On price or reputation"),
                    (
                        "Selon la sécurité et la localisation des données",
                        "On security and data location",
                    ),
                    (
                        "Par une évaluation formalisée et des contrats adaptés",
                        "Through a formal assessment and suitable contracts",
                    ),
                ],
            ),
        ),
    ),
)

# Profile (not scored): adapts the analysis and qualifies the lead.
PROFILE: dict[str, tuple[Text, tuple[tuple[str, Text], ...]]] = {
    "sector": (
        Text("Secteur d'activité", "Industry"),
        (
            ("industry", Text("Industrie", "Manufacturing")),
            ("services", Text("Services aux entreprises", "Business services")),
            ("retail", Text("Commerce et distribution", "Retail and distribution")),
            ("health", Text("Santé et social", "Health and social care")),
            ("finance", Text("Banque, assurance, finance", "Banking, insurance, finance")),
            ("public", Text("Secteur public, associations", "Public sector, non-profits")),
            ("other", Text("Autre", "Other")),
        ),
    ),
    "size": (
        Text("Taille de l'organisation", "Organization size"),
        (
            ("1-9", Text("1 à 9 personnes", "1 to 9 people")),
            ("10-49", Text("10 à 49 personnes", "10 to 49 people")),
            ("50-249", Text("50 à 249 personnes", "50 to 249 people")),
            ("250-999", Text("250 à 999 personnes", "250 to 999 people")),
            ("1000+", Text("1 000 personnes et plus", "1,000 people or more")),
        ),
    ),
    "role": (
        Text("Votre fonction", "Your role"),
        (
            ("executive", Text("Direction générale", "Executive management")),
            ("business", Text("Direction métier", "Business management")),
            ("it", Text("DSI, numérique, données", "IT, digital, data")),
            ("other", Text("Autre", "Other")),
        ),
    ),
}

QUESTIONS: dict[str, Question] = {q.id: q for d in DIMENSIONS for q in d.questions}
OPTIONS: dict[str, Option] = {o.id: o for q in QUESTIONS.values() for o in q.options}
MAX_SCORE = 3
