import type { components } from "@dev4innova/api-client";

/* Client portal (EPIC 11): shared types, choices and helpers of the portal and its back office. */

type Schemas = components["schemas"];
export type Dashboard = Schemas["PortalDashboard"];
export type AdminDashboard = Schemas["PortalAdminDashboard"];
export type ProjectSummary = Schemas["ProjectSummary"];
export type ProjectDetail = Schemas["ProjectDetail"];
export type Task = Schemas["TaskOut"];
export type Deliverable = Schemas["DeliverableOut"];
export type PortalFile = Schemas["FileOut"];
export type Comment = Schemas["CommentOut"];
export type TicketSummary = Schemas["TicketSummary"];
export type TicketDetail = Schemas["TicketDetail"];
export type PortalNotification = Schemas["NotificationOut"];
export type Person = Schemas["PortalPerson"];

export const PROJECT_STATUSES = ["planned", "in_progress", "on_hold", "completed", "cancelled"] as const;
export const TASK_STATUSES = ["todo", "in_progress", "client_review", "done"] as const;
export const DELIVERABLE_STATUSES = ["pending_review", "approved", "changes_requested"] as const;
export const TICKET_CATEGORIES = ["question", "incident", "change_request", "billing", "other"] as const;
export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const TICKET_STATUSES = ["open", "in_progress", "waiting_customer", "resolved", "closed"] as const;
export const TICKET_FILTERS = ["open", "closed", "all"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketFilter = (typeof TICKET_FILTERS)[number];
export type CommentTarget = "task" | "deliverable";

/** Same limit and types as the API (PORTAL_FILE_MAX_BYTES, portal/files.py). */
export const FILE_MAX_BYTES = 25 * 1024 * 1024;
export const FILE_ACCEPT = [
  ".pdf",
  ".docx",
  ".xlsx",
  ".pptx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".zip",
  ".txt",
  ".md",
  ".csv",
].join(",");

export function ticketFilter(value: string | string[] | undefined): TicketFilter {
  return (TICKET_FILTERS as readonly unknown[]).includes(value) ? (value as TicketFilter) : "open";
}

/** "2,4 Mo" / "2.4 MB": unit labels come from the messages. */
export function fileSize(bytes: number, units: { kb: string; mb: string }, locale: string): string {
  const format = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  if (bytes < 1024 * 1024) return `${format(Math.max(1, Math.round(bytes / 1024)))} ${units.kb}`;
  return `${format(bytes / (1024 * 1024))} ${units.mb}`;
}

type Href =
  | "/admin/portal"
  | { pathname: "/account/portal/[org]"; params: { org: string } }
  | { pathname: "/account/portal/[org]/projects/[project]"; params: { org: string; project: string } }
  | { pathname: "/account/portal/[org]/documents"; params: { org: string } }
  | { pathname: "/account/portal/[org]/support/[ticket]"; params: { org: string; ticket: string } }
  | { pathname: "/admin/portal/projects/[id]"; params: { id: string } }
  | { pathname: "/admin/portal/support/[id]"; params: { id: string } };

/** Where a notification leads: the portal for clients, the back office for staff. */
export function notificationHref(notification: Pick<PortalNotification, "for_staff" | "organization" | "data">): Href {
  const org = notification.organization.id;
  const data = notification.data as Record<string, unknown>;
  const text = (key: string) => (typeof data[key] === "string" ? (data[key] as string) : null);
  const project = text("project_id");
  const ticket = text("ticket_id");
  if (notification.for_staff) {
    if (ticket) return { pathname: "/admin/portal/support/[id]", params: { id: ticket } };
    if (project) return { pathname: "/admin/portal/projects/[id]", params: { id: project } };
    return "/admin/portal";
  }
  if (ticket) return { pathname: "/account/portal/[org]/support/[ticket]", params: { org, ticket } };
  if (project) return { pathname: "/account/portal/[org]/projects/[project]", params: { org, project } };
  if (text("file_id")) return { pathname: "/account/portal/[org]/documents", params: { org } };
  return { pathname: "/account/portal/[org]", params: { org } };
}

/** Text values of a notification, for its message (ICU arguments). */
export function notificationValues(notification: Pick<PortalNotification, "organization" | "data">): Record<string, string> {
  const values: Record<string, string> = { organization: notification.organization.name };
  for (const [key, value] of Object.entries(notification.data as Record<string, unknown>)) {
    if (typeof value === "string" || typeof value === "number") values[key] = String(value);
  }
  return values;
}

export type Tone = "accent" | "success" | "neutral" | "muted";

const TONES: Record<string, Tone> = {
  client_review: "accent",
  pending_review: "accent",
  changes_requested: "accent",
  waiting_customer: "accent",
  open: "accent",
  urgent: "accent",
  high: "accent",
  done: "success",
  approved: "success",
  completed: "success",
  resolved: "success",
  cancelled: "muted",
  closed: "muted",
  on_hold: "muted",
  low: "muted",
};

/** Tone of a status chip: what needs attention stands out, what is finished is calm. */
export function statusTone(value: string): Tone {
  return TONES[value] ?? "neutral";
}
