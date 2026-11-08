"""Projects, tasks, deliverables, documents and comments (TASK-096 to TASK-100)."""

import logging
import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import ConflictError, NotFoundError, PermissionDeniedError
from app.core.storage import PrivateStorage
from app.modules.identity.permissions import Permission
from app.modules.identity.service import OrganizationContext
from app.modules.portal import access
from app.modules.portal.access import is_staff_context, now, project_for, require_manage
from app.modules.portal.files import FileRejectedError, clean_name, detect
from app.modules.portal.models import (
    ACTIVE_PROJECT_STATUSES,
    OPEN_TASK_STATUSES,
    Comment,
    Deliverable,
    Project,
    StoredFile,
    Task,
)
from app.modules.portal.schemas import (
    CommentOut,
    DeliverableOut,
    DeliverableUpdate,
    DownloadLink,
    FileOut,
    Person,
    Progress,
    ProjectCreate,
    ProjectDetail,
    ProjectPage,
    ProjectStatus,
    ProjectSummary,
    ProjectUpdate,
    Review,
    TaskCreate,
    TaskOut,
    TaskUpdate,
)

logger = logging.getLogger(__name__)


# --- Mapping -------------------------------------------------------------------------


async def summaries(session: AsyncSession, projects: Sequence[Project]) -> list[ProjectSummary]:
    """Projects with their progress and pending deliverables, in a fixed number of queries."""
    ids = [p.id for p in projects]
    progress: dict[uuid.UUID, tuple[int, int]] = {}
    pending: dict[uuid.UUID, int] = {}
    if ids:
        rows = await session.execute(
            select(
                Task.project_id,
                func.count(),
                func.count(case((Task.status == "done", 1))),
            )
            .where(Task.project_id.in_(ids))
            .group_by(Task.project_id)
        )
        progress = {project_id: (done, total) for project_id, total, done in rows}
        pending_rows = await session.execute(
            select(Deliverable.project_id, func.count())
            .where(Deliverable.project_id.in_(ids), Deliverable.status == "pending_review")
            .group_by(Deliverable.project_id)
        )
        pending = {project_id: count for project_id, count in pending_rows}
    people = await access.people(session, [p.manager_id for p in projects])
    orgs = await access.organizations(session, [p.organization_id for p in projects])
    result = []
    for project in projects:
        done, total = progress.get(project.id, (0, 0))
        result.append(
            ProjectSummary(
                id=project.id,
                organization=orgs[project.organization_id],
                name=project.name,
                status=project.status,
                start_date=project.start_date,
                due_date=project.due_date,
                manager=people.get(project.manager_id) if project.manager_id else None,
                progress=Progress(
                    done=done, total=total, percent=round(100 * done / total) if total else 0
                ),
                pending_deliverables=pending.get(project.id, 0),
                updated_at=project.updated_at,
            )
        )
    return result


async def _comment_counts(
    session: AsyncSession, target_type: str, ids: Sequence[uuid.UUID]
) -> dict[uuid.UUID, int]:
    if not ids:
        return {}
    rows = await session.execute(
        select(Comment.target_id, func.count())
        .where(Comment.target_type == target_type, Comment.target_id.in_(ids))
        .group_by(Comment.target_id)
    )
    return {target_id: count for target_id, count in rows}


def task_out(task: Task, comments: int = 0) -> TaskOut:
    return TaskOut(
        id=task.id,
        project_id=task.project_id,
        title=task.title,
        description=task.description,
        status=task.status,
        due_date=task.due_date,
        position=task.position,
        comments=comments,
        updated_at=task.updated_at,
    )


def _can_delete(ctx: OrganizationContext, file: StoredFile) -> bool:
    if file.purpose != "document":
        return False
    if is_staff_context(ctx):
        return Permission.PORTAL_MANAGE in ctx.permissions
    if file.uploaded_by_staff:
        return False
    return file.uploaded_by_id == ctx.user.id or Permission.PORTAL_REVIEW in ctx.permissions


def file_out(
    file: StoredFile, people: dict[uuid.UUID, Person], ctx: OrganizationContext | None = None
) -> FileOut:
    return FileOut(
        id=file.id,
        project_id=file.project_id,
        name=file.name,
        content_type=file.content_type,
        size_bytes=file.size_bytes,
        uploaded_by=people.get(file.uploaded_by_id) if file.uploaded_by_id else None,
        uploaded_by_staff=file.uploaded_by_staff,
        created_at=file.created_at,
        can_delete=_can_delete(ctx, file) if ctx else False,
    )


async def _deliverables_out(
    session: AsyncSession, deliverables: Sequence[Deliverable]
) -> list[DeliverableOut]:
    file_ids = [d.file_id for d in deliverables if d.file_id]
    files = {
        f.id: f
        for f in (
            await session.scalars(select(StoredFile).where(StoredFile.id.in_(file_ids)))
            if file_ids
            else []
        )
    }
    people = await access.people(
        session,
        [d.submitted_by_id for d in deliverables]
        + [d.reviewed_by_id for d in deliverables]
        + [f.uploaded_by_id for f in files.values()],
    )
    counts = await _comment_counts(session, "deliverable", [d.id for d in deliverables])

    def person(user_id: uuid.UUID | None) -> Person | None:
        return people.get(user_id) if user_id else None

    return [
        DeliverableOut(
            id=d.id,
            project_id=d.project_id,
            title=d.title,
            description=d.description,
            version=d.version,
            status=d.status,
            file=file_out(files[d.file_id], people) if d.file_id in files else None,
            submitted_by=person(d.submitted_by_id),
            reviewed_by=person(d.reviewed_by_id),
            reviewed_at=d.reviewed_at,
            review_comment=d.review_comment,
            comments=counts.get(d.id, 0),
            created_at=d.created_at,
            updated_at=d.updated_at,
        )
        for d in deliverables
    ]


# --- Projects (TASK-097) -------------------------------------------------------------


async def list_projects(
    session: AsyncSession,
    ctx: OrganizationContext,
    *,
    organization_id: uuid.UUID | None = None,
    status: ProjectStatus | None = None,
    active_only: bool = False,
    page: int = 1,
    page_size: int = 50,
) -> ProjectPage:
    query = select(Project)
    if is_staff_context(ctx):
        require_manage(ctx)
        if organization_id:
            query = query.where(Project.organization_id == organization_id)
    else:
        ctx.require(Permission.PORTAL_USE)
        query = query.where(Project.organization_id == ctx.organization_id)
    if status:
        query = query.where(Project.status == status)
    elif active_only:
        query = query.where(Project.status.in_(ACTIVE_PROJECT_STATUSES))
    total = await session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = await session.scalars(
        query.order_by(
            case((Project.status.in_(ACTIVE_PROJECT_STATUSES), 0), else_=1),
            Project.updated_at.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return ProjectPage(
        items=await summaries(session, list(rows)), total=total, page=page, page_size=page_size
    )


async def project_detail(
    session: AsyncSession, ctx: OrganizationContext, project_id: uuid.UUID
) -> ProjectDetail:
    project = await project_for(session, ctx, project_id)
    tasks = list(
        await session.scalars(
            select(Task)
            .where(Task.project_id == project.id)
            .order_by(Task.position, Task.due_date.nulls_last(), Task.created_at)
        )
    )
    task_comments = await _comment_counts(session, "task", [t.id for t in tasks])
    deliverables = list(
        await session.scalars(
            select(Deliverable)
            .where(Deliverable.project_id == project.id)
            .order_by(Deliverable.created_at.desc())
        )
    )
    documents = list(
        await session.scalars(
            select(StoredFile)
            .where(StoredFile.project_id == project.id, StoredFile.purpose == "document")
            .order_by(StoredFile.created_at.desc())
        )
    )
    people = await access.people(session, [f.uploaded_by_id for f in documents])
    (summary,) = await summaries(session, [project])
    return ProjectDetail(
        **summary.model_dump(),
        description=project.description,
        tasks=[task_out(t, task_comments.get(t.id, 0)) for t in tasks],
        deliverables=await _deliverables_out(session, deliverables),
        documents=[file_out(f, people, ctx) for f in documents],
        can_review=not is_staff_context(ctx) and Permission.PORTAL_REVIEW in ctx.permissions,
    )


async def _check_manager(session: AsyncSession, manager_id: uuid.UUID | None) -> None:
    if manager_id and not await access.is_staff_manager(session, manager_id):
        raise ConflictError("The project manager must be a member of the team")


async def create_project(
    session: AsyncSession, ctx: OrganizationContext, data: ProjectCreate
) -> Project:
    require_manage(ctx)
    await access.client_organization(session, data.organization_id)
    await _check_manager(session, data.manager_id)
    project = Project(**data.model_dump(), created_by_id=ctx.user.id)
    session.add(project)
    await session.flush()
    await access.notify_members(
        session,
        project.organization_id,
        "project_created",
        {"project_id": str(project.id), "project": project.name},
    )
    await session.commit()
    return project


async def update_project(
    session: AsyncSession, ctx: OrganizationContext, project_id: uuid.UUID, data: ProjectUpdate
) -> Project:
    require_manage(ctx)
    project = await project_for(session, ctx, project_id)
    changes = data.model_dump(exclude_unset=True)
    if "manager_id" in changes:
        await _check_manager(session, changes["manager_id"])
    for field in ("name", "status"):
        if field in changes and changes[field] is None:
            del changes[field]
    for field, value in changes.items():
        setattr(project, field, "" if field == "description" and value is None else value)
    if project.start_date and project.due_date and project.due_date < project.start_date:
        raise ConflictError("The due date must not be before the start date")
    await session.commit()
    return project


async def delete_project(
    session: AsyncSession, ctx: OrganizationContext, storage: PrivateStorage, project_id: uuid.UUID
) -> None:
    require_manage(ctx)
    project = await project_for(session, ctx, project_id)
    keys = list(
        await session.scalars(
            select(StoredFile.storage_key).where(StoredFile.project_id == project.id)
        )
    )
    await session.execute(delete(Comment).where(Comment.project_id == project.id))
    await session.delete(project)
    await session.commit()
    for key in keys:
        await _remove_object(storage, key)


async def _remove_object(storage: PrivateStorage, key: str) -> None:
    try:
        await storage.delete(key)
    except Exception:  # the record is gone: an orphan object is logged, not fatal
        logger.exception("Could not delete a portal file from storage", extra={"key": key})


# --- Tasks (TASK-098) ----------------------------------------------------------------


async def _task(session: AsyncSession, ctx: OrganizationContext, task_id: uuid.UUID) -> Task:
    task = await session.get(Task, task_id)
    if task is None:
        raise NotFoundError("Task not found")
    await project_for(session, ctx, task.project_id)  # same access as its project
    return task


async def _notify_review(session: AsyncSession, project: Project, task: Task) -> None:
    await access.notify_members(
        session,
        project.organization_id,
        "task_client_review",
        {
            "project_id": str(project.id),
            "project": project.name,
            "task_id": str(task.id),
            "task": task.title,
        },
    )


async def create_task(
    session: AsyncSession, ctx: OrganizationContext, project_id: uuid.UUID, data: TaskCreate
) -> Task:
    require_manage(ctx)
    project = await project_for(session, ctx, project_id)
    position = await session.scalar(
        select(func.coalesce(func.max(Task.position) + 1, 0)).where(Task.project_id == project.id)
    )
    task = Task(
        **data.model_dump(),
        organization_id=project.organization_id,
        project_id=project.id,
        position=position or 0,
        created_by_id=ctx.user.id,
    )
    session.add(task)
    await session.flush()
    if task.status == "client_review":
        await _notify_review(session, project, task)
    project.updated_at = now()
    await session.commit()
    await session.refresh(task)
    return task


async def update_task(
    session: AsyncSession, ctx: OrganizationContext, task_id: uuid.UUID, data: TaskUpdate
) -> Task:
    require_manage(ctx)
    task = await _task(session, ctx, task_id)
    changes = data.model_dump(exclude_unset=True)
    for field in ("title", "status", "position"):
        if field in changes and changes[field] is None:
            del changes[field]
    previous = task.status
    for field, value in changes.items():
        setattr(task, field, "" if field == "description" and value is None else value)
    project = await session.get_one(Project, task.project_id)
    if task.status == "client_review" and previous != "client_review":
        await _notify_review(session, project, task)
    project.updated_at = now()
    await session.commit()
    await session.refresh(task)
    return task


async def delete_task(session: AsyncSession, ctx: OrganizationContext, task_id: uuid.UUID) -> None:
    require_manage(ctx)
    task = await _task(session, ctx, task_id)
    await session.execute(
        delete(Comment).where(Comment.target_type == "task", Comment.target_id == task.id)
    )
    await session.delete(task)
    await session.commit()


# --- Files (TASK-099, TASK-100) ------------------------------------------------------


async def _store(
    session: AsyncSession,
    ctx: OrganizationContext,
    storage: PrivateStorage,
    *,
    organization_id: uuid.UUID,
    project_id: uuid.UUID | None,
    purpose: str,
    filename: str,
    data: bytes,
) -> StoredFile:
    limit = get_settings().portal_file_max_bytes
    if len(data) > limit:
        raise FileRejectedError(
            "This file is too large", {"reason": "too_large", "max_bytes": limit}
        )
    file_type = detect(filename, data)
    file_id = uuid.uuid4()
    # The organization prefixes the key: objects of two clients never share a path.
    key = f"{organization_id}/{file_id}.{file_type.extension}"
    await storage.put(key, data, file_type.content_type)
    file = StoredFile(
        id=file_id,
        organization_id=organization_id,
        project_id=project_id,
        purpose=purpose,
        name=clean_name(filename, file_type),
        storage_key=key,
        content_type=file_type.content_type,
        size_bytes=len(data),
        uploaded_by_id=ctx.user.id,
        uploaded_by_staff=is_staff_context(ctx),
        created_at=now(),
    )
    session.add(file)
    await session.flush()
    return file


async def list_documents(
    session: AsyncSession, ctx: OrganizationContext, *, project_id: uuid.UUID | None = None
) -> list[FileOut]:
    """Client: the organization's shared documents (with or without project)."""
    ctx.require(Permission.PORTAL_USE)
    query = select(StoredFile).where(
        StoredFile.organization_id == ctx.organization_id, StoredFile.purpose == "document"
    )
    if project_id:
        query = query.where(StoredFile.project_id == project_id)
    files = list(await session.scalars(query.order_by(StoredFile.created_at.desc()).limit(500)))
    people = await access.people(session, [f.uploaded_by_id for f in files])
    return [file_out(f, people, ctx) for f in files]


async def upload_document(
    session: AsyncSession,
    ctx: OrganizationContext,
    storage: PrivateStorage,
    *,
    organization_id: uuid.UUID,
    project_id: uuid.UUID | None,
    filename: str,
    data: bytes,
) -> FileOut:
    """A document shared by the client (in its organization) or by the staff."""
    project = await project_for(session, ctx, project_id) if project_id else None
    if is_staff_context(ctx):
        require_manage(ctx)
        await access.client_organization(session, organization_id)
    else:
        ctx.require(Permission.PORTAL_USE)
        organization_id = ctx.organization_id
    if project and project.organization_id != organization_id:
        raise NotFoundError("Project not found")
    file = await _store(
        session,
        ctx,
        storage,
        organization_id=organization_id,
        project_id=project_id,
        purpose="document",
        filename=filename,
        data=data,
    )
    payload: dict[str, Any] = {"file_id": str(file.id), "file": file.name}
    if project:
        payload |= {"project_id": str(project.id), "project": project.name}
    if is_staff_context(ctx):
        await access.notify_members(session, organization_id, "document_shared", payload)
    else:
        await access.notify_staff(
            session,
            organization_id,
            "document_uploaded",
            payload | {"organization": ctx.organization.name},
            owner=project.manager_id if project else None,
        )
    await session.commit()
    people = await access.people(session, [ctx.user.id])
    return file_out(file, people, ctx)


async def _file(session: AsyncSession, ctx: OrganizationContext, file_id: uuid.UUID) -> StoredFile:
    query = select(StoredFile).where(StoredFile.id == file_id)
    if is_staff_context(ctx):
        require_manage(ctx)
    else:
        ctx.require(Permission.PORTAL_USE)
        query = query.where(StoredFile.organization_id == ctx.organization_id)
    file = await session.scalar(query)
    if file is None:
        raise NotFoundError("File not found")
    return file


async def delete_document(
    session: AsyncSession, ctx: OrganizationContext, storage: PrivateStorage, file_id: uuid.UUID
) -> None:
    file = await _file(session, ctx, file_id)
    if not _can_delete(ctx, file):
        raise PermissionDeniedError("You cannot delete this file")
    key = file.storage_key
    await session.delete(file)
    await session.commit()
    await _remove_object(storage, key)


async def download_link(
    session: AsyncSession, ctx: OrganizationContext, storage: PrivateStorage, file_id: uuid.UUID
) -> DownloadLink:
    file = await _file(session, ctx, file_id)
    ttl = get_settings().portal_download_ttl_seconds
    url = storage.download_url(
        file.storage_key, filename=file.name, content_type=file.content_type, ttl=ttl
    )
    return DownloadLink(url=url, expires_in=ttl)


# --- Deliverables (TASK-099) ---------------------------------------------------------


async def _deliverable(
    session: AsyncSession, ctx: OrganizationContext, deliverable_id: uuid.UUID
) -> Deliverable:
    deliverable = await session.get(Deliverable, deliverable_id)
    if deliverable is None:
        raise NotFoundError("Deliverable not found")
    await project_for(session, ctx, deliverable.project_id)
    return deliverable


async def deliverable_out(
    session: AsyncSession, ctx: OrganizationContext, deliverable_id: uuid.UUID
) -> DeliverableOut:
    deliverable = await _deliverable(session, ctx, deliverable_id)
    (out,) = await _deliverables_out(session, [deliverable])
    return out


def _deliverable_payload(project: Project, deliverable: Deliverable) -> dict[str, Any]:
    return {
        "project_id": str(project.id),
        "project": project.name,
        "deliverable_id": str(deliverable.id),
        "deliverable": deliverable.title,
        "version": deliverable.version,
    }


async def submit_deliverable(
    session: AsyncSession,
    ctx: OrganizationContext,
    storage: PrivateStorage,
    project_id: uuid.UUID,
    *,
    title: str,
    description: str,
    filename: str,
    data: bytes,
) -> Deliverable:
    require_manage(ctx)
    project = await project_for(session, ctx, project_id)
    file = await _store(
        session,
        ctx,
        storage,
        organization_id=project.organization_id,
        project_id=project.id,
        purpose="deliverable",
        filename=filename,
        data=data,
    )
    deliverable = Deliverable(
        organization_id=project.organization_id,
        project_id=project.id,
        title=title,
        description=description,
        file_id=file.id,
        submitted_by_id=ctx.user.id,
    )
    session.add(deliverable)
    await session.flush()
    await access.notify_members(
        session,
        project.organization_id,
        "deliverable_submitted",
        _deliverable_payload(project, deliverable),
    )
    project.updated_at = now()
    await session.commit()
    return deliverable


async def submit_version(
    session: AsyncSession,
    ctx: OrganizationContext,
    storage: PrivateStorage,
    deliverable_id: uuid.UUID,
    *,
    filename: str,
    data: bytes,
) -> Deliverable:
    """New file after a change request: the previous file is replaced (only the latest
    version is kept), the review starts again."""
    require_manage(ctx)
    deliverable = await _deliverable(session, ctx, deliverable_id)
    if deliverable.status == "approved":
        raise ConflictError("This deliverable is already approved")
    project = await session.get_one(Project, deliverable.project_id)
    file = await _store(
        session,
        ctx,
        storage,
        organization_id=project.organization_id,
        project_id=project.id,
        purpose="deliverable",
        filename=filename,
        data=data,
    )
    previous = await session.get(StoredFile, deliverable.file_id) if deliverable.file_id else None
    deliverable.file_id = file.id
    deliverable.version += 1
    deliverable.status = "pending_review"
    deliverable.submitted_by_id = ctx.user.id
    deliverable.reviewed_by_id = None
    deliverable.reviewed_at = None
    deliverable.review_comment = None
    old_key = previous.storage_key if previous else None
    if previous:
        await session.delete(previous)
    await access.notify_members(
        session,
        project.organization_id,
        "deliverable_submitted",
        _deliverable_payload(project, deliverable),
    )
    project.updated_at = now()
    await session.commit()
    if old_key:
        await _remove_object(storage, old_key)
    return deliverable


async def update_deliverable(
    session: AsyncSession,
    ctx: OrganizationContext,
    deliverable_id: uuid.UUID,
    data: DeliverableUpdate,
) -> Deliverable:
    require_manage(ctx)
    deliverable = await _deliverable(session, ctx, deliverable_id)
    if data.title:
        deliverable.title = data.title
    if data.description is not None:
        deliverable.description = data.description
    await session.commit()
    return deliverable


async def delete_deliverable(
    session: AsyncSession,
    ctx: OrganizationContext,
    storage: PrivateStorage,
    deliverable_id: uuid.UUID,
) -> None:
    require_manage(ctx)
    deliverable = await _deliverable(session, ctx, deliverable_id)
    file = await session.get(StoredFile, deliverable.file_id) if deliverable.file_id else None
    key = file.storage_key if file else None
    await session.execute(
        delete(Comment).where(
            Comment.target_type == "deliverable", Comment.target_id == deliverable.id
        )
    )
    await session.delete(deliverable)
    if file:
        await session.delete(file)
    await session.commit()
    if key:
        await _remove_object(storage, key)


async def review_deliverable(
    session: AsyncSession, ctx: OrganizationContext, deliverable_id: uuid.UUID, data: Review
) -> Deliverable:
    """The client approves the deliverable or requests changes (owners and admins)."""
    if is_staff_context(ctx):
        raise PermissionDeniedError("Deliverables are reviewed by the client")
    ctx.require(Permission.PORTAL_REVIEW)
    deliverable = await _deliverable(session, ctx, deliverable_id)
    if deliverable.status != "pending_review":
        raise ConflictError("This deliverable is not waiting for a review")
    deliverable.status = data.decision
    deliverable.reviewed_by_id = ctx.user.id
    deliverable.reviewed_at = now()
    deliverable.review_comment = data.comment
    project = await session.get_one(Project, deliverable.project_id)
    if data.comment:
        session.add(
            Comment(
                organization_id=project.organization_id,
                project_id=project.id,
                target_type="deliverable",
                target_id=deliverable.id,
                author_id=ctx.user.id,
                from_staff=False,
                body=data.comment,
                created_at=now(),
            )
        )
    await access.notify_staff(
        session,
        project.organization_id,
        "deliverable_reviewed",
        _deliverable_payload(project, deliverable)
        | {"decision": data.decision, "organization": ctx.organization.name},
        owner=project.manager_id,
    )
    project.updated_at = now()
    await session.commit()
    return deliverable


# --- Comments ------------------------------------------------------------------------


async def _target_project(
    session: AsyncSession, ctx: OrganizationContext, target_type: str, target_id: uuid.UUID
) -> tuple[Project, str]:
    if target_type == "task":
        task = await _task(session, ctx, target_id)
        return await session.get_one(Project, task.project_id), task.title
    deliverable = await _deliverable(session, ctx, target_id)
    return await session.get_one(Project, deliverable.project_id), deliverable.title


async def list_comments(
    session: AsyncSession, ctx: OrganizationContext, target_type: str, target_id: uuid.UUID
) -> list[CommentOut]:
    await _target_project(session, ctx, target_type, target_id)
    comments = list(
        await session.scalars(
            select(Comment)
            .where(Comment.target_type == target_type, Comment.target_id == target_id)
            .order_by(Comment.created_at)
            .limit(500)
        )
    )
    people = await access.people(session, [c.author_id for c in comments])
    return [
        CommentOut(
            id=c.id,
            author=people.get(c.author_id) if c.author_id else None,
            from_staff=c.from_staff,
            body=c.body,
            created_at=c.created_at,
        )
        for c in comments
    ]


async def add_comment(
    session: AsyncSession,
    ctx: OrganizationContext,
    target_type: str,
    target_id: uuid.UUID,
    body: str,
) -> None:
    project, title = await _target_project(session, ctx, target_type, target_id)
    staff = is_staff_context(ctx)
    session.add(
        Comment(
            organization_id=project.organization_id,
            project_id=project.id,
            target_type=target_type,
            target_id=target_id,
            author_id=ctx.user.id,
            from_staff=staff,
            body=body,
            created_at=now(),
        )
    )
    payload = {
        "project_id": str(project.id),
        "project": project.name,
        "target_type": target_type,
        "target_id": str(target_id),
        "target": title,
    }
    if staff:
        await access.notify_members(session, project.organization_id, "comment_added", payload)
    else:
        await access.notify_staff(
            session,
            project.organization_id,
            "comment_added",
            payload | {"organization": ctx.organization.name},
            owner=project.manager_id,
        )
    await session.commit()


# --- Open work, for the dashboards ---------------------------------------------------


async def upcoming_tasks(
    session: AsyncSession, organization_id: uuid.UUID, limit: int = 6
) -> list[tuple[Task, str]]:
    rows = await session.execute(
        select(Task, Project.name)
        .join(Project, Project.id == Task.project_id)
        .where(
            Task.organization_id == organization_id,
            Task.status.in_(OPEN_TASK_STATUSES),
            Project.status.in_(ACTIVE_PROJECT_STATUSES),
        )
        .order_by(
            case((Task.status == "client_review", 0), else_=1),
            Task.due_date.nulls_last(),
            Task.position,
        )
        .limit(limit)
    )
    return [(task, name) for task, name in rows]
