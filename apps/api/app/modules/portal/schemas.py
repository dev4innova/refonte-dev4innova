import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

ProjectStatus = Literal["planned", "in_progress", "on_hold", "completed", "cancelled"]
TaskStatus = Literal["todo", "in_progress", "client_review", "done"]
DeliverableStatus = Literal["pending_review", "approved", "changes_requested"]
ReviewDecision = Literal["approved", "changes_requested"]
TicketCategory = Literal["question", "incident", "change_request", "billing", "other"]
TicketPriority = Literal["low", "normal", "high", "urgent"]
TicketStatus = Literal["open", "in_progress", "waiting_customer", "resolved", "closed"]
TicketFilter = Literal["open", "closed", "all"]
CommentTarget = Literal["task", "deliverable"]
NotificationType = Literal[
    "project_created",
    "task_client_review",
    "deliverable_submitted",
    "document_shared",
    "ticket_replied",
    "ticket_status",
    "deliverable_reviewed",
    "document_uploaded",
    "ticket_opened",
    "ticket_message",
    "comment_added",
]


def _strip(value: Any) -> Any:
    return value.strip() if isinstance(value, str) else value


class _Stripped(BaseModel):
    @field_validator("*", mode="before")
    @classmethod
    def _strip_strings(cls, value: Any) -> Any:
        return _strip(value)


class Person(BaseModel):
    id: uuid.UUID
    display_name: str | None
    email: str | None
    is_staff: bool = False


class OrganizationRef(BaseModel):
    id: uuid.UUID
    name: str
    slug: str


# --- Projects (TASK-097) ---------------------------------------------------------------


class ProjectCreate(_Stripped):
    organization_id: uuid.UUID
    name: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=5000)
    status: ProjectStatus = "planned"
    start_date: date | None = None
    due_date: date | None = None
    manager_id: uuid.UUID | None = None

    @model_validator(mode="after")
    def _dates(self) -> "ProjectCreate":
        if self.start_date and self.due_date and self.due_date < self.start_date:
            raise ValueError("The due date must not be before the start date")
        return self


class ProjectUpdate(_Stripped):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=5000)
    status: ProjectStatus | None = None
    start_date: date | None = None
    due_date: date | None = None
    manager_id: uuid.UUID | None = None


class Progress(BaseModel):
    done: int
    total: int
    percent: int


class ProjectSummary(BaseModel):
    id: uuid.UUID
    organization: OrganizationRef
    name: str
    status: ProjectStatus
    start_date: date | None
    due_date: date | None
    manager: Person | None
    progress: Progress
    pending_deliverables: int
    updated_at: datetime


class TaskOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: str
    status: TaskStatus
    due_date: date | None
    position: int
    comments: int
    updated_at: datetime


class FileOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID | None
    name: str
    content_type: str
    size_bytes: int
    uploaded_by: Person | None
    uploaded_by_staff: bool
    created_at: datetime
    can_delete: bool = False


class DeliverableOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: str
    version: int
    status: DeliverableStatus
    file: FileOut | None
    submitted_by: Person | None
    reviewed_by: Person | None
    reviewed_at: datetime | None
    review_comment: str | None
    comments: int
    created_at: datetime
    updated_at: datetime


class ProjectDetail(ProjectSummary):
    description: str
    tasks: list[TaskOut]
    deliverables: list[DeliverableOut]
    documents: list[FileOut]
    can_review: bool


class ProjectPage(BaseModel):
    items: list[ProjectSummary]
    total: int
    page: int
    page_size: int


class TaskCreate(_Stripped):
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=5000)
    status: TaskStatus = "todo"
    due_date: date | None = None


class TaskUpdate(_Stripped):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    status: TaskStatus | None = None
    due_date: date | None = None
    position: int | None = Field(default=None, ge=0, le=10_000)


class DeliverableUpdate(_Stripped):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=5000)


class Review(_Stripped):
    decision: ReviewDecision
    comment: str | None = Field(default=None, max_length=5000)

    @model_validator(mode="after")
    def _comment_for_changes(self) -> "Review":
        if self.decision == "changes_requested" and not self.comment:
            raise ValueError("Explain the changes you request")
        return self


class CommentCreate(_Stripped):
    body: str = Field(min_length=1, max_length=5000)


class CommentOut(BaseModel):
    id: uuid.UUID
    author: Person | None
    from_staff: bool
    body: str
    created_at: datetime


class DownloadLink(BaseModel):
    url: str
    expires_in: int


# --- Dashboard (TASK-096) --------------------------------------------------------------


class DashboardCounts(BaseModel):
    active_projects: int
    open_tasks: int
    tasks_in_review: int
    pending_deliverables: int
    open_tickets: int
    unread_notifications: int


class DashboardTask(TaskOut):
    project_name: str


class DashboardDeliverable(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    project_name: str
    title: str
    version: int
    updated_at: datetime


class Dashboard(BaseModel):
    organization: OrganizationRef
    counts: DashboardCounts
    projects: list[ProjectSummary]
    upcoming_tasks: list[DashboardTask]
    pending_deliverables: list[DashboardDeliverable]
    recent_tickets: list["TicketSummary"]


class AdminDashboard(BaseModel):
    active_projects: int
    pending_deliverables: int
    changes_requested: int
    open_tickets: int
    unassigned_tickets: int
    urgent_tickets: int
    projects: list[ProjectSummary]
    tickets: list["TicketSummary"]


# --- Support (TASK-101) ----------------------------------------------------------------


class TicketCreate(_Stripped):
    subject: str = Field(min_length=4, max_length=200)
    category: TicketCategory
    priority: TicketPriority = "normal"
    project_id: uuid.UUID | None = None
    message: str = Field(min_length=10, max_length=10_000)


class TicketReply(_Stripped):
    body: str = Field(min_length=1, max_length=10_000)
    status: TicketStatus | None = None
    """Staff only: status after the reply (by default, waiting for the customer)."""


class TicketUpdate(BaseModel):
    status: TicketStatus | None = None
    priority: TicketPriority | None = None
    assignee_id: uuid.UUID | None = None
    unassign: bool = False


class TicketSummary(BaseModel):
    id: uuid.UUID
    number: int
    organization: OrganizationRef
    subject: str
    category: TicketCategory
    priority: TicketPriority
    status: TicketStatus
    project: "ProjectRef | None"
    created_by: Person | None
    assignee: Person | None
    messages: int
    last_message_at: datetime
    last_from_staff: bool
    created_at: datetime


class ProjectRef(BaseModel):
    id: uuid.UUID
    name: str


class TicketMessageOut(BaseModel):
    id: uuid.UUID
    author: Person | None
    from_staff: bool
    body: str
    created_at: datetime


class TicketDetail(TicketSummary):
    thread: list[TicketMessageOut]
    closed_at: datetime | None


class TicketPage(BaseModel):
    items: list[TicketSummary]
    total: int
    page: int
    page_size: int


# --- Notifications (TASK-102) ----------------------------------------------------------


class NotificationOut(BaseModel):
    id: uuid.UUID
    type: NotificationType
    organization: OrganizationRef
    data: dict[str, Any]
    for_staff: bool
    read: bool
    created_at: datetime


class NotificationPage(BaseModel):
    items: list[NotificationOut]
    unread: int
    total: int
    page: int
    page_size: int


class UnreadCount(BaseModel):
    unread: int


Dashboard.model_rebuild()
AdminDashboard.model_rebuild()
TicketSummary.model_rebuild()
