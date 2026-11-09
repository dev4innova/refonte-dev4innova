import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_session
from app.modules.academy import certificate_pdf, content, learning
from app.modules.academy.models import Lesson, Module, Question
from app.modules.academy.schemas import (
    AcademyOrganization,
    AdminCourse,
    AdminCourseSummary,
    AdminEnrollment,
    AdminLesson,
    AdminQuestion,
    CertificateOut,
    CourseCard,
    CourseIn,
    CourseOutline,
    EnrollIn,
    EnrollResult,
    LearnerCourse,
    LessonDone,
    LessonIn,
    LessonView,
    Locale,
    ModuleIn,
    Move,
    MyCourse,
    OrganizationMember,
    QuestionIn,
    QuizResult,
    QuizSubmission,
    QuizView,
    SponsoredEnrollment,
)
from app.modules.identity.dependencies import CurrentUser, OrgContext, StaffContext

Session = Annotated[AsyncSession, Depends(get_session)]
LocaleQuery = Annotated[Locale, Query()]

NOT_FOUND: dict[int | str, dict[str, str]] = {404: {"description": "Not found"}}
SIGNED_IN: dict[int | str, dict[str, str]] = {
    401: {"description": "Missing or invalid access token"},
    404: {"description": "Not found, or not enrolled"},
}

public_router = APIRouter(prefix="/academy", tags=["academy"])
learner_router = APIRouter(prefix="/me/academy", tags=["academy"], responses=SIGNED_IN)
org_router = APIRouter(
    prefix="/organizations/{organization_id}/academy",
    tags=["academy"],
    responses=SIGNED_IN | {403: {"description": "Owners and admins only"}},
)
admin_router = APIRouter(
    prefix="/admin/academy",
    tags=["academy-admin"],
    responses=SIGNED_IN | {403: {"description": "The staff role does not allow this action"}},
)


def _no_content() -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Public ------------------------------------------------------------------------------


@public_router.get("/courses", response_model=list[CourseCard], summary="Catalog of open courses")
async def catalog(session: Session, locale: LocaleQuery = "fr") -> list[CourseCard]:
    return await learning.catalog(session, locale)


@public_router.get(
    "/courses/{slug}",
    response_model=CourseOutline,
    summary="A course and its outline",
    responses=NOT_FOUND,
)
async def course(slug: str, session: Session, locale: LocaleQuery = "fr") -> CourseOutline:
    return await learning.outline(session, slug, locale)


@public_router.get(
    "/certificates/{code}",
    response_model=CertificateOut,
    summary="Verify a certificate",
    responses=NOT_FOUND,
)
async def verify_certificate(
    code: str, session: Session, locale: LocaleQuery = "fr"
) -> CertificateOut:
    return await learning.certificate(session, code, locale)


@public_router.get(
    "/certificates/{code}/pdf",
    summary="PDF of a certificate",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}, **NOT_FOUND},
)
async def certificate_pdf_download(
    code: str, session: Session, locale: LocaleQuery = "fr"
) -> Response:
    cert = await learning.certificate(session, code, locale)
    path = "academy/certificat" if locale == "fr" else "academy/certificate"
    url = f"{get_settings().site_url.rstrip('/')}/{locale}/{path}/{cert.code}"
    return Response(
        certificate_pdf.render(cert, locale, url),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="certificate-{cert.code}.pdf"',
            "Cache-Control": "no-store",
        },
    )


# --- Learners ----------------------------------------------------------------------------


@public_router.post(
    "/courses/{slug}/enroll",
    response_model=MyCourse,
    summary="Enroll in an open course (signed in)",
    responses=SIGNED_IN,
)
async def enroll(
    slug: str, user: CurrentUser, session: Session, locale: LocaleQuery = "fr"
) -> MyCourse:
    await learning.enroll(session, user, slug)
    return (await learning.learner_course(session, user, slug, locale)).model_copy()


@learner_router.get("/courses", response_model=list[MyCourse], summary="My courses and my progress")
async def my_courses(
    user: CurrentUser, session: Session, locale: LocaleQuery = "fr"
) -> list[MyCourse]:
    return await learning.my_courses(session, user, locale)


@learner_router.get("/courses/{slug}", response_model=LearnerCourse, summary="A course I follow")
async def my_course(
    slug: str, user: CurrentUser, session: Session, locale: LocaleQuery = "fr"
) -> LearnerCourse:
    return await learning.learner_course(session, user, slug, locale)


@learner_router.get("/lessons/{lesson_id}", response_model=LessonView, summary="A lesson")
async def lesson(
    lesson_id: uuid.UUID, user: CurrentUser, session: Session, locale: LocaleQuery = "fr"
) -> LessonView:
    return await learning.lesson_view(session, user, lesson_id, locale)


@learner_router.post(
    "/lessons/{lesson_id}/complete", response_model=LessonDone, summary="Mark a lesson as done"
)
async def complete(lesson_id: uuid.UUID, user: CurrentUser, session: Session) -> LessonDone:
    return await learning.complete_lesson(session, user, lesson_id)


@learner_router.get(
    "/quizzes/{module_id}", response_model=QuizView, summary="Quiz of a module (no answers)"
)
async def quiz(
    module_id: uuid.UUID, user: CurrentUser, session: Session, locale: LocaleQuery = "fr"
) -> QuizView:
    return await learning.quiz_view(session, user, module_id, locale)


@learner_router.post(
    "/quizzes/{module_id}", response_model=QuizResult, summary="Answer a quiz (graded)"
)
async def answer_quiz(
    module_id: uuid.UUID,
    data: QuizSubmission,
    user: CurrentUser,
    session: Session,
    locale: LocaleQuery = "fr",
) -> QuizResult:
    return await learning.submit_quiz(session, user, module_id, data.answers, locale)


@org_router.get(
    "/enrollments",
    response_model=list[SponsoredEnrollment],
    summary="Progress of the members enrolled by the team",
)
async def sponsored(
    ctx: OrgContext, session: Session, locale: LocaleQuery = "fr"
) -> list[SponsoredEnrollment]:
    return await learning.sponsored(session, ctx, locale)


# --- Back office -------------------------------------------------------------------------


@admin_router.get("/courses", response_model=list[AdminCourseSummary], summary="All courses")
async def admin_courses(ctx: StaffContext, session: Session) -> list[AdminCourseSummary]:
    return await content.list_courses(session, ctx)


@admin_router.post(
    "/courses",
    response_model=AdminCourse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a course (draft)",
    responses={409: {"description": "Address already used"}},
)
async def create_course(data: CourseIn, ctx: StaffContext, session: Session) -> AdminCourse:
    created = await content.create_course(session, ctx, data)
    return await content.course_out(session, ctx, created.id)


@admin_router.get(
    "/courses/{course_id}", response_model=AdminCourse, summary="A course and its outline"
)
async def admin_course(course_id: uuid.UUID, ctx: StaffContext, session: Session) -> AdminCourse:
    return await content.course_out(session, ctx, course_id)


@admin_router.put("/courses/{course_id}", response_model=AdminCourse, summary="Update a course")
async def update_course(
    course_id: uuid.UUID, data: CourseIn, ctx: StaffContext, session: Session
) -> AdminCourse:
    await content.update_course(session, ctx, course_id, data)
    return await content.course_out(session, ctx, course_id)


@admin_router.post(
    "/courses/{course_id}/publish",
    response_model=AdminCourse,
    summary="Publish (needs every text in both languages)",
    responses={409: {"description": "Something is missing: details.missing"}},
)
async def publish(course_id: uuid.UUID, ctx: StaffContext, session: Session) -> AdminCourse:
    await content.set_published(session, ctx, course_id, True)
    return await content.course_out(session, ctx, course_id)


@admin_router.post(
    "/courses/{course_id}/unpublish", response_model=AdminCourse, summary="Back to draft"
)
async def unpublish(course_id: uuid.UUID, ctx: StaffContext, session: Session) -> AdminCourse:
    await content.set_published(session, ctx, course_id, False)
    return await content.course_out(session, ctx, course_id)


@admin_router.delete(
    "/courses/{course_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a course nobody is enrolled in",
    responses={409: {"description": "Learners are enrolled"}},
)
async def delete_course(course_id: uuid.UUID, ctx: StaffContext, session: Session) -> Response:
    await content.delete_course(session, ctx, course_id)
    return _no_content()


@admin_router.post(
    "/courses/{course_id}/modules",
    response_model=AdminCourse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a module",
)
async def create_module(
    course_id: uuid.UUID, data: ModuleIn, ctx: StaffContext, session: Session
) -> AdminCourse:
    await content.create_module(session, ctx, course_id, data)
    return await content.course_out(session, ctx, course_id)


@admin_router.put("/modules/{module_id}", response_model=AdminCourse, summary="Update a module")
async def update_module(
    module_id: uuid.UUID, data: ModuleIn, ctx: StaffContext, session: Session
) -> AdminCourse:
    course_id = await content.update_module(session, ctx, module_id, data)
    return await content.course_out(session, ctx, course_id)


@admin_router.post(
    "/modules/{module_id}/lessons",
    response_model=AdminLesson,
    status_code=status.HTTP_201_CREATED,
    summary="Add a lesson",
    responses={422: {"description": "Invalid video link (YouTube or Vimeo only)"}},
)
async def create_lesson(
    module_id: uuid.UUID, data: LessonIn, ctx: StaffContext, session: Session
) -> AdminLesson:
    lesson_ = await content.create_lesson(session, ctx, module_id, data)
    return await content.get_lesson(session, ctx, lesson_.id)


@admin_router.get("/lessons/{lesson_id}", response_model=AdminLesson, summary="A lesson")
async def admin_lesson(lesson_id: uuid.UUID, ctx: StaffContext, session: Session) -> AdminLesson:
    return await content.get_lesson(session, ctx, lesson_id)


@admin_router.put(
    "/lessons/{lesson_id}",
    response_model=AdminLesson,
    summary="Update a lesson",
    responses={422: {"description": "Invalid video link (YouTube or Vimeo only)"}},
)
async def update_lesson(
    lesson_id: uuid.UUID, data: LessonIn, ctx: StaffContext, session: Session
) -> AdminLesson:
    return await content.update_lesson(session, ctx, lesson_id, data)


@admin_router.post(
    "/modules/{module_id}/questions",
    response_model=AdminQuestion,
    status_code=status.HTTP_201_CREATED,
    summary="Add a quiz question",
)
async def create_question(
    module_id: uuid.UUID, data: QuestionIn, ctx: StaffContext, session: Session
) -> AdminQuestion:
    question = await content.create_question(session, ctx, module_id, data)
    return content._question_out(question)


@admin_router.put(
    "/questions/{question_id}", response_model=AdminQuestion, summary="Update a question"
)
async def update_question(
    question_id: uuid.UUID, data: QuestionIn, ctx: StaffContext, session: Session
) -> AdminQuestion:
    return await content.update_question(session, ctx, question_id, data)


def _item_routes[P: (Module, Lesson, Question)](kind: str, model: type[P], name: str) -> None:
    async def delete(item_id: uuid.UUID, ctx: StaffContext, session: Session) -> Response:
        await content.delete_item(session, ctx, model, item_id)
        return _no_content()

    async def move(
        item_id: uuid.UUID, data: Move, ctx: StaffContext, session: Session
    ) -> AdminCourse:
        course_id = await content.move_item(session, ctx, model, item_id, data.direction)
        return await content.course_out(session, ctx, course_id)

    admin_router.add_api_route(
        f"/{kind}/{{item_id}}",
        delete,
        methods=["DELETE"],
        status_code=status.HTTP_204_NO_CONTENT,
        summary=f"Delete a {name}",
        name=f"delete_{name}",
        response_class=Response,
    )
    admin_router.add_api_route(
        f"/{kind}/{{item_id}}/move",
        move,
        methods=["POST"],
        response_model=AdminCourse,
        summary=f"Move a {name} up or down",
        name=f"move_{name}",
    )


_item_routes("modules", Module, "module")
_item_routes("lessons", Lesson, "lesson")
_item_routes("questions", Question, "question")


@admin_router.get(
    "/organizations", response_model=list[AcademyOrganization], summary="Client organizations"
)
async def organizations(ctx: StaffContext, session: Session) -> list[AcademyOrganization]:
    return await content.client_organizations(session, ctx)


@admin_router.get(
    "/courses/{course_id}/organizations/{organization_id}/members",
    response_model=list[OrganizationMember],
    summary="Members of a client organization, and whether they follow the course",
)
async def members(
    course_id: uuid.UUID, organization_id: uuid.UUID, ctx: StaffContext, session: Session
) -> list[OrganizationMember]:
    return await content.organization_members(session, ctx, course_id, organization_id)


@admin_router.get(
    "/courses/{course_id}/enrollments", response_model=list[AdminEnrollment], summary="Learners"
)
async def enrollments(
    course_id: uuid.UUID, ctx: StaffContext, session: Session
) -> list[AdminEnrollment]:
    return await content.list_enrollments(session, ctx, course_id)


@admin_router.post(
    "/courses/{course_id}/enrollments",
    response_model=EnrollResult,
    summary="Enroll members of a client organization",
    responses={409: {"description": "The course is not published"}},
)
async def enroll_members(
    course_id: uuid.UUID, data: EnrollIn, ctx: StaffContext, session: Session
) -> EnrollResult:
    return await content.enroll_members(session, ctx, course_id, data)


@admin_router.delete(
    "/enrollments/{enrollment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a learner from a course",
)
async def delete_enrollment(
    enrollment_id: uuid.UUID, ctx: StaffContext, session: Session
) -> Response:
    await content.delete_enrollment(session, ctx, enrollment_id)
    return _no_content()
