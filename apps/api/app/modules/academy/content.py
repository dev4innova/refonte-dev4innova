"""Writing courses in the back office (TASK-103 to TASK-105, TASK-108) and enrolling the
members of client organizations (TASK-106). Staff with `academy:manage` only."""

import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError
from app.modules.academy import common
from app.modules.academy.common import embed_url, now, texts
from app.modules.academy.models import (
    Certificate,
    Course,
    Enrollment,
    Lesson,
    Module,
    Question,
)
from app.modules.academy.schemas import (
    AcademyOrganization,
    AcademyPerson,
    AdminCourse,
    AdminCourseSummary,
    AdminEnrollment,
    AdminLesson,
    AdminModule,
    AdminQuestion,
    CourseIn,
    Direction,
    EnrollIn,
    EnrollResult,
    LessonIn,
    MissingItem,
    ModuleIn,
    OrganizationMember,
    QuestionIn,
)
from app.modules.cms.markdown import render_markdown
from app.modules.identity.models import INTERNAL_ORGANIZATION_ID, Membership, Organization, User
from app.modules.identity.permissions import Permission
from app.modules.identity.service import OrganizationContext


def _require(ctx: OrganizationContext) -> None:
    ctx.require(Permission.ACADEMY_MANAGE)


def _html(markdown: dict[str, str]) -> dict[str, str]:
    return {locale: render_markdown(value) if value else "" for locale, value in markdown.items()}


# --- Reading ---------------------------------------------------------------------------


async def _course(session: AsyncSession, course_id: uuid.UUID) -> Course:
    course = await session.get(Course, course_id)
    if course is None:
        raise NotFoundError("Course not found")
    return course


def _missing(course: Course, modules: list[AdminModule]) -> list[MissingItem]:
    """What the English version still lacks, and empty parts (TASK-103: both languages)."""
    items: list[MissingItem] = []
    for field in ("title", "summary"):
        if not (getattr(course, field) or {}).get("en"):
            items.append(MissingItem(kind="course", ref=None, field=field))
    if not modules:
        items.append(MissingItem(kind="course", ref=None, field="modules"))
    for m, module in enumerate(modules, start=1):
        if not module.title.get("en"):
            items.append(MissingItem(kind="module", ref=str(m), field="title"))
        if not module.lessons:
            items.append(MissingItem(kind="module", ref=str(m), field="lessons"))
        for n, lesson in enumerate(module.lessons, start=1):
            ref = f"{m}.{n}"
            if not lesson.title.get("en"):
                items.append(MissingItem(kind="lesson", ref=ref, field="title"))
            for locale in ("fr", "en"):
                if not lesson.body_md.get(locale):
                    items.append(MissingItem(kind="lesson", ref=ref, field=f"body_{locale}"))
        for n, question in enumerate(module.questions, start=1):
            ref = f"{m}.{n}"
            if not question.prompt.get("en") or any(not o.get("en") for o in question.options):
                items.append(MissingItem(kind="question", ref=ref, field="text"))
            if question.explanation.get("fr") and not question.explanation.get("en"):
                items.append(MissingItem(kind="question", ref=ref, field="explanation"))
    return items


async def _summaries(session: AsyncSession, courses: list[Course]) -> list[AdminCourseSummary]:
    stats = await common.course_stats(session, [c.id for c in courses])
    ids = [c.id for c in courses]
    counts = (
        dict(
            (
                await session.execute(
                    select(Enrollment.course_id, func.count())
                    .where(Enrollment.course_id.in_(ids))
                    .group_by(Enrollment.course_id)
                )
            ).all()
        )
        if ids
        else {}
    )
    completions = (
        dict(
            (
                await session.execute(
                    select(Enrollment.course_id, func.count())
                    .where(Enrollment.course_id.in_(ids), Enrollment.completed_at.is_not(None))
                    .group_by(Enrollment.course_id)
                )
            ).all()
        )
        if ids
        else {}
    )
    return [
        AdminCourseSummary(
            id=c.id,
            slug=c.slug,
            status=c.status,
            visibility=c.visibility,
            level=c.level,
            title=c.title,
            modules=stats[c.id].modules,
            lessons=stats[c.id].lessons,
            enrollments=counts.get(c.id, 0),
            completions=completions.get(c.id, 0),
            updated_at=c.updated_at,
        )
        for c in courses
    ]


async def list_courses(session: AsyncSession, ctx: OrganizationContext) -> list[AdminCourseSummary]:
    _require(ctx)
    courses = list(await session.scalars(select(Course).order_by(Course.updated_at.desc())))
    return await _summaries(session, courses)


async def course_out(
    session: AsyncSession, ctx: OrganizationContext, course_id: uuid.UUID
) -> AdminCourse:
    _require(ctx)
    course = await _course(session, course_id)
    modules = list(
        await session.scalars(
            select(Module).where(Module.course_id == course.id).order_by(Module.position)
        )
    )
    lessons = list(
        await session.scalars(
            select(Lesson).where(Lesson.course_id == course.id).order_by(Lesson.position)
        )
    )
    questions = list(
        await session.scalars(
            select(Question).where(Question.course_id == course.id).order_by(Question.position)
        )
    )
    outline = [
        AdminModule(
            id=m.id,
            position=m.position,
            title=m.title,
            summary=m.summary,
            lessons=[_lesson_out(lesson) for lesson in lessons if lesson.module_id == m.id],
            questions=[_question_out(q) for q in questions if q.module_id == m.id],
        )
        for m in modules
    ]
    (summary,) = await _summaries(session, [course])
    return AdminCourse(
        **summary.model_dump(),
        duration_minutes=course.duration_minutes,
        summary=course.summary,
        description_md=course.description_md,
        published_at=course.published_at,
        outline=outline,
        missing=_missing(course, outline),
    )


def _lesson_out(lesson: Lesson) -> AdminLesson:
    return AdminLesson(
        id=lesson.id,
        module_id=lesson.module_id,
        position=lesson.position,
        title=lesson.title,
        body_md=lesson.body_md,
        video_url=lesson.video_url,
        duration_minutes=lesson.duration_minutes,
    )


def _question_out(question: Question) -> AdminQuestion:
    return AdminQuestion(
        id=question.id,
        module_id=question.module_id,
        position=question.position,
        prompt=question.prompt,
        options=question.options,
        correct_option=question.correct_option,
        explanation=question.explanation,
    )


# --- Courses (TASK-103) ----------------------------------------------------------------


def _apply_course(course: Course, data: CourseIn) -> None:
    course.slug = data.slug
    course.visibility = data.visibility
    course.level = data.level
    course.duration_minutes = data.duration_minutes
    course.title = texts(data.title)
    course.summary = texts(data.summary)
    course.description_md = texts(data.description_md)
    course.description_html = _html(course.description_md)


async def _commit_slug(session: AsyncSession) -> None:
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise ConflictError(
            "Another course already uses this address", {"field": "slug"}
        ) from error


async def create_course(session: AsyncSession, ctx: OrganizationContext, data: CourseIn) -> Course:
    _require(ctx)
    course = Course(organization_id=INTERNAL_ORGANIZATION_ID, created_by_id=ctx.user.id)
    _apply_course(course, data)
    session.add(course)
    await _commit_slug(session)
    return course


async def update_course(
    session: AsyncSession, ctx: OrganizationContext, course_id: uuid.UUID, data: CourseIn
) -> None:
    _require(ctx)
    course = await _course(session, course_id)
    _apply_course(course, data)
    await _commit_slug(session)


async def set_published(
    session: AsyncSession, ctx: OrganizationContext, course_id: uuid.UUID, published: bool
) -> None:
    """Publishing needs every text in both languages. Unpublishing hides the course from
    the catalog and from its learners until it is published again."""
    _require(ctx)
    if published:
        out = await course_out(session, ctx, course_id)
        if out.missing:
            raise ConflictError(
                "The course is not complete in both languages",
                {"missing": [m.model_dump() for m in out.missing]},
            )
    course = await _course(session, course_id)
    course.status = "published" if published else "draft"
    if published and course.published_at is None:
        course.published_at = now()
    await session.commit()


async def delete_course(
    session: AsyncSession, ctx: OrganizationContext, course_id: uuid.UUID
) -> None:
    """Only a course nobody is enrolled in can be deleted (issued certificates stay)."""
    _require(ctx)
    course = await _course(session, course_id)
    if await session.scalar(
        select(func.count()).select_from(Enrollment).where(Enrollment.course_id == course.id)
    ):
        raise ConflictError("Learners are enrolled in this course: unpublish it instead")
    await session.delete(course)
    await session.commit()


# --- Modules, lessons, questions (TASK-104, TASK-105, TASK-108) ------------------------


async def _next_position[Positioned: (Module, Lesson, Question)](
    session: AsyncSession, model: type[Positioned], **where: uuid.UUID
) -> int:
    conditions = [getattr(model, key) == value for key, value in where.items()]
    value = await session.scalar(
        select(func.coalesce(func.max(model.position) + 1, 0)).where(*conditions)
    )
    return int(value or 0)


async def _get[Positioned: (Module, Lesson, Question)](
    session: AsyncSession, model: type[Positioned], item_id: uuid.UUID
) -> Positioned:
    item = await session.get(model, item_id)
    if item is None:
        raise NotFoundError("Not found")
    return item


async def _touch(session: AsyncSession, course_id: uuid.UUID) -> None:
    course = await _course(session, course_id)
    course.updated_at = now()


async def create_module(
    session: AsyncSession, ctx: OrganizationContext, course_id: uuid.UUID, data: ModuleIn
) -> Module:
    _require(ctx)
    await _course(session, course_id)
    module = Module(
        course_id=course_id,
        position=await _next_position(session, Module, course_id=course_id),
        title=texts(data.title),
        summary=texts(data.summary),
    )
    session.add(module)
    await _touch(session, course_id)
    await session.commit()
    return module


async def update_module(
    session: AsyncSession, ctx: OrganizationContext, module_id: uuid.UUID, data: ModuleIn
) -> uuid.UUID:
    _require(ctx)
    module = await _get(session, Module, module_id)
    module.title = texts(data.title)
    module.summary = texts(data.summary)
    await _touch(session, module.course_id)
    await session.commit()
    return module.course_id


async def _lesson_fields(lesson: Lesson, data: LessonIn) -> None:
    lesson.title = texts(data.title)
    lesson.body_md = texts(data.body_md)
    lesson.body_html = _html(lesson.body_md)
    lesson.video_url = embed_url(data.video_url)
    lesson.duration_minutes = data.duration_minutes


async def create_lesson(
    session: AsyncSession, ctx: OrganizationContext, module_id: uuid.UUID, data: LessonIn
) -> Lesson:
    _require(ctx)
    module = await _get(session, Module, module_id)
    lesson = Lesson(
        course_id=module.course_id,
        module_id=module.id,
        position=await _next_position(session, Lesson, module_id=module.id),
    )
    await _lesson_fields(lesson, data)
    session.add(lesson)
    await _touch(session, module.course_id)
    await session.commit()
    return lesson


async def get_lesson(
    session: AsyncSession, ctx: OrganizationContext, lesson_id: uuid.UUID
) -> AdminLesson:
    _require(ctx)
    return _lesson_out(await _get(session, Lesson, lesson_id))


async def update_lesson(
    session: AsyncSession, ctx: OrganizationContext, lesson_id: uuid.UUID, data: LessonIn
) -> AdminLesson:
    _require(ctx)
    lesson = await _get(session, Lesson, lesson_id)
    await _lesson_fields(lesson, data)
    await _touch(session, lesson.course_id)
    await session.commit()
    return _lesson_out(lesson)


def _question_fields(question: Question, data: QuestionIn) -> None:
    question.prompt = texts(data.prompt)
    question.options = [texts(o) for o in data.options]
    question.correct_option = data.correct_option
    question.explanation = texts(data.explanation)


async def create_question(
    session: AsyncSession, ctx: OrganizationContext, module_id: uuid.UUID, data: QuestionIn
) -> Question:
    _require(ctx)
    module = await _get(session, Module, module_id)
    question = Question(
        course_id=module.course_id,
        module_id=module.id,
        position=await _next_position(session, Question, module_id=module.id),
    )
    _question_fields(question, data)
    session.add(question)
    await _touch(session, module.course_id)
    await session.commit()
    return question


async def update_question(
    session: AsyncSession, ctx: OrganizationContext, question_id: uuid.UUID, data: QuestionIn
) -> AdminQuestion:
    _require(ctx)
    question = await _get(session, Question, question_id)
    _question_fields(question, data)
    await _touch(session, question.course_id)
    await session.commit()
    return _question_out(question)


async def delete_item[Positioned: (Module, Lesson, Question)](
    session: AsyncSession, ctx: OrganizationContext, model: type[Positioned], item_id: uuid.UUID
) -> uuid.UUID:
    """Deletes a module (with its lessons and questions), a lesson or a question."""
    _require(ctx)
    item = await _get(session, model, item_id)
    course_id = item.course_id
    await session.delete(item)
    await _touch(session, course_id)
    await session.commit()
    return course_id


async def move_item[Positioned: (Module, Lesson, Question)](
    session: AsyncSession,
    ctx: OrganizationContext,
    model: type[Positioned],
    item_id: uuid.UUID,
    direction: Direction,
) -> uuid.UUID:
    """Swaps an item with its neighbour (modules in a course, lessons or questions in a module)."""
    _require(ctx)
    item = await _get(session, model, item_id)
    parent: Any
    if isinstance(item, Module):
        parent = Module.course_id == item.course_id
    else:
        parent = type(item).module_id == item.module_id
    query = select(model).where(parent)
    if direction == "up":
        query = query.where(model.position < item.position).order_by(model.position.desc())
    else:
        query = query.where(model.position > item.position).order_by(model.position)
    neighbour = await session.scalar(query.limit(1))
    if neighbour is not None:
        item.position, neighbour.position = neighbour.position, item.position
        await _touch(session, item.course_id)
        await session.commit()
    return item.course_id


# --- Enrollments by the team (TASK-106) -----------------------------------------------


async def client_organizations(
    session: AsyncSession, ctx: OrganizationContext
) -> list[AcademyOrganization]:
    _require(ctx)
    rows = await session.scalars(
        select(Organization).where(Organization.kind == "client").order_by(Organization.name)
    )
    return [AcademyOrganization(id=o.id, name=o.name, slug=o.slug) for o in rows]


async def organization_members(
    session: AsyncSession,
    ctx: OrganizationContext,
    course_id: uuid.UUID,
    organization_id: uuid.UUID,
) -> list[OrganizationMember]:
    _require(ctx)
    await _course(session, course_id)
    organization = await session.get(Organization, organization_id)
    if organization is None or organization.kind != "client":
        raise NotFoundError("Client organization not found")
    enrolled = set(
        await session.scalars(select(Enrollment.user_id).where(Enrollment.course_id == course_id))
    )
    rows = await session.scalars(
        select(User)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.organization_id == organization_id)
        .order_by(User.display_name, User.email)
    )
    return [
        OrganizationMember(
            id=u.id, display_name=u.display_name, email=u.email, enrolled=u.id in enrolled
        )
        for u in rows
    ]


async def enroll_members(
    session: AsyncSession, ctx: OrganizationContext, course_id: uuid.UUID, data: EnrollIn
) -> EnrollResult:
    """Enrolls members of a client organization, which then follows their progress."""
    _require(ctx)
    course = await _course(session, course_id)
    if course.status != "published":
        raise ConflictError("Publish the course before enrolling learners")
    organization = await session.get(Organization, data.organization_id)
    if organization is None or organization.kind != "client":
        raise NotFoundError("Client organization not found")
    members = set(
        await session.scalars(
            select(Membership.user_id).where(
                Membership.organization_id == organization.id, Membership.user_id.in_(data.user_ids)
            )
        )
    )
    if members != set(data.user_ids):
        raise NotFoundError("Some people are not members of this organization")
    existing = set(
        await session.scalars(
            select(Enrollment.user_id).where(
                Enrollment.course_id == course.id, Enrollment.user_id.in_(members)
            )
        )
    )
    created = now()
    for user_id in members - existing:
        session.add(
            Enrollment(
                course_id=course.id,
                user_id=user_id,
                sponsor_organization_id=organization.id,
                enrolled_by_id=ctx.user.id,
                created_at=created,
                last_activity_at=created,
            )
        )
    await session.commit()
    return EnrollResult(enrolled=len(members - existing), already=len(existing))


async def list_enrollments(
    session: AsyncSession, ctx: OrganizationContext, course_id: uuid.UUID, locale: str = "fr"
) -> list[AdminEnrollment]:
    _require(ctx)
    course = await _course(session, course_id)
    enrollments = list(
        await session.scalars(
            select(Enrollment)
            .where(Enrollment.course_id == course.id)
            .order_by(Enrollment.created_at.desc())
        )
    )
    return await enrollment_rows(session, enrollments, locale)


async def enrollment_rows(
    session: AsyncSession, enrollments: list[Enrollment], locale: str
) -> list[AdminEnrollment]:
    progress = await common.progress(session, enrollments)
    stats = await common.course_stats(session, [e.course_id for e in enrollments])
    courses = (
        {
            c.id: c
            for c in await session.scalars(
                select(Course).where(Course.id.in_({e.course_id for e in enrollments}))
            )
        }
        if enrollments
        else {}
    )
    users = (
        {
            u.id: u
            for u in await session.scalars(
                select(User).where(User.id.in_({e.user_id for e in enrollments}))
            )
        }
        if enrollments
        else {}
    )
    sponsor_ids = {e.sponsor_organization_id for e in enrollments if e.sponsor_organization_id}
    sponsors = (
        {
            o.id: o
            for o in await session.scalars(
                select(Organization).where(Organization.id.in_(sponsor_ids))
            )
        }
        if sponsor_ids
        else {}
    )
    codes = (
        dict(
            (
                await session.execute(
                    select(Certificate.enrollment_id, Certificate.code).where(
                        Certificate.enrollment_id.in_([e.id for e in enrollments]),
                        Certificate.revoked_at.is_(None),
                    )
                )
            ).all()
        )
        if enrollments
        else {}
    )
    rows = []
    for e in enrollments:
        user = users[e.user_id]
        sponsor = sponsors.get(e.sponsor_organization_id) if e.sponsor_organization_id else None
        rows.append(
            AdminEnrollment(
                id=e.id,
                learner=AcademyPerson(id=user.id, display_name=user.display_name, email=user.email),
                course=common.card(courses[e.course_id], stats[e.course_id], locale),
                progress=progress[e.id],
                enrolled_at=e.created_at,
                last_activity_at=e.last_activity_at,
                completed_at=e.completed_at,
                certificate_code=codes.get(e.id),
                sponsor=AcademyOrganization(id=sponsor.id, name=sponsor.name, slug=sponsor.slug)
                if sponsor
                else None,
            )
        )
    return rows


async def delete_enrollment(
    session: AsyncSession, ctx: OrganizationContext, enrollment_id: uuid.UUID
) -> None:
    """Removes a learner from a course (progress is lost; an issued certificate stays)."""
    _require(ctx)
    enrollment = await session.get(Enrollment, enrollment_id)
    if enrollment is None:
        raise NotFoundError("Enrollment not found")
    await session.delete(enrollment)
    await session.commit()
