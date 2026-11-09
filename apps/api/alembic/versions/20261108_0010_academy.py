"""Academy (EPIC 12): courses, modules, lessons, quiz questions, enrollments, lesson
progress, quiz attempts and certificates.

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0010"
down_revision: str | Sequence[str] | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "academy_courses",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="draft", nullable=False),
        sa.Column("visibility", sa.String(length=20), server_default="public", nullable=False),
        sa.Column("level", sa.String(length=20), server_default="beginner", nullable=False),
        sa.Column("duration_minutes", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "title", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False
        ),
        sa.Column(
            "summary", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False
        ),
        sa.Column(
            "description_md",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column(
            "description_html",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "level IN ('beginner', 'intermediate', 'advanced')",
            name=op.f("ck_academy_courses_level"),
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'published')", name=op.f("ck_academy_courses_status")
        ),
        sa.CheckConstraint(
            "visibility IN ('public', 'restricted')", name=op.f("ck_academy_courses_visibility")
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_academy_courses_created_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_academy_courses_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_academy_courses")),
        sa.UniqueConstraint("slug", name=op.f("uq_academy_courses_slug")),
    )
    op.create_index(
        op.f("ix_academy_courses_organization_id"),
        "academy_courses",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        "ix_academy_courses_status_visibility",
        "academy_courses",
        ["status", "visibility"],
        unique=False,
    )
    op.create_table(
        "academy_enrollments",
        sa.Column("course_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("sponsor_organization_id", sa.Uuid(), nullable=True),
        sa.Column("enrolled_by_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["course_id"],
            ["academy_courses.id"],
            name=op.f("fk_academy_enrollments_course_id_academy_courses"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["enrolled_by_id"],
            ["users.id"],
            name=op.f("fk_academy_enrollments_enrolled_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["sponsor_organization_id"],
            ["organizations.id"],
            name=op.f("fk_academy_enrollments_sponsor_organization_id_organizations"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_academy_enrollments_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_academy_enrollments")),
        sa.UniqueConstraint(
            "course_id", "user_id", name="uq_academy_enrollments_course_id_user_id"
        ),
    )
    op.create_index(
        "ix_academy_enrollments_sponsor",
        "academy_enrollments",
        ["sponsor_organization_id", "course_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_academy_enrollments_user_id"), "academy_enrollments", ["user_id"], unique=False
    )
    op.create_table(
        "academy_modules",
        sa.Column("course_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "title", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False
        ),
        sa.Column(
            "summary", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["course_id"],
            ["academy_courses.id"],
            name=op.f("fk_academy_modules_course_id_academy_courses"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_academy_modules")),
    )
    op.create_index(
        "ix_academy_modules_course_position",
        "academy_modules",
        ["course_id", "position"],
        unique=False,
    )
    op.create_table(
        "academy_certificates",
        sa.Column("enrollment_id", sa.Uuid(), nullable=True),
        sa.Column("course_id", sa.Uuid(), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("code", sa.String(length=20), nullable=False),
        sa.Column("learner_name", sa.String(length=200), nullable=False),
        sa.Column(
            "course_title",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["course_id"],
            ["academy_courses.id"],
            name=op.f("fk_academy_certificates_course_id_academy_courses"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["enrollment_id"],
            ["academy_enrollments.id"],
            name=op.f("fk_academy_certificates_enrollment_id_academy_enrollments"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_academy_certificates_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_academy_certificates")),
        sa.UniqueConstraint("code", name=op.f("uq_academy_certificates_code")),
        sa.UniqueConstraint("enrollment_id", name=op.f("uq_academy_certificates_enrollment_id")),
    )
    op.create_index(
        op.f("ix_academy_certificates_user_id"), "academy_certificates", ["user_id"], unique=False
    )
    op.create_table(
        "academy_lessons",
        sa.Column("course_id", sa.Uuid(), nullable=False),
        sa.Column("module_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "title", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False
        ),
        sa.Column(
            "body_md", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False
        ),
        sa.Column(
            "body_html",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("video_url", sa.String(length=300), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), server_default="5", nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["course_id"],
            ["academy_courses.id"],
            name=op.f("fk_academy_lessons_course_id_academy_courses"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["module_id"],
            ["academy_modules.id"],
            name=op.f("fk_academy_lessons_module_id_academy_modules"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_academy_lessons")),
    )
    op.create_index(
        op.f("ix_academy_lessons_course_id"), "academy_lessons", ["course_id"], unique=False
    )
    op.create_index(
        "ix_academy_lessons_module_position",
        "academy_lessons",
        ["module_id", "position"],
        unique=False,
    )
    op.create_table(
        "academy_questions",
        sa.Column("course_id", sa.Uuid(), nullable=False),
        sa.Column("module_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "prompt", postgresql.JSONB(astext_type=sa.Text()), server_default="{}", nullable=False
        ),
        sa.Column(
            "options", postgresql.JSONB(astext_type=sa.Text()), server_default="[]", nullable=False
        ),
        sa.Column("correct_option", sa.Integer(), nullable=False),
        sa.Column(
            "explanation",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="{}",
            nullable=False,
        ),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["course_id"],
            ["academy_courses.id"],
            name=op.f("fk_academy_questions_course_id_academy_courses"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["module_id"],
            ["academy_modules.id"],
            name=op.f("fk_academy_questions_module_id_academy_modules"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_academy_questions")),
    )
    op.create_index(
        op.f("ix_academy_questions_course_id"), "academy_questions", ["course_id"], unique=False
    )
    op.create_index(
        "ix_academy_questions_module_position",
        "academy_questions",
        ["module_id", "position"],
        unique=False,
    )
    op.create_table(
        "academy_quiz_attempts",
        sa.Column("enrollment_id", sa.Uuid(), nullable=False),
        sa.Column("module_id", sa.Uuid(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("passed", sa.Boolean(), nullable=False),
        sa.Column("answers", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["enrollment_id"],
            ["academy_enrollments.id"],
            name=op.f("fk_academy_quiz_attempts_enrollment_id_academy_enrollments"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["module_id"],
            ["academy_modules.id"],
            name=op.f("fk_academy_quiz_attempts_module_id_academy_modules"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_academy_quiz_attempts")),
    )
    op.create_index(
        "ix_academy_quiz_attempts_enrollment",
        "academy_quiz_attempts",
        ["enrollment_id", "module_id"],
        unique=False,
    )
    op.create_table(
        "academy_lesson_progress",
        sa.Column("enrollment_id", sa.Uuid(), nullable=False),
        sa.Column("lesson_id", sa.Uuid(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["enrollment_id"],
            ["academy_enrollments.id"],
            name=op.f("fk_academy_lesson_progress_enrollment_id_academy_enrollments"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["lesson_id"],
            ["academy_lessons.id"],
            name=op.f("fk_academy_lesson_progress_lesson_id_academy_lessons"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_academy_lesson_progress")),
        sa.UniqueConstraint(
            "enrollment_id", "lesson_id", name="uq_academy_lesson_progress_enrollment_id_lesson_id"
        ),
    )


def downgrade() -> None:
    op.drop_table("academy_lesson_progress")
    op.drop_index("ix_academy_quiz_attempts_enrollment", table_name="academy_quiz_attempts")
    op.drop_table("academy_quiz_attempts")
    op.drop_index("ix_academy_questions_module_position", table_name="academy_questions")
    op.drop_index(op.f("ix_academy_questions_course_id"), table_name="academy_questions")
    op.drop_table("academy_questions")
    op.drop_index("ix_academy_lessons_module_position", table_name="academy_lessons")
    op.drop_index(op.f("ix_academy_lessons_course_id"), table_name="academy_lessons")
    op.drop_table("academy_lessons")
    op.drop_index(op.f("ix_academy_certificates_user_id"), table_name="academy_certificates")
    op.drop_table("academy_certificates")
    op.drop_index("ix_academy_modules_course_position", table_name="academy_modules")
    op.drop_table("academy_modules")
    op.drop_index(op.f("ix_academy_enrollments_user_id"), table_name="academy_enrollments")
    op.drop_index("ix_academy_enrollments_sponsor", table_name="academy_enrollments")
    op.drop_table("academy_enrollments")
    op.drop_index("ix_academy_courses_status_visibility", table_name="academy_courses")
    op.drop_index(op.f("ix_academy_courses_organization_id"), table_name="academy_courses")
    op.drop_table("academy_courses")
