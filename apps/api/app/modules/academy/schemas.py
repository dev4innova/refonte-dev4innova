import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, StringConstraints, field_validator, model_validator

Locale = Literal["fr", "en"]
Level = Literal["beginner", "intermediate", "advanced"]
Visibility = Literal["public", "restricted"]
Status = Literal["draft", "published"]
Direction = Literal["up", "down"]

SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


def _text(max_length: int) -> Any:
    return Annotated[str, StringConstraints(strip_whitespace=True, max_length=max_length)]


class AcademyTitle(BaseModel):
    """A text in each language; French is the reference, English is needed to publish."""

    fr: _text(200) = ""  # type: ignore[valid-type]
    en: _text(200) = ""  # type: ignore[valid-type]


class AcademySummary(BaseModel):
    fr: _text(600) = ""  # type: ignore[valid-type]
    en: _text(600) = ""  # type: ignore[valid-type]


class AcademyBody(BaseModel):
    fr: _text(50_000) = ""  # type: ignore[valid-type]
    en: _text(50_000) = ""  # type: ignore[valid-type]


class AcademyOption(BaseModel):
    fr: _text(300) = ""  # type: ignore[valid-type]
    en: _text(300) = ""  # type: ignore[valid-type]


class AcademyPerson(BaseModel):
    id: uuid.UUID
    display_name: str | None
    email: str | None


class AcademyOrganization(BaseModel):
    id: uuid.UUID
    name: str
    slug: str


# --- Public catalog (TASK-103) ---------------------------------------------------------


class CourseCard(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    summary: str
    level: Level
    duration_minutes: int
    modules: int
    lessons: int
    quizzes: int


class LessonOutline(BaseModel):
    id: uuid.UUID
    title: str
    duration_minutes: int
    has_video: bool


class ModuleOutline(BaseModel):
    id: uuid.UUID
    title: str
    summary: str
    lessons: list[LessonOutline]
    questions: int


class CourseOutline(CourseCard):
    description_html: str
    visibility: Visibility
    outline: list[ModuleOutline]


# --- Learners (TASK-106 to TASK-109) ---------------------------------------------------


class CourseProgress(BaseModel):
    lessons_done: int
    lessons_total: int
    quizzes_passed: int
    quizzes_total: int
    percent: int


class MyCourse(BaseModel):
    course: CourseCard
    progress: CourseProgress
    sponsor: AcademyOrganization | None
    enrolled_at: datetime
    last_activity_at: datetime
    completed_at: datetime | None
    certificate_code: str | None


class LearnerLesson(LessonOutline):
    done: bool


class LearnerModule(BaseModel):
    id: uuid.UUID
    title: str
    summary: str
    lessons: list[LearnerLesson]
    questions: int
    best_score: int | None
    quiz_passed: bool


class LearnerCourse(MyCourse):
    description_html: str
    outline: list[LearnerModule]
    pass_percent: int
    next_lesson_id: uuid.UUID | None


class LessonView(BaseModel):
    id: uuid.UUID
    course_slug: str
    course_title: str
    module_id: uuid.UUID
    module_title: str
    title: str
    body_html: str
    video_url: str | None
    duration_minutes: int
    done: bool
    previous_lesson_id: uuid.UUID | None
    next_lesson_id: uuid.UUID | None
    module_has_quiz: bool
    """The quiz of the module comes after its last lesson."""


class QuizQuestion(BaseModel):
    id: uuid.UUID
    prompt: str
    options: list[str]


class QuizView(BaseModel):
    module_id: uuid.UUID
    course_slug: str
    course_title: str
    module_title: str
    questions: list[QuizQuestion]
    pass_percent: int
    best_score: int | None
    passed: bool


class QuizSubmission(BaseModel):
    answers: dict[uuid.UUID, int] = Field(max_length=200)


class QuestionResult(BaseModel):
    question_id: uuid.UUID
    chosen: int | None
    correct_option: int
    correct: bool
    explanation: str


class QuizResult(BaseModel):
    score: int
    passed: bool
    pass_percent: int
    results: list[QuestionResult]
    course_completed: bool
    certificate_code: str | None


class LessonDone(BaseModel):
    progress: CourseProgress
    course_completed: bool
    certificate_code: str | None


class CertificateOut(BaseModel):
    code: str
    learner_name: str
    course_title: str
    course_slug: str | None
    duration_minutes: int
    issued_at: datetime
    valid: bool


# --- Organizations (follow-up of sponsored learners) -----------------------------------


class SponsoredEnrollment(BaseModel):
    id: uuid.UUID
    learner: AcademyPerson
    course: CourseCard
    progress: CourseProgress
    enrolled_at: datetime
    last_activity_at: datetime
    completed_at: datetime | None
    certificate_code: str | None


# --- Back office (TASK-103 to TASK-105, TASK-108) --------------------------------------


class CourseIn(BaseModel):
    slug: Annotated[
        str,
        StringConstraints(
            strip_whitespace=True, pattern=SLUG_PATTERN, min_length=2, max_length=120
        ),
    ]
    visibility: Visibility = "public"
    level: Level = "beginner"
    duration_minutes: int = Field(default=0, ge=0, le=100_000)
    title: AcademyTitle
    summary: AcademySummary = Field(default_factory=AcademySummary)
    description_md: AcademyBody = Field(default_factory=AcademyBody)

    @field_validator("title")
    @classmethod
    def _french_title(cls, value: Any) -> Any:
        if not value.fr:
            raise ValueError("The French title is required")
        return value


class ModuleIn(BaseModel):
    title: AcademyTitle
    summary: AcademySummary = Field(default_factory=AcademySummary)

    @field_validator("title")
    @classmethod
    def _french_title(cls, value: Any) -> Any:
        if not value.fr:
            raise ValueError("The French title is required")
        return value


class LessonIn(BaseModel):
    title: AcademyTitle
    body_md: AcademyBody = Field(default_factory=AcademyBody)
    video_url: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = (
        None
    )
    duration_minutes: int = Field(default=5, ge=1, le=600)

    @field_validator("title")
    @classmethod
    def _french_title(cls, value: Any) -> Any:
        if not value.fr:
            raise ValueError("The French title is required")
        return value


class QuestionIn(BaseModel):
    prompt: AcademySummary
    options: list[AcademyOption] = Field(min_length=2, max_length=6)
    correct_option: int = Field(ge=0)
    explanation: AcademySummary = Field(default_factory=AcademySummary)

    @model_validator(mode="after")
    def _check(self) -> "QuestionIn":
        if not self.prompt.fr:
            raise ValueError("The French question is required")
        if any(not option.fr for option in self.options):
            raise ValueError("Every answer needs a French text")
        if self.correct_option >= len(self.options):
            raise ValueError("The right answer must be one of the options")
        return self


class Move(BaseModel):
    direction: Direction


class AdminLesson(BaseModel):
    id: uuid.UUID
    module_id: uuid.UUID
    position: int
    title: dict[str, str]
    body_md: dict[str, str]
    video_url: str | None
    duration_minutes: int


class AdminQuestion(BaseModel):
    id: uuid.UUID
    module_id: uuid.UUID
    position: int
    prompt: dict[str, str]
    options: list[dict[str, str]]
    correct_option: int
    explanation: dict[str, str]


class AdminModule(BaseModel):
    id: uuid.UUID
    position: int
    title: dict[str, str]
    summary: dict[str, str]
    lessons: list[AdminLesson]
    questions: list[AdminQuestion]


class MissingItem(BaseModel):
    """Something to write before publishing: `ref` is "2" (module 2) or "2.1" (its first lesson
    or question); `field` names the text (English unless body_fr) or an empty part."""

    kind: Literal["course", "module", "lesson", "question"]
    ref: str | None
    field: str


class AdminCourseSummary(BaseModel):
    id: uuid.UUID
    slug: str
    status: Status
    visibility: Visibility
    level: Level
    title: dict[str, str]
    modules: int
    lessons: int
    enrollments: int
    completions: int
    updated_at: datetime


class AdminCourse(AdminCourseSummary):
    duration_minutes: int
    summary: dict[str, str]
    description_md: dict[str, str]
    published_at: datetime | None
    outline: list[AdminModule]
    missing: list[MissingItem]
    """What prevents publication (missing English texts, empty course...)."""


class EnrollIn(BaseModel):
    organization_id: uuid.UUID
    user_ids: list[uuid.UUID] = Field(min_length=1, max_length=500)


class EnrollResult(BaseModel):
    enrolled: int
    already: int


class AdminEnrollment(SponsoredEnrollment):
    sponsor: AcademyOrganization | None


class OrganizationMember(BaseModel):
    id: uuid.UUID
    display_name: str | None
    email: str | None
    enrolled: bool
