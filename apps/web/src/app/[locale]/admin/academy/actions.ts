"use server";

import { updateTag } from "next/cache";

import { academyTag, type Level, type Texts, type Visibility } from "@/lib/academy";
import { serverApi } from "@/lib/api";
import { getSession } from "@/lib/auth/session";

/*
 * Back-office Server Actions of the Academy (EPIC 12). The API checks the staff role
 * (academy:manage) and the rules (both languages to publish...). Every change refreshes the
 * public catalog (updateTag).
 */

export type AcademyAdminError =
  | "signin"
  | "forbidden"
  | "notFound"
  | "slug"
  | "video"
  | "incomplete"
  | "enrolled"
  | "conflict"
  | "validation"
  | "generic";

export type AcademyAdminResult<T = undefined> = { ok: true; data: T } | { ok: false; error: AcademyAdminError };

type ApiError = { error?: { code?: string; details?: Record<string, unknown> } } | undefined;

function errorFrom(status: number, body: unknown, conflict: AcademyAdminError = "conflict"): AcademyAdminResult<never> {
  const error = (body as ApiError)?.error;
  if (status === 401) return { ok: false, error: "signin" };
  if (status === 403) return { ok: false, error: "forbidden" };
  if (status === 404) return { ok: false, error: "notFound" };
  if (status === 409) {
    if (error?.details?.field === "slug") return { ok: false, error: "slug" };
    if (error?.details?.missing) return { ok: false, error: "incomplete" };
    return { ok: false, error: conflict };
  }
  if (status === 422) return { ok: false, error: error?.code === "invalid_video" ? "video" : "validation" };
  return { ok: false, error: "generic" };
}

async function api() {
  const session = await getSession();
  return session ? serverApi(session.accessToken) : null;
}

const SIGNIN: AcademyAdminResult<never> = { ok: false, error: "signin" };

function done<T>(data: T): AcademyAdminResult<T> {
  updateTag(academyTag);
  return { ok: true, data };
}

export type CourseInput = {
  slug: string;
  visibility: Visibility;
  level: Level;
  durationMinutes: number;
  title: Texts;
  summary: Texts;
  descriptionMd: Texts;
};

function courseBody(input: CourseInput) {
  return {
    slug: input.slug.trim(),
    visibility: input.visibility,
    level: input.level,
    duration_minutes: Math.max(0, Math.round(input.durationMinutes || 0)),
    title: input.title,
    summary: input.summary,
    description_md: input.descriptionMd,
  };
}

export async function createCourse(input: CourseInput): Promise<AcademyAdminResult<{ id: string }>> {
  const client = await api();
  if (!client) return SIGNIN;
  if (!input.title.fr) return { ok: false, error: "validation" };
  const { data, response, error } = await client.POST("/api/v1/admin/academy/courses", { body: courseBody(input) });
  return data ? done({ id: data.id }) : errorFrom(response.status, error);
}

export async function updateCourse(id: string, input: CourseInput): Promise<AcademyAdminResult> {
  const client = await api();
  if (!client) return SIGNIN;
  if (!input.title.fr) return { ok: false, error: "validation" };
  const { response, error } = await client.PUT("/api/v1/admin/academy/courses/{course_id}", {
    params: { path: { course_id: id } },
    body: courseBody(input),
  });
  return response.ok ? done(undefined) : errorFrom(response.status, error);
}

export async function setPublished(id: string, published: boolean): Promise<AcademyAdminResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const path = published
    ? ("/api/v1/admin/academy/courses/{course_id}/publish" as const)
    : ("/api/v1/admin/academy/courses/{course_id}/unpublish" as const);
  const { response, error } = await client.POST(path, { params: { path: { course_id: id } } });
  return response.ok ? done(undefined) : errorFrom(response.status, error);
}

export async function deleteCourse(id: string): Promise<AcademyAdminResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.DELETE("/api/v1/admin/academy/courses/{course_id}", {
    params: { path: { course_id: id } },
  });
  return response.ok ? done(undefined) : errorFrom(response.status, error, "enrolled");
}

export async function saveModule(
  target: { courseId: string } | { moduleId: string },
  input: { title: Texts; summary: Texts },
): Promise<AcademyAdminResult> {
  const client = await api();
  if (!client) return SIGNIN;
  if (!input.title.fr) return { ok: false, error: "validation" };
  const { response, error } =
    "courseId" in target
      ? await client.POST("/api/v1/admin/academy/courses/{course_id}/modules", {
          params: { path: { course_id: target.courseId } },
          body: input,
        })
      : await client.PUT("/api/v1/admin/academy/modules/{module_id}", {
          params: { path: { module_id: target.moduleId } },
          body: input,
        });
  return response.ok ? done(undefined) : errorFrom(response.status, error);
}

export type LessonInput = { title: Texts; bodyMd: Texts; videoUrl: string; durationMinutes: number };

function lessonBody(input: LessonInput) {
  return {
    title: input.title,
    body_md: input.bodyMd,
    video_url: input.videoUrl.trim() || null,
    duration_minutes: Math.min(600, Math.max(1, Math.round(input.durationMinutes || 5))),
  };
}

export async function createLesson(moduleId: string, title: Texts): Promise<AcademyAdminResult<{ id: string }>> {
  const client = await api();
  if (!client) return SIGNIN;
  if (!title.fr) return { ok: false, error: "validation" };
  const { data, response, error } = await client.POST("/api/v1/admin/academy/modules/{module_id}/lessons", {
    params: { path: { module_id: moduleId } },
    body: lessonBody({ title, bodyMd: { fr: "", en: "" }, videoUrl: "", durationMinutes: 5 }),
  });
  return data ? done({ id: data.id }) : errorFrom(response.status, error);
}

export async function updateLesson(id: string, input: LessonInput): Promise<AcademyAdminResult> {
  const client = await api();
  if (!client) return SIGNIN;
  if (!input.title.fr) return { ok: false, error: "validation" };
  const { response, error } = await client.PUT("/api/v1/admin/academy/lessons/{lesson_id}", {
    params: { path: { lesson_id: id } },
    body: lessonBody(input),
  });
  return response.ok ? done(undefined) : errorFrom(response.status, error);
}

export type QuestionInput = { prompt: Texts; options: Texts[]; correctOption: number; explanation: Texts };

export async function saveQuestion(
  target: { moduleId: string } | { questionId: string },
  input: QuestionInput,
): Promise<AcademyAdminResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const options = input.options.filter((o) => o.fr || o.en);
  if (!input.prompt.fr || options.length < 2 || options.some((o) => !o.fr) || input.correctOption >= options.length) {
    return { ok: false, error: "validation" };
  }
  const body = { prompt: input.prompt, options, correct_option: input.correctOption, explanation: input.explanation };
  const { response, error } =
    "moduleId" in target
      ? await client.POST("/api/v1/admin/academy/modules/{module_id}/questions", {
          params: { path: { module_id: target.moduleId } },
          body,
        })
      : await client.PUT("/api/v1/admin/academy/questions/{question_id}", {
          params: { path: { question_id: target.questionId } },
          body,
        });
  return response.ok ? done(undefined) : errorFrom(response.status, error);
}

export type ItemKind = "modules" | "lessons" | "questions";

export async function deleteItem(kind: ItemKind, id: string): Promise<AcademyAdminResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.DELETE(`/api/v1/admin/academy/${kind}/{item_id}`, {
    params: { path: { item_id: id } },
  });
  return response.ok ? done(undefined) : errorFrom(response.status, error);
}

export async function moveItem(kind: ItemKind, id: string, direction: "up" | "down"): Promise<AcademyAdminResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.POST(`/api/v1/admin/academy/${kind}/{item_id}/move`, {
    params: { path: { item_id: id } },
    body: { direction },
  });
  return response.ok ? done(undefined) : errorFrom(response.status, error);
}

export type Member = { id: string; name: string; enrolled: boolean };

export async function listMembers(courseId: string, organizationId: string): Promise<AcademyAdminResult<Member[]>> {
  const client = await api();
  if (!client) return SIGNIN;
  const { data, response, error } = await client.GET(
    "/api/v1/admin/academy/courses/{course_id}/organizations/{organization_id}/members",
    { params: { path: { course_id: courseId, organization_id: organizationId } } },
  );
  if (!data) return errorFrom(response.status, error);
  return { ok: true, data: data.map((m) => ({ id: m.id, name: m.display_name ?? m.email ?? m.id, enrolled: m.enrolled })) };
}

export async function enrollMembers(
  courseId: string,
  organizationId: string,
  userIds: string[],
): Promise<AcademyAdminResult<{ enrolled: number }>> {
  const client = await api();
  if (!client) return SIGNIN;
  if (!organizationId || userIds.length === 0) return { ok: false, error: "validation" };
  const { data, response, error } = await client.POST("/api/v1/admin/academy/courses/{course_id}/enrollments", {
    params: { path: { course_id: courseId } },
    body: { organization_id: organizationId, user_ids: userIds },
  });
  return data ? done({ enrolled: data.enrolled }) : errorFrom(response.status, error);
}

export async function removeEnrollment(id: string): Promise<AcademyAdminResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response, error } = await client.DELETE("/api/v1/admin/academy/enrollments/{enrollment_id}", {
    params: { path: { enrollment_id: id } },
  });
  return response.ok ? done(undefined) : errorFrom(response.status, error);
}
