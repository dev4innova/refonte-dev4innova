import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.storage import PrivateStorage, get_private_storage
from app.db.session import get_session
from app.modules.identity.dependencies import CurrentUser, OrgContext, StaffContext
from app.modules.portal import dashboard, notifications, projects, support
from app.modules.portal.files import FileRejectedError
from app.modules.portal.schemas import (
    AdminDashboard,
    CommentCreate,
    CommentOut,
    CommentTarget,
    Dashboard,
    DeliverableOut,
    DeliverableUpdate,
    DownloadLink,
    FileOut,
    NotificationPage,
    OrganizationRef,
    Person,
    ProjectCreate,
    ProjectDetail,
    ProjectPage,
    ProjectStatus,
    ProjectUpdate,
    Review,
    TaskCreate,
    TaskOut,
    TaskUpdate,
    TicketCreate,
    TicketDetail,
    TicketFilter,
    TicketPage,
    TicketReply,
    TicketUpdate,
    UnreadCount,
)

Session = Annotated[AsyncSession, Depends(get_session)]
Storage = Annotated[PrivateStorage, Depends(get_private_storage)]

COMMON: dict[int | str, dict[str, str]] = {
    401: {"description": "Missing or invalid access token"},
    404: {"description": "Not found, or not a member of the organization"},
}
UPLOAD: dict[int | str, dict[str, Any]] = {
    422: {"description": "Unsupported type, empty or too large (25 MB by default)"}
}

router = APIRouter(
    prefix="/organizations/{organization_id}/portal", tags=["portal"], responses=COMMON
)
admin_router = APIRouter(
    prefix="/admin/portal",
    tags=["portal-admin"],
    responses=COMMON | {403: {"description": "The staff role does not allow this action"}},
)
notifications_router = APIRouter(
    prefix="/me/notifications", tags=["notifications"], responses=COMMON
)


async def _read(file: UploadFile) -> tuple[str, bytes]:
    limit = get_settings().portal_file_max_bytes
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise FileRejectedError(
            "This file is too large", {"reason": "too_large", "max_bytes": limit}
        )
    return file.filename or "file", data


def _no_content() -> Response:
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Client portal ---------------------------------------------------------------------


@router.get("/dashboard", response_model=Dashboard, summary="Portal home of the organization")
async def client_dashboard(ctx: OrgContext, session: Session) -> Dashboard:
    return await dashboard.client_dashboard(session, ctx)


@router.get("/projects", response_model=ProjectPage, summary="Projects of the organization")
async def list_projects(
    ctx: OrgContext,
    session: Session,
    project_status: Annotated[ProjectStatus | None, Query(alias="status")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
) -> ProjectPage:
    return await projects.list_projects(session, ctx, status=project_status, page=page)


@router.get("/projects/{project_id}", response_model=ProjectDetail, summary="A project")
async def get_project(project_id: uuid.UUID, ctx: OrgContext, session: Session) -> ProjectDetail:
    return await projects.project_detail(session, ctx, project_id)


@router.post(
    "/deliverables/{deliverable_id}/review",
    response_model=DeliverableOut,
    summary="Approve a deliverable or request changes (owners and admins)",
    responses={409: {"description": "Not waiting for a review"}},
)
async def review_deliverable(
    deliverable_id: uuid.UUID, data: Review, ctx: OrgContext, session: Session
) -> DeliverableOut:
    await projects.review_deliverable(session, ctx, deliverable_id, data)
    return await projects.deliverable_out(session, ctx, deliverable_id)


@router.get(
    "/comments/{target_type}/{target_id}", response_model=list[CommentOut], summary="Comments"
)
async def list_comments(
    target_type: CommentTarget, target_id: uuid.UUID, ctx: OrgContext, session: Session
) -> list[CommentOut]:
    return await projects.list_comments(session, ctx, target_type, target_id)


@router.post(
    "/comments/{target_type}/{target_id}",
    response_model=list[CommentOut],
    status_code=status.HTTP_201_CREATED,
    summary="Comment on a task or a deliverable",
)
async def add_comment(
    target_type: CommentTarget,
    target_id: uuid.UUID,
    data: CommentCreate,
    ctx: OrgContext,
    session: Session,
) -> list[CommentOut]:
    await projects.add_comment(session, ctx, target_type, target_id, data.body)
    return await projects.list_comments(session, ctx, target_type, target_id)


@router.get("/documents", response_model=list[FileOut], summary="Shared documents")
async def list_documents(
    ctx: OrgContext, session: Session, project_id: uuid.UUID | None = None
) -> list[FileOut]:
    return await projects.list_documents(session, ctx, project_id=project_id)


@router.post(
    "/documents",
    response_model=FileOut,
    status_code=status.HTTP_201_CREATED,
    summary="Share a document with the team",
    responses=UPLOAD,
)
async def upload_document(
    ctx: OrgContext,
    session: Session,
    storage: Storage,
    file: Annotated[UploadFile, File()],
    project_id: Annotated[uuid.UUID | None, Form()] = None,
) -> FileOut:
    filename, data = await _read(file)
    return await projects.upload_document(
        session,
        ctx,
        storage,
        organization_id=ctx.organization_id,
        project_id=project_id,
        filename=filename,
        data=data,
    )


@router.delete(
    "/documents/{file_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a document"
)
async def delete_document(
    file_id: uuid.UUID, ctx: OrgContext, session: Session, storage: Storage
) -> Response:
    await projects.delete_document(session, ctx, storage, file_id)
    return _no_content()


@router.get(
    "/files/{file_id}/download",
    response_model=DownloadLink,
    summary="Short-lived signed link to download a document or a deliverable",
)
async def download(
    file_id: uuid.UUID, ctx: OrgContext, session: Session, storage: Storage
) -> DownloadLink:
    return await projects.download_link(session, ctx, storage, file_id)


@router.get("/tickets", response_model=TicketPage, summary="Support tickets of the organization")
async def list_tickets(
    ctx: OrgContext,
    session: Session,
    state: TicketFilter = "open",
    page: Annotated[int, Query(ge=1)] = 1,
) -> TicketPage:
    return await support.list_tickets(session, ctx, state=state, page=page)


@router.post(
    "/tickets",
    response_model=TicketDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Open a support ticket",
)
async def create_ticket(data: TicketCreate, ctx: OrgContext, session: Session) -> TicketDetail:
    ticket = await support.create_ticket(session, ctx, data)
    return await support.ticket_detail(session, ctx, ticket.id)


@router.get("/tickets/{ticket_id}", response_model=TicketDetail, summary="A ticket and its thread")
async def get_ticket(ticket_id: uuid.UUID, ctx: OrgContext, session: Session) -> TicketDetail:
    return await support.ticket_detail(session, ctx, ticket_id)


@router.post(
    "/tickets/{ticket_id}/messages", response_model=TicketDetail, summary="Reply (reopens it)"
)
async def reply_ticket(
    ticket_id: uuid.UUID, data: TicketReply, ctx: OrgContext, session: Session
) -> TicketDetail:
    await support.reply(session, ctx, ticket_id, data.model_copy(update={"status": None}))
    return await support.ticket_detail(session, ctx, ticket_id)


@router.post("/tickets/{ticket_id}/close", response_model=TicketDetail, summary="Close a ticket")
async def close_ticket(ticket_id: uuid.UUID, ctx: OrgContext, session: Session) -> TicketDetail:
    await support.close(session, ctx, ticket_id)
    return await support.ticket_detail(session, ctx, ticket_id)


# --- Staff -----------------------------------------------------------------------------


@admin_router.get(
    "/dashboard", response_model=AdminDashboard, summary="Delivery and support overview"
)
async def admin_dashboard(ctx: StaffContext, session: Session) -> AdminDashboard:
    return await dashboard.admin_dashboard(session, ctx)


@admin_router.get(
    "/organizations", response_model=list[OrganizationRef], summary="Client organizations"
)
async def client_organizations(ctx: StaffContext, session: Session) -> list[OrganizationRef]:
    return await dashboard.client_organizations(session, ctx)


@admin_router.get("/team", response_model=list[Person], summary="Staff who manage the portal")
async def team(ctx: StaffContext, session: Session) -> list[Person]:
    return await dashboard.team(session, ctx)


@admin_router.get("/projects", response_model=ProjectPage, summary="Projects of every client")
async def admin_list_projects(
    ctx: StaffContext,
    session: Session,
    organization_id: uuid.UUID | None = None,
    project_status: Annotated[ProjectStatus | None, Query(alias="status")] = None,
    active: bool = False,
    page: Annotated[int, Query(ge=1)] = 1,
) -> ProjectPage:
    return await projects.list_projects(
        session,
        ctx,
        organization_id=organization_id,
        status=project_status,
        active_only=active,
        page=page,
    )


@admin_router.post(
    "/projects",
    response_model=ProjectDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a project for a client organization",
)
async def create_project(data: ProjectCreate, ctx: StaffContext, session: Session) -> ProjectDetail:
    project = await projects.create_project(session, ctx, data)
    return await projects.project_detail(session, ctx, project.id)


@admin_router.get("/projects/{project_id}", response_model=ProjectDetail, summary="A project")
async def admin_get_project(
    project_id: uuid.UUID, ctx: StaffContext, session: Session
) -> ProjectDetail:
    return await projects.project_detail(session, ctx, project_id)


@admin_router.patch("/projects/{project_id}", response_model=ProjectDetail, summary="Update")
async def update_project(
    project_id: uuid.UUID, data: ProjectUpdate, ctx: StaffContext, session: Session
) -> ProjectDetail:
    await projects.update_project(session, ctx, project_id, data)
    return await projects.project_detail(session, ctx, project_id)


@admin_router.delete(
    "/projects/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a project, its tasks, deliverables and files",
)
async def delete_project(
    project_id: uuid.UUID, ctx: StaffContext, session: Session, storage: Storage
) -> Response:
    await projects.delete_project(session, ctx, storage, project_id)
    return _no_content()


@admin_router.post(
    "/projects/{project_id}/tasks",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a task",
)
async def create_task(
    project_id: uuid.UUID, data: TaskCreate, ctx: StaffContext, session: Session
) -> TaskOut:
    return projects.task_out(await projects.create_task(session, ctx, project_id, data))


@admin_router.patch("/tasks/{task_id}", response_model=TaskOut, summary="Update a task")
async def update_task(
    task_id: uuid.UUID, data: TaskUpdate, ctx: StaffContext, session: Session
) -> TaskOut:
    return projects.task_out(await projects.update_task(session, ctx, task_id, data))


@admin_router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete")
async def delete_task(task_id: uuid.UUID, ctx: StaffContext, session: Session) -> Response:
    await projects.delete_task(session, ctx, task_id)
    return _no_content()


@admin_router.post(
    "/projects/{project_id}/deliverables",
    response_model=DeliverableOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a deliverable for the client's review",
    responses=UPLOAD,
)
async def submit_deliverable(
    project_id: uuid.UUID,
    ctx: StaffContext,
    session: Session,
    storage: Storage,
    title: Annotated[str, Form(min_length=2, max_length=200)],
    file: Annotated[UploadFile, File()],
    description: Annotated[str, Form(max_length=5000)] = "",
) -> DeliverableOut:
    filename, data = await _read(file)
    deliverable = await projects.submit_deliverable(
        session,
        ctx,
        storage,
        project_id,
        title=title.strip(),
        description=description.strip(),
        filename=filename,
        data=data,
    )
    return await projects.deliverable_out(session, ctx, deliverable.id)


@admin_router.post(
    "/deliverables/{deliverable_id}/versions",
    response_model=DeliverableOut,
    summary="Submit a new version (replaces the file, the review starts again)",
    responses=UPLOAD | {409: {"description": "Already approved"}},
)
async def submit_version(
    deliverable_id: uuid.UUID,
    ctx: StaffContext,
    session: Session,
    storage: Storage,
    file: Annotated[UploadFile, File()],
) -> DeliverableOut:
    filename, data = await _read(file)
    await projects.submit_version(
        session, ctx, storage, deliverable_id, filename=filename, data=data
    )
    return await projects.deliverable_out(session, ctx, deliverable_id)


@admin_router.patch(
    "/deliverables/{deliverable_id}", response_model=DeliverableOut, summary="Rename, describe"
)
async def update_deliverable(
    deliverable_id: uuid.UUID, data: DeliverableUpdate, ctx: StaffContext, session: Session
) -> DeliverableOut:
    await projects.update_deliverable(session, ctx, deliverable_id, data)
    return await projects.deliverable_out(session, ctx, deliverable_id)


@admin_router.delete(
    "/deliverables/{deliverable_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete"
)
async def delete_deliverable(
    deliverable_id: uuid.UUID, ctx: StaffContext, session: Session, storage: Storage
) -> Response:
    await projects.delete_deliverable(session, ctx, storage, deliverable_id)
    return _no_content()


@admin_router.get(
    "/comments/{target_type}/{target_id}", response_model=list[CommentOut], summary="Comments"
)
async def admin_list_comments(
    target_type: CommentTarget, target_id: uuid.UUID, ctx: StaffContext, session: Session
) -> list[CommentOut]:
    return await projects.list_comments(session, ctx, target_type, target_id)


@admin_router.post(
    "/comments/{target_type}/{target_id}",
    response_model=list[CommentOut],
    status_code=status.HTTP_201_CREATED,
    summary="Comment on a task or a deliverable",
)
async def admin_add_comment(
    target_type: CommentTarget,
    target_id: uuid.UUID,
    data: CommentCreate,
    ctx: StaffContext,
    session: Session,
) -> list[CommentOut]:
    await projects.add_comment(session, ctx, target_type, target_id, data.body)
    return await projects.list_comments(session, ctx, target_type, target_id)


@admin_router.post(
    "/organizations/{organization_id}/documents",
    response_model=FileOut,
    status_code=status.HTTP_201_CREATED,
    summary="Share a document with a client",
    responses=UPLOAD,
)
async def admin_upload_document(
    organization_id: uuid.UUID,
    ctx: StaffContext,
    session: Session,
    storage: Storage,
    file: Annotated[UploadFile, File()],
    project_id: Annotated[uuid.UUID | None, Form()] = None,
) -> FileOut:
    filename, data = await _read(file)
    return await projects.upload_document(
        session,
        ctx,
        storage,
        organization_id=organization_id,
        project_id=project_id,
        filename=filename,
        data=data,
    )


@admin_router.delete(
    "/documents/{file_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a document"
)
async def admin_delete_document(
    file_id: uuid.UUID, ctx: StaffContext, session: Session, storage: Storage
) -> Response:
    await projects.delete_document(session, ctx, storage, file_id)
    return _no_content()


@admin_router.get(
    "/files/{file_id}/download", response_model=DownloadLink, summary="Signed download link"
)
async def admin_download(
    file_id: uuid.UUID, ctx: StaffContext, session: Session, storage: Storage
) -> DownloadLink:
    return await projects.download_link(session, ctx, storage, file_id)


@admin_router.get("/tickets", response_model=TicketPage, summary="Support tickets of every client")
async def admin_list_tickets(
    ctx: StaffContext,
    session: Session,
    state: TicketFilter = "open",
    organization_id: uuid.UUID | None = None,
    mine: bool = False,
    page: Annotated[int, Query(ge=1)] = 1,
) -> TicketPage:
    return await support.list_tickets(
        session, ctx, state=state, organization_id=organization_id, mine=mine, page=page
    )


@admin_router.get("/tickets/{ticket_id}", response_model=TicketDetail, summary="A ticket")
async def admin_get_ticket(
    ticket_id: uuid.UUID, ctx: StaffContext, session: Session
) -> TicketDetail:
    return await support.ticket_detail(session, ctx, ticket_id)


@admin_router.post(
    "/tickets/{ticket_id}/messages",
    response_model=TicketDetail,
    summary="Answer (by default the ticket then waits for the customer)",
)
async def admin_reply_ticket(
    ticket_id: uuid.UUID, data: TicketReply, ctx: StaffContext, session: Session
) -> TicketDetail:
    await support.reply(session, ctx, ticket_id, data)
    return await support.ticket_detail(session, ctx, ticket_id)


@admin_router.patch(
    "/tickets/{ticket_id}", response_model=TicketDetail, summary="Status, priority, assignee"
)
async def admin_update_ticket(
    ticket_id: uuid.UUID, data: TicketUpdate, ctx: StaffContext, session: Session
) -> TicketDetail:
    await support.update(session, ctx, ticket_id, data)
    return await support.ticket_detail(session, ctx, ticket_id)


# --- Notifications (TASK-102) ----------------------------------------------------------


@notifications_router.get("", response_model=NotificationPage, summary="My notifications")
async def list_notifications(
    user: CurrentUser,
    session: Session,
    unread: bool = False,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> NotificationPage:
    return await notifications.list_notifications(
        session, user, unread_only=unread, page=page, page_size=page_size
    )


@notifications_router.get("/unread", response_model=UnreadCount, summary="Unread count")
async def unread_count(user: CurrentUser, session: Session) -> UnreadCount:
    return UnreadCount(unread=await notifications.unread_count(session, user))


@notifications_router.post(
    "/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT, summary="Mark as read"
)
async def mark_read(notification_id: uuid.UUID, user: CurrentUser, session: Session) -> Response:
    await notifications.mark_read(session, user, notification_id)
    return _no_content()


@notifications_router.post(
    "/read", status_code=status.HTTP_204_NO_CONTENT, summary="Mark all as read"
)
async def mark_all_read(user: CurrentUser, session: Session) -> Response:
    await notifications.mark_all_read(session, user)
    return _no_content()
