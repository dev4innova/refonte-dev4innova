"""Shared helpers of the Academy: texts per language, video links, progress."""

import re
import uuid
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import parse_qs, urlparse

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.modules.academy.models import (
    Course,
    Enrollment,
    Lesson,
    LessonProgress,
    Module,
    Question,
    QuizAttempt,
)
from app.modules.academy.schemas import CourseCard, CourseProgress


class InvalidVideoError(AppError):
    status_code = 422
    code = "invalid_video"


def now() -> datetime:
    return datetime.now(UTC)


def text(value: dict[str, Any] | None, locale: str) -> str:
    """The text in the requested language, French otherwise."""
    value = value or {}
    return str(value.get(locale) or value.get("fr") or "")


def texts(value: Any) -> dict[str, str]:
    """Pydantic texts (fr, en) as stored."""
    return {"fr": value.fr, "en": value.en}


_YOUTUBE_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
_VIMEO_ID = re.compile(r"^\d{6,12}$")


def embed_url(url: str | None) -> str | None:
    """A YouTube or Vimeo link as a privacy-enhanced embed URL; other hosts are refused."""
    if not url:
        return None
    parsed = urlparse(url if "://" in url else f"https://{url}")
    host = (parsed.hostname or "").lower().removeprefix("www.").removeprefix("m.")
    parts = [p for p in parsed.path.split("/") if p]
    video: str | None = None
    if host in ("youtube.com", "youtube-nocookie.com"):
        if parts[:1] == ["watch"]:
            video = next(iter(parse_qs(parsed.query).get("v", [])), None)
        elif len(parts) >= 2 and parts[0] in ("embed", "shorts", "live"):
            video = parts[1]
        if video and _YOUTUBE_ID.match(video):
            return f"https://www.youtube-nocookie.com/embed/{video}"
    elif host == "youtu.be" and parts and _YOUTUBE_ID.match(parts[0]):
        return f"https://www.youtube-nocookie.com/embed/{parts[0]}"
    elif host == "vimeo.com" and parts and _VIMEO_ID.match(parts[-1]):
        return f"https://player.vimeo.com/video/{parts[-1]}?dnt=1"
    elif (
        host == "player.vimeo.com"
        and len(parts) == 2
        and parts[0] == "video"
        and _VIMEO_ID.match(parts[1])
    ):
        return f"https://player.vimeo.com/video/{parts[1]}?dnt=1"
    raise InvalidVideoError("Only YouTube or Vimeo videos can be embedded", {"field": "video_url"})


@dataclass(frozen=True)
class CourseStats:
    modules: int
    lessons: int
    quizzes: int
    """Modules with at least one question."""


async def course_stats(
    session: AsyncSession, course_ids: Iterable[uuid.UUID]
) -> dict[uuid.UUID, CourseStats]:
    ids = list(set(course_ids))
    if not ids:
        return {}
    modules = dict(
        (
            await session.execute(
                select(Module.course_id, func.count())
                .where(Module.course_id.in_(ids))
                .group_by(Module.course_id)
            )
        ).all()
    )
    lessons = dict(
        (
            await session.execute(
                select(Lesson.course_id, func.count())
                .where(Lesson.course_id.in_(ids))
                .group_by(Lesson.course_id)
            )
        ).all()
    )
    quizzes = dict(
        (
            await session.execute(
                select(Question.course_id, func.count(distinct(Question.module_id)))
                .where(Question.course_id.in_(ids))
                .group_by(Question.course_id)
            )
        ).all()
    )
    return {i: CourseStats(modules.get(i, 0), lessons.get(i, 0), quizzes.get(i, 0)) for i in ids}


def card(course: Course, stats: CourseStats, locale: str) -> CourseCard:
    return CourseCard(
        id=course.id,
        slug=course.slug,
        title=text(course.title, locale),
        summary=text(course.summary, locale),
        level=course.level,
        duration_minutes=course.duration_minutes,
        modules=stats.modules,
        lessons=stats.lessons,
        quizzes=stats.quizzes,
    )


async def progress(
    session: AsyncSession, enrollments: Sequence[Enrollment]
) -> dict[uuid.UUID, CourseProgress]:
    """Progress of each enrollment, in a fixed number of queries."""
    if not enrollments:
        return {}
    ids = [e.id for e in enrollments]
    stats = await course_stats(session, [e.course_id for e in enrollments])
    done = dict(
        (
            await session.execute(
                select(LessonProgress.enrollment_id, func.count())
                .where(LessonProgress.enrollment_id.in_(ids))
                .group_by(LessonProgress.enrollment_id)
            )
        ).all()
    )
    # A passed quiz counts while its module still has questions.
    with_questions = select(Question.module_id).distinct().scalar_subquery()
    passed = dict(
        (
            await session.execute(
                select(QuizAttempt.enrollment_id, func.count(distinct(QuizAttempt.module_id)))
                .where(
                    QuizAttempt.enrollment_id.in_(ids),
                    QuizAttempt.passed.is_(True),
                    QuizAttempt.module_id.in_(with_questions),
                )
                .group_by(QuizAttempt.enrollment_id)
            )
        ).all()
    )
    result = {}
    for enrollment in enrollments:
        s = stats[enrollment.course_id]
        lessons_done, quizzes_passed = done.get(enrollment.id, 0), passed.get(enrollment.id, 0)
        total = s.lessons + s.quizzes
        result[enrollment.id] = CourseProgress(
            lessons_done=lessons_done,
            lessons_total=s.lessons,
            quizzes_passed=quizzes_passed,
            quizzes_total=s.quizzes,
            percent=round(100 * (lessons_done + quizzes_passed) / total) if total else 0,
        )
    return result
