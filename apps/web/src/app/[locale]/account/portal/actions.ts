"use server";

import {
  api,
  DONE,
  errorFrom,
  field,
  fileOf,
  multipart,
  type PortalResult,
  SIGNIN,
} from "@/lib/portal-actions";
import type { Comment, CommentTarget, TicketCategory, TicketPriority } from "@/lib/portal";

/*
 * Client portal Server Actions (TASK-096 to TASK-102). The API checks membership, the
 * organization of every record and the role (only owners and admins review deliverables).
 */

export async function reviewDeliverable(
  org: string,
  id: string,
  decision: "approved" | "changes_requested",
  comment: string,
): Promise<PortalResult> {
  const client = await api();
  if (!client) return SIGNIN;
  if (decision === "changes_requested" && !comment.trim()) return { ok: false, error: "validation" };
  const { response, error } = await client.POST(
    "/api/v1/organizations/{organization_id}/portal/deliverables/{deliverable_id}/review",
    {
      params: { path: { organization_id: org, deliverable_id: id } },
      body: { decision, comment: comment.trim() || null },
    },
  );
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function listComments(org: string, target: CommentTarget, id: string): Promise<PortalResult<Comment[]>> {
  const client = await api();
  if (!client) return SIGNIN;
  const { data, response, error } = await client.GET(
    "/api/v1/organizations/{organization_id}/portal/comments/{target_type}/{target_id}",
    { params: { path: { organization_id: org, target_type: target, target_id: id } } },
  );
  return data ? { ok: true, data } : errorFrom(response.status, error);
}

export async function addComment(
  org: string,
  target: CommentTarget,
  id: string,
  body: string,
): Promise<PortalResult<Comment[]>> {
  const client = await api();
  if (!client) return SIGNIN;
  if (!body.trim()) return { ok: false, error: "validation" };
  const { data, response, error } = await client.POST(
    "/api/v1/organizations/{organization_id}/portal/comments/{target_type}/{target_id}",
    {
      params: { path: { organization_id: org, target_type: target, target_id: id } },
      body: { body: body.trim() },
    },
  );
  return data ? { ok: true, data } : errorFrom(response.status, error);
}

export async function uploadDocument(org: string, formData: FormData): Promise<PortalResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const file = fileOf(formData);
  if (typeof file === "string") return { ok: false, error: file };
  const { response, error } = await client.POST("/api/v1/organizations/{organization_id}/portal/documents", {
    params: { path: { organization_id: org } },
    ...multipart({ file, project_id: field(formData, "project_id") }),
  });
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function deleteDocument(org: string, id: string): Promise<PortalResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.DELETE("/api/v1/organizations/{organization_id}/portal/documents/{file_id}", {
    params: { path: { organization_id: org, file_id: id } },
  });
  return response.ok ? DONE : errorFrom(response.status, error);
}

export type TicketInput = {
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  projectId: string;
  message: string;
};

export async function createTicket(org: string, input: TicketInput): Promise<PortalResult<{ id: string }>> {
  const client = await api();
  if (!client) return SIGNIN;
  const subject = input.subject.trim();
  const message = input.message.trim();
  if (subject.length < 4 || message.length < 10) return { ok: false, error: "validation" };
  const { data, response, error } = await client.POST("/api/v1/organizations/{organization_id}/portal/tickets", {
    params: { path: { organization_id: org } },
    body: {
      subject,
      category: input.category,
      priority: input.priority,
      project_id: input.projectId || null,
      message,
    },
  });
  return data ? { ok: true, data: { id: data.id } } : errorFrom(response.status, error);
}

export async function replyTicket(org: string, id: string, body: string): Promise<PortalResult> {
  const client = await api();
  if (!client) return SIGNIN;
  if (!body.trim()) return { ok: false, error: "validation" };
  const { response, error } = await client.POST(
    "/api/v1/organizations/{organization_id}/portal/tickets/{ticket_id}/messages",
    { params: { path: { organization_id: org, ticket_id: id } }, body: { body: body.trim() } },
  );
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function closeTicket(org: string, id: string): Promise<PortalResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.POST(
    "/api/v1/organizations/{organization_id}/portal/tickets/{ticket_id}/close",
    { params: { path: { organization_id: org, ticket_id: id } } },
  );
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function markNotificationRead(id: string): Promise<PortalResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.POST("/api/v1/me/notifications/{notification_id}/read", {
    params: { path: { notification_id: id } },
  });
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function markAllNotificationsRead(): Promise<PortalResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.POST("/api/v1/me/notifications/read");
  return response.ok ? DONE : errorFrom(response.status, error);
}
