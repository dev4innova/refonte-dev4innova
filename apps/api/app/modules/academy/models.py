"""Academy models (TASK-103 to TASK-109).

Courses are DEV4INNOVA content: they belong to the internal organization, like the CMS.
Texts are stored per language in JSONB ({"fr": ..., "en": ...}); Markdown is rendered to
sanitized HTML when saved. Enrollments belong to their learner and, when the team enrolled
them for a client, name that sponsoring organization (whose owners and admins follow them).
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

COURSE_STATUSES = ("draft", "published")
VISIBILITIES = ("public", "restricted")
LEVELS = ("beginner", "intermediate", "advanced")
PASS_PERCENT = 70

I18n = dict[str, Any]


def _in(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{v}'" for v in values)


def _i18n() -> Mapped[I18n]:
    return mapped_column(JSONB, default=dict, server_default="{}")


class Course(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "academy_courses"
    __table_args__ = (
        CheckConstraint(f"status IN ({_in(COURSE_STATUSES)})", name="status"),
        CheckConstraint(f"visibility IN ({_in(VISIBILITIES)})", name="visibility"),
        CheckConstraint(f"level IN ({_in(LEVELS)})", name="level"),
        Index("ix_academy_courses_status_visibility", "status", "visibility"),
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id", ondelete="CASCADE"), index=True
    )
    """The internal organization (DEV4INNOVA content)."""
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", server_default="draft")
    visibility: Mapped[str] = mapped_column(String(20), default="public", server_default="public")
    """public: in the catalog, anyone signed in enrolls; restricted: the team enrolls."""
    level: Mapped[str] = mapped_column(String(20), default="beginner", server_default="beginner")
    duration_minutes: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    title: Mapped[I18n] = _i18n()
    summary: Mapped[I18n] = _i18n()
    description_md: Mapped[I18n] = _i18n()
    description_html: Mapped[I18n] = _i18n()
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )


class Module(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "academy_modules"
    __table_args__ = (Index("ix_academy_modules_course_position", "course_id", "position"),)

    course_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("academy_courses.id", ondelete="CASCADE")
    )
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    title: Mapped[I18n] = _i18n()
    summary: Mapped[I18n] = _i18n()


class Lesson(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "academy_lessons"
    __table_args__ = (Index("ix_academy_lessons_module_position", "module_id", "position"),)

    course_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("academy_courses.id", ondelete="CASCADE"), index=True
    )
    module_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("academy_modules.id", ondelete="CASCADE")
    )
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    title: Mapped[I18n] = _i18n()
    body_md: Mapped[I18n] = _i18n()
    body_html: Mapped[I18n] = _i18n()
    video_url: Mapped[str | None] = mapped_column(String(300))
    """Privacy-enhanced embed URL (youtube-nocookie.com or player.vimeo.com), normalized."""
    duration_minutes: Mapped[int] = mapped_column(Integer, default=5, server_default="5")


class Question(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Multiple-choice question of a module quiz (one right answer)."""

    __tablename__ = "academy_questions"
    __table_args__ = (Index("ix_academy_questions_module_position", "module_id", "position"),)

    course_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("academy_courses.id", ondelete="CASCADE"), index=True
    )
    module_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("academy_modules.id", ondelete="CASCADE")
    )
    position: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    prompt: Mapped[I18n] = _i18n()
    options: Mapped[list[I18n]] = mapped_column(JSONB, default=list, server_default="[]")
    correct_option: Mapped[int] = mapped_column(Integer)
    """Index in `options`; never sent to learners before their answers are graded."""
    explanation: Mapped[I18n] = _i18n()


class Enrollment(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "academy_enrollments"
    __table_args__ = (
        UniqueConstraint("course_id", "user_id", name="uq_academy_enrollments_course_id_user_id"),
        Index("ix_academy_enrollments_sponsor", "sponsor_organization_id", "course_id"),
    )

    course_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("academy_courses.id", ondelete="CASCADE")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    sponsor_organization_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("organizations.id", ondelete="SET NULL")
    )
    """Client organization the team enrolled the learner for (None: self-enrolled)."""
    enrolled_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_activity_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class LessonProgress(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "academy_lesson_progress"
    __table_args__ = (
        UniqueConstraint(
            "enrollment_id", "lesson_id", name="uq_academy_lesson_progress_enrollment_id_lesson_id"
        ),
    )

    enrollment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("academy_enrollments.id", ondelete="CASCADE")
    )
    lesson_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("academy_lessons.id", ondelete="CASCADE")
    )
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class QuizAttempt(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "academy_quiz_attempts"
    __table_args__ = (Index("ix_academy_quiz_attempts_enrollment", "enrollment_id", "module_id"),)

    enrollment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("academy_enrollments.id", ondelete="CASCADE")
    )
    module_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("academy_modules.id", ondelete="CASCADE")
    )
    score: Mapped[int] = mapped_column(Integer)
    """Percentage of right answers."""
    passed: Mapped[bool] = mapped_column(Boolean)
    answers: Mapped[dict[str, Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Certificate(UUIDPrimaryKeyMixin, Base):
    """Issued when every lesson is done and every quiz passed (TASK-109). Names are kept as
    issued, so the certificate stays true if the course or the profile changes later."""

    __tablename__ = "academy_certificates"

    enrollment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("academy_enrollments.id", ondelete="SET NULL"), unique=True
    )
    course_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("academy_courses.id", ondelete="SET NULL")
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    code: Mapped[str] = mapped_column(String(20), unique=True)
    """Public verification code (about 60 random bits), e.g. D4I-7KQ2-M9XA-P3TZ."""
    learner_name: Mapped[str] = mapped_column(String(200))
    course_title: Mapped[I18n] = _i18n()
    duration_minutes: Mapped[int] = mapped_column(Integer)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
