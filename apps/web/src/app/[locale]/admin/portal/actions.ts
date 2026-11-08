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
import type { Comment, CommentTarget, ProjectStatus, TaskStatus, TicketPriority, TicketStatus } from "@/lib/portal";

/*
 * Back-office Server Actions of the client portal (EPIC 11). The API checks that the user is
 * staff with the portal:manage permission (staff_admin, staff_sales).
 */

export type ProjectInput = {
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  dueDate: string;
  managerId: string;
};

function projectBody(input: ProjectInput) {
  return {
    name: input.name.trim(),
    description: input.description.trim(),
    status: input.status,
    start_date: input.startDate || null,
    due_date: input.dueDate || null,
    manager_id: input.managerId || null,
  };
}

function datesValid(input: ProjectInput): boolean {
  return input.name.trim().length >= 2 && !(input.startDate && input.dueDate && input.dueDate < input.startDate);
}

export async function createProject(
  organizationId: string,
  input: ProjectInput,
): Promise<PortalResult<{ id: string }>> {
  const client = await api();
  if (!client) return SIGNIN;
  if (!organizationId || !datesValid(input)) return { ok: false, error: "validation" };
  const { data, response, error } = await client.POST("/api/v1/admin/portal/projects", {
    body: { organization_id: organizationId, ...projectBody(input) },
  });
  return data ? { ok: true, data: { id: data.id } } : errorFrom(response.status, error);
}

export async function updateProject(id: string, input: ProjectInput): Promise<PortalResult> {
  const client = await api();
  if (!client) return SIGNIN;
  if (!datesValid(input)) return { ok: false, error: "validation" };
  const { response, error } = await client.PATCH("/api/v1/admin/portal/projects/{project_id}", {
    params: { path: { project_id: id } },
    body: projectBody(input),
  });
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function deleteProject(id: string): Promise<PortalResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.DELETE("/api/v1/admin/portal/projects/{project_id}", {
    params: { path: { project_id: id } },
  });
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function createTask(
  projectId: string,
  input: { title: string; description: string; status: TaskStatus; dueDate: string },
): Promise<PortalResult> {
  const client = await api();
  if (!client) return SIGNIN;
  if (input.title.trim().length < 2) return { ok: false, error: "validation" };
  const { response, error } = await client.POST("/api/v1/admin/portal/projects/{project_id}/tasks", {
    params: { path: { project_id: projectId } },
    body: {
      title: input.title.trim(),
      description: input.description.trim(),
      status: input.status,
      due_date: input.dueDate || null,
    },
  });
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function setTaskStatus(id: string, status: TaskStatus): Promise<PortalResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.PATCH("/api/v1/admin/portal/tasks/{task_id}", {
    params: { path: { task_id: id } },
    body: { status },
  });
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function deleteTask(id: string): Promise<PortalResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.DELETE("/api/v1/admin/portal/tasks/{task_id}", {
    params: { path: { task_id: id } },
  });
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function submitDeliverable(projectId: string, formData: FormData): Promise<PortalResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const file = fileOf(formData);
  if (typeof file === "string") return { ok: false, error: file };
  const title = field(formData, "title");
  if (title.length < 2) return { ok: false, error: "validation" };
  const { response, error } = await client.POST("/api/v1/admin/portal/projects/{project_id}/deliverables", {
    params: { path: { project_id: projectId } },
    ...multipart({ title, description: field(formData, "description"), file }),
  });
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function submitVersion(id: string, formData: FormData): Promise<PortalResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const file = fileOf(formData);
  if (typeof file === "string") return { ok: false, error: file };
  const { response, error } = await client.POST("/api/v1/admin/portal/deliverables/{deliverable_id}/versions", {
    params: { path: { deliverable_id: id } },
    ...multipart({ file }),
  });
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function deleteDeliverable(id: string): Promise<PortalResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.DELETE("/api/v1/admin/portal/deliverables/{deliverable_id}", {
    params: { path: { deliverable_id: id } },
  });
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function shareDocument(organizationId: string, formData: FormData): Promise<PortalResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const file = fileOf(formData);
  if (typeof file === "string") return { ok: false, error: file };
  const { response, error } = await client.POST("/api/v1/admin/portal/organizations/{organization_id}/documents", {
    params: { path: { organization_id: organizationId } },
    ...multipart({ file, project_id: field(formData, "project_id") }),
  });
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function deleteDocument(id: string): Promise<PortalResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.DELETE("/api/v1/admin/portal/documents/{file_id}", {
    params: { path: { file_id: id } },
  });
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function listComments(target: CommentTarget, id: string): Promise<PortalResult<Comment[]>> {
  const client = await api();
  if (!client) return SIGNIN;
  const { data, response, error } = await client.GET("/api/v1/admin/portal/comments/{target_type}/{target_id}", {
    params: { path: { target_type: target, target_id: id } },
  });
  return data ? { ok: true, data } : errorFrom(response.status, error);
}

export async function addComment(target: CommentTarget, id: string, body: string): Promise<PortalResult<Comment[]>> {
  const client = await api();
  if (!client) return SIGNIN;
  if (!body.trim()) return { ok: false, error: "validation" };
  const { data, response, error } = await client.POST("/api/v1/admin/portal/comments/{target_type}/{target_id}", {
    params: { path: { target_type: target, target_id: id } },
    body: { body: body.trim() },
  });
  return data ? { ok: true, data } : errorFrom(response.status, error);
}

export async function replyTicket(id: string, body: string, status: TicketStatus): Promise<PortalResult> {
  const client = await api();
  if (!client) return SIGNIN;
  if (!body.trim()) return { ok: false, error: "validation" };
  const { response, error } = await client.POST("/api/v1/admin/portal/tickets/{ticket_id}/messages", {
    params: { path: { ticket_id: id } },
    body: { body: body.trim(), status },
  });
  return response.ok ? DONE : errorFrom(response.status, error);
}

export async function updateTicket(
  id: string,
  patch: { status: TicketStatus; priority: TicketPriority; assigneeId: string },
): Promise<PortalResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.PATCH("/api/v1/admin/portal/tickets/{ticket_id}", {
    params: { path: { ticket_id: id } },
    body: {
      status: patch.status,
      priority: patch.priority,
      assignee_id: patch.assigneeId || null,
      unassign: !patch.assigneeId,
    },
  });
  return response.ok ? DONE : errorFrom(response.status, error);
}
