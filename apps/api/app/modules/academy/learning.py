"""Catalog, enrollment, lessons, quizzes and certificates (TASK-103, TASK-106 to TASK-109).

Learners only ever reach their own enrollments, in published courses. Quiz answers are
graded on the server: the right answers never reach the browser before grading.
"""

import secrets
import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.modules.academy import common
from app.modules.academy.common import now, text
from app.modules.academy.content import enrollment_rows
from app.modules.academy.models import (
    PASS_PERCENT,
    Certificate,
    Course,
    Enrollment,
    Lesson,
    LessonProgress,
    Module,
    Question,
    QuizAttempt,
)
from app.modules.academy.schemas import (
    AcademyOrganization,
    CertificateOut,
    CourseCard,
    CourseOutline,
    LearnerCourse,
    LearnerLesson,
    LearnerModule,
    LessonDone,
    LessonOutline,
    LessonView,
    ModuleOutline,
    MyCourse,
    QuestionResult,
    QuizQuestion,
    QuizResult,
    QuizView,
    SponsoredEnrollment,
)
from app.modules.identity.models import Organization, User
from app.modules.identity.permissions import Permission
from app.modules.identity.service import OrganizationContext

_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"  # no 0/O, 1/I: easy to read and type


def new_code() -> str:
    """D4I-XXXX-XXXX-XXXX: 12 random characters out of 32 (60 bits)."""
    chars = "".join(secrets.choice(_ALPHABET) for _ in range(12))
    return f"D4I-{chars[:4]}-{chars[4:8]}-{chars[8:]}"


# --- Catalog (TASK-103) ----------------------------------------------------------------


async def catalog(session: AsyncSession, locale: str) -> list[CourseCard]:
    courses = list(
        await session.scalars(
            select(Course)
            .where(Course.status == "published", Course.visibility == "public")
            .order_by(Course.published_at.desc())
        )
    )
    stats = await common.course_stats(session, [c.id for c in courses])
    return [common.card(c, stats[c.id], locale) for c in courses]


async def _structure(
    session: AsyncSession, course_id: uuid.UUID
) -> tuple[list[Module], list[Lesson], dict[uuid.UUID, int]]:
    modules = list(
        await session.scalars(
            select(Module).where(Module.course_id == course_id).order_by(Module.position)
        )
    )
    lessons = list(
        await session.scalars(
            select(Lesson).where(Lesson.course_id == course_id).order_by(Lesson.position)
        )
    )
    questions = dict(
        (
            await session.execute(
                select(Question.module_id, func.count())
                .where(Question.course_id == course_id)
                .group_by(Question.module_id)
            )
        ).all()
    )
    return modules, lessons, questions


def _ordered(modules: list[Module], lessons: list[Lesson]) -> list[Lesson]:
    """Lessons in reading order: module by module."""
    rank = {m.id: i for i, m in enumerate(modules)}
    return sorted(lessons, key=lambda lesson: (rank.get(lesson.module_id, 0), lesson.position))


async def outline(session: AsyncSession, slug: str, locale: str) -> CourseOutline:
    """Public page of a course: outline only, never the content of the lessons."""
    course = await session.scalar(
        select(Course).where(
            Course.slug == slug, Course.status == "published", Course.visibility == "public"
        )
    )
    if course is None:
        raise NotFoundError("Course not found")
    return await _outline(session, course, locale)


async def _outline(session: AsyncSession, course: Course, locale: str) -> CourseOutline:
    modules, lessons, questions = await _structure(session, course.id)
    stats = await common.course_stats(session, [course.id])
    return CourseOutline(
        **common.card(course, stats[course.id], locale).model_dump(),
        description_html=text(course.description_html, locale),
        visibility=course.visibility,
        outline=[
            ModuleOutline(
                id=m.id,
                title=text(m.title, locale),
                summary=text(m.summary, locale),
                lessons=[
                    LessonOutline(
                        id=lesson.id,
                        title=text(lesson.title, locale),
                        duration_minutes=lesson.duration_minutes,
                        has_video=lesson.video_url is not None,
                    )
                    for lesson in lessons
                    if lesson.module_id == m.id
                ],
                questions=questions.get(m.id, 0),
            )
            for m in modules
        ],
    )


# --- Enrollment (TASK-106) -------------------------------------------------------------


async def enroll(session: AsyncSession, user: User, slug: str) -> Enrollment:
    """Self-enrollment in a public course (idempotent)."""
    course = await session.scalar(
        select(Course).where(
            Course.slug == slug, Course.status == "published", Course.visibility == "public"
        )
    )
    if course is None:
        raise NotFoundError("Course not found")
    enrollment = await session.scalar(
        select(Enrollment).where(Enrollment.course_id == course.id, Enrollment.user_id == user.id)
    )
    if enrollment:
        return enrollment
    created = now()
    enrollment = Enrollment(
        course_id=course.id, user_id=user.id, created_at=created, last_activity_at=created
    )
    session.add(enrollment)
    try:
        await session.commit()
    except IntegrityError:  # enrolled twice at the same time
        await session.rollback()
        enrollment = await session.scalar(
            select(Enrollment).where(
                Enrollment.course_id == course.id, Enrollment.user_id == user.id
            )
        )
        assert enrollment is not None
    return enrollment


async def _my_enrollment(session: AsyncSession, user: User, slug: str) -> tuple[Enrollment, Course]:
    row = (
        await session.execute(
            select(Enrollment, Course)
            .join(Course, Course.id == Enrollment.course_id)
            .where(Enrollment.user_id == user.id, Course.slug == slug, Course.status == "published")
        )
    ).first()
    if row is None:
        raise NotFoundError("Course not found")
    return row[0], row[1]


async def _enrollment_for(
    session: AsyncSession, user: User, course_id: uuid.UUID
) -> tuple[Enrollment, Course]:
    row = (
        await session.execute(
            select(Enrollment, Course)
            .join(Course, Course.id == Enrollment.course_id)
            .where(
                Enrollment.user_id == user.id, Course.id == course_id, Course.status == "published"
            )
        )
    ).first()
    if row is None:
        raise NotFoundError("Not found")
    return row[0], row[1]


async def _certificate_codes(
    session: AsyncSession, enrollment_ids: list[uuid.UUID]
) -> dict[uuid.UUID, str]:
    if not enrollment_ids:
        return {}
    rows = await session.execute(
        select(Certificate.enrollment_id, Certificate.code).where(
            Certificate.enrollment_id.in_(enrollment_ids), Certificate.revoked_at.is_(None)
        )
    )
    return {e: c for e, c in rows.all() if e is not None}


async def _sponsors(
    session: AsyncSession, enrollments: list[Enrollment]
) -> dict[uuid.UUID, AcademyOrganization]:
    ids = {e.sponsor_organization_id for e in enrollments if e.sponsor_organization_id}
    if not ids:
        return {}
    rows = await session.scalars(select(Organization).where(Organization.id.in_(ids)))
    return {o.id: AcademyOrganization(id=o.id, name=o.name, slug=o.slug) for o in rows}


async def my_courses(session: AsyncSession, user: User, locale: str) -> list[MyCourse]:
    rows = (
        await session.execute(
            select(Enrollment, Course)
            .join(Course, Course.id == Enrollment.course_id)
            .where(Enrollment.user_id == user.id, Course.status == "published")
            .order_by(Enrollment.last_activity_at.desc())
        )
    ).all()
    enrollments = [e for e, _ in rows]
    progress = await common.progress(session, enrollments)
    stats = await common.course_stats(session, [c.id for _, c in rows])
    codes = await _certificate_codes(session, [e.id for e in enrollments])
    sponsors = await _sponsors(session, enrollments)
    return [
        MyCourse(
            course=common.card(c, stats[c.id], locale),
            progress=progress[e.id],
            sponsor=sponsors.get(e.sponsor_organization_id) if e.sponsor_organization_id else None,
            enrolled_at=e.created_at,
            last_activity_at=e.last_activity_at,
            completed_at=e.completed_at,
            certificate_code=codes.get(e.id),
        )
        for e, c in rows
    ]


async def learner_course(
    session: AsyncSession, user: User, slug: str, locale: str
) -> LearnerCourse:
    enrollment, course = await _my_enrollment(session, user, slug)
    base = await _outline(session, course, locale)
    done = set(
        await session.scalars(
            select(LessonProgress.lesson_id).where(LessonProgress.enrollment_id == enrollment.id)
        )
    )
    best = dict(
        (
            await session.execute(
                select(QuizAttempt.module_id, func.max(QuizAttempt.score))
                .where(QuizAttempt.enrollment_id == enrollment.id)
                .group_by(QuizAttempt.module_id)
            )
        ).all()
    )
    passed = set(
        await session.scalars(
            select(QuizAttempt.module_id).where(
                QuizAttempt.enrollment_id == enrollment.id, QuizAttempt.passed.is_(True)
            )
        )
    )
    progress = (await common.progress(session, [enrollment]))[enrollment.id]
    codes = await _certificate_codes(session, [enrollment.id])
    sponsors = await _sponsors(session, [enrollment])
    modules = [
        LearnerModule(
            id=m.id,
            title=m.title,
            summary=m.summary,
            lessons=[
                LearnerLesson(**lesson.model_dump(), done=lesson.id in done) for lesson in m.lessons
            ],
            questions=m.questions,
            best_score=best.get(m.id),
            quiz_passed=m.id in passed,
        )
        for m in base.outline
    ]
    next_lesson = next(
        (lesson.id for m in modules for lesson in m.lessons if not lesson.done), None
    )
    return LearnerCourse(
        course=CourseCard(**base.model_dump(include=set(CourseCard.model_fields))),
        progress=progress,
        sponsor=sponsors.get(enrollment.sponsor_organization_id)
        if enrollment.sponsor_organization_id
        else None,
        enrolled_at=enrollment.created_at,
        last_activity_at=enrollment.last_activity_at,
        completed_at=enrollment.completed_at,
        certificate_code=codes.get(enrollment.id),
        description_html=base.description_html,
        outline=modules,
        pass_percent=PASS_PERCENT,
        next_lesson_id=next_lesson,
    )


# --- Lessons (TASK-105, TASK-107) ------------------------------------------------------


async def lesson_view(
    session: AsyncSession, user: User, lesson_id: uuid.UUID, locale: str
) -> LessonView:
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        raise NotFoundError("Lesson not found")
    enrollment, course = await _enrollment_for(session, user, lesson.course_id)
    modules, lessons, questions = await _structure(session, course.id)
    ordered = _ordered(modules, lessons)
    index = next(i for i, item in enumerate(ordered) if item.id == lesson.id)
    module = next(m for m in modules if m.id == lesson.module_id)
    done = await session.scalar(
        select(LessonProgress.id).where(
            LessonProgress.enrollment_id == enrollment.id, LessonProgress.lesson_id == lesson.id
        )
    )
    return LessonView(
        id=lesson.id,
        course_slug=course.slug,
        course_title=text(course.title, locale),
        module_id=module.id,
        module_title=text(module.title, locale),
        title=text(lesson.title, locale),
        body_html=text(lesson.body_html, locale),
        video_url=lesson.video_url,
        duration_minutes=lesson.duration_minutes,
        done=done is not None,
        previous_lesson_id=ordered[index - 1].id if index > 0 else None,
        next_lesson_id=ordered[index + 1].id if index + 1 < len(ordered) else None,
        module_has_quiz=questions.get(module.id, 0) > 0,
    )


async def complete_lesson(session: AsyncSession, user: User, lesson_id: uuid.UUID) -> LessonDone:
    lesson = await session.get(Lesson, lesson_id)
    if lesson is None:
        raise NotFoundError("Lesson not found")
    enrollment, course = await _enrollment_for(session, user, lesson.course_id)
    exists = await session.scalar(
        select(LessonProgress.id).where(
            LessonProgress.enrollment_id == enrollment.id, LessonProgress.lesson_id == lesson.id
        )
    )
    if exists is None:
        session.add(
            LessonProgress(enrollment_id=enrollment.id, lesson_id=lesson.id, completed_at=now())
        )
        try:
            await session.flush()
        except IntegrityError:  # marked twice at the same time
            await session.rollback()
            enrollment, course = await _enrollment_for(session, user, lesson.course_id)
    enrollment.last_activity_at = now()
    code = await _complete_if_done(session, enrollment, course, user)
    await session.commit()
    progress = (await common.progress(session, [enrollment]))[enrollment.id]
    return LessonDone(
        progress=progress,
        course_completed=enrollment.completed_at is not None,
        certificate_code=code,
    )


# --- Quizzes (TASK-108) ----------------------------------------------------------------


async def _quiz(
    session: AsyncSession, user: User, module_id: uuid.UUID
) -> tuple[Enrollment, Course, Module, list[Question]]:
    module = await session.get(Module, module_id)
    if module is None:
        raise NotFoundError("Quiz not found")
    enrollment, course = await _enrollment_for(session, user, module.course_id)
    questions = list(
        await session.scalars(
            select(Question).where(Question.module_id == module.id).order_by(Question.position)
        )
    )
    if not questions:
        raise NotFoundError("Quiz not found")
    return enrollment, course, module, questions


async def quiz_view(
    session: AsyncSession, user: User, module_id: uuid.UUID, locale: str
) -> QuizView:
    enrollment, course, module, questions = await _quiz(session, user, module_id)
    best = await session.scalar(
        select(func.max(QuizAttempt.score)).where(
            QuizAttempt.enrollment_id == enrollment.id, QuizAttempt.module_id == module.id
        )
    )
    return QuizView(
        module_id=module.id,
        course_slug=course.slug,
        course_title=text(course.title, locale),
        module_title=text(module.title, locale),
        questions=[
            QuizQuestion(
                id=q.id, prompt=text(q.prompt, locale), options=[text(o, locale) for o in q.options]
            )
            for q in questions
        ],
        pass_percent=PASS_PERCENT,
        best_score=best,
        passed=best is not None and best >= PASS_PERCENT,
    )


async def submit_quiz(
    session: AsyncSession,
    user: User,
    module_id: uuid.UUID,
    answers: dict[uuid.UUID, int],
    locale: str,
) -> QuizResult:
    """Grades the answers (an unanswered question is wrong). Attempts are unlimited."""
    enrollment, course, module, questions = await _quiz(session, user, module_id)
    results = []
    for q in questions:
        chosen = answers.get(q.id)
        chosen = chosen if chosen is not None and 0 <= chosen < len(q.options) else None
        results.append(
            QuestionResult(
                question_id=q.id,
                chosen=chosen,
                correct_option=q.correct_option,
                correct=chosen == q.correct_option,
                explanation=text(q.explanation, locale),
            )
        )
    score = round(100 * sum(r.correct for r in results) / len(results))
    passed = score >= PASS_PERCENT
    session.add(
        QuizAttempt(
            enrollment_id=enrollment.id,
            module_id=module.id,
            score=score,
            passed=passed,
            answers={str(r.question_id): r.chosen for r in results},
            created_at=now(),
        )
    )
    enrollment.last_activity_at = now()
    await session.flush()
    code = await _complete_if_done(session, enrollment, course, user) if passed else None
    await session.commit()
    if code is None:
        code = (await _certificate_codes(session, [enrollment.id])).get(enrollment.id)
    return QuizResult(
        score=score,
        passed=passed,
        pass_percent=PASS_PERCENT,
        results=results,
        course_completed=enrollment.completed_at is not None,
        certificate_code=code,
    )


# --- Completion and certificates (TASK-109) --------------------------------------------


async def _complete_if_done(
    session: AsyncSession, enrollment: Enrollment, course: Course, user: User
) -> str | None:
    """Every lesson done and every quiz passed: the course is completed and a certificate
    issued, once. Returns the code of a certificate issued now."""
    if enrollment.completed_at is not None:
        return None
    progress = (await common.progress(session, [enrollment]))[enrollment.id]
    if progress.lessons_total == 0 or progress.lessons_done < progress.lessons_total:
        return None
    if progress.quizzes_passed < progress.quizzes_total:
        return None
    enrollment.completed_at = now()
    certificate = Certificate(
        enrollment_id=enrollment.id,
        course_id=course.id,
        user_id=user.id,
        code=new_code(),
        learner_name=user.display_name or user.email or "",
        course_title=dict(course.title),
        duration_minutes=course.duration_minutes,
        issued_at=enrollment.completed_at,
    )
    session.add(certificate)
    await session.flush()
    return certificate.code


async def certificate(session: AsyncSession, code: str, locale: str) -> CertificateOut:
    """Public verification of a certificate by its code."""
    row = (
        await session.execute(
            select(Certificate, Course.slug)
            .outerjoin(Course, Course.id == Certificate.course_id)
            .where(Certificate.code == code.strip().upper())
        )
    ).first()
    if row is None:
        raise NotFoundError("Certificate not found")
    cert, slug = row
    return CertificateOut(
        code=cert.code,
        learner_name=cert.learner_name,
        course_title=text(cert.course_title, locale),
        course_slug=slug,
        duration_minutes=cert.duration_minutes,
        issued_at=cert.issued_at,
        valid=cert.revoked_at is None,
    )


# --- Follow-up by the sponsoring organization --------------------------------------------


async def sponsored(
    session: AsyncSession, ctx: OrganizationContext, locale: str
) -> list[SponsoredEnrollment]:
    """Members the team enrolled for this organization, and their progress (owners and admins)."""
    ctx.require(Permission.ACADEMY_REPORT)
    enrollments = list(
        await session.scalars(
            select(Enrollment)
            .join(Course, Course.id == Enrollment.course_id)
            .where(Enrollment.sponsor_organization_id == ctx.organization_id)
            .order_by(Enrollment.last_activity_at.desc())
        )
    )
    rows = await enrollment_rows(session, enrollments, locale)
    return [SponsoredEnrollment(**row.model_dump(exclude={"sponsor"})) for row in rows]
