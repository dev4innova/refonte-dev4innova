"use server";

import type { LessonView, QuizResult } from "@/lib/academy";
import { serverApi } from "@/lib/api";
import { getSession } from "@/lib/auth/session";

/* Learner Server Actions (TASK-106 to TASK-108): the API checks the enrollment. */

export type LearnerError = "signin" | "notFound" | "generic";
export type LearnerResult<T = undefined> = { ok: true; data: T } | { ok: false; error: LearnerError };

function errorFrom(status: number): LearnerResult<never> {
  if (status === 401) return { ok: false, error: "signin" };
  if (status === 404 || status === 422) return { ok: false, error: "notFound" };
  return { ok: false, error: "generic" };
}

async function api() {
  const session = await getSession();
  return session ? serverApi(session.accessToken) : null;
}

const SIGNIN: LearnerResult<never> = { ok: false, error: "signin" };

export async function enrollInCourse(slug: string, locale: "fr" | "en"): Promise<LearnerResult> {
  const client = await api();
  if (!client) return SIGNIN;
  const { response } = await client.POST("/api/v1/academy/courses/{slug}/enroll", {
    params: { path: { slug }, query: { locale } },
  });
  return response.ok ? { ok: true, data: undefined } : errorFrom(response.status);
}

export async function completeLesson(
  lessonId: LessonView["id"],
): Promise<LearnerResult<{ certificateCode: string | null }>> {
  const client = await api();
  if (!client) return SIGNIN;
  const { data, response } = await client.POST("/api/v1/me/academy/lessons/{lesson_id}/complete", {
    params: { path: { lesson_id: lessonId } },
  });
  return data ? { ok: true, data: { certificateCode: data.certificate_code } } : errorFrom(response.status);
}

export async function submitQuiz(
  moduleId: string,
  answers: Record<string, number>,
  locale: "fr" | "en",
): Promise<LearnerResult<QuizResult>> {
  const client = await api();
  if (!client) return SIGNIN;
  const { data, response } = await client.POST("/api/v1/me/academy/quizzes/{module_id}", {
    params: { path: { module_id: moduleId }, query: { locale } },
    body: { answers },
  });
  return data ? { ok: true, data } : errorFrom(response.status);
}
