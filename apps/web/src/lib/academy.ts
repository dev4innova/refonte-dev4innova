import type { components } from "@dev4innova/api-client";

/* Academy (EPIC 12): shared types and helpers of the catalog, the learner area and the back office. */

type Schemas = components["schemas"];
export type CourseCard = Schemas["CourseCard"];
export type CourseOutline = Schemas["CourseOutline"];
export type MyCourse = Schemas["MyCourse"];
export type LearnerCourse = Schemas["LearnerCourse"];
export type LessonView = Schemas["LessonView"];
export type QuizView = Schemas["QuizView"];
export type QuizResult = Schemas["QuizResult"];
export type Certificate = Schemas["CertificateOut"];
export type AdminCourse = Schemas["AdminCourse"];
export type AdminCourseSummary = Schemas["AdminCourseSummary"];
export type AdminModule = Schemas["AdminModule"];
export type AdminLesson = Schemas["AdminLesson"];
export type AdminQuestion = Schemas["AdminQuestion"];
export type AdminEnrollment = Schemas["AdminEnrollment"];
export type SponsoredEnrollment = Schemas["SponsoredEnrollment"];
export type MissingItem = Schemas["MissingItem"];
export type Texts = { fr: string; en: string };

export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export const VISIBILITIES = ["public", "restricted"] as const;
export type Level = (typeof LEVELS)[number];
export type Visibility = (typeof VISIBILITIES)[number];

/** Same as the API (models.PASS_PERCENT). */
export const PASS_PERCENT = 70;

export const academyTag = "academy";

/** Certificate codes as printed (D4I-XXXX-XXXX-XXXX); case and spaces are forgiven. */
export function normalizeCode(value: string): string | null {
  const code = value.trim().toUpperCase().replace(/\s+/g, "");
  return /^D4I-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(code) ? code : null;
}

/** "1 h 30" / "45 min" (unit labels from the messages). */
export function duration(minutes: number, units: { hour: string; minute: string }): string {
  if (minutes < 60) return `${minutes} ${units.minute}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ${units.hour} ${String(rest).padStart(2, "0")}` : `${hours} ${units.hour}`;
}

/** Text of a form in both languages ("title_fr", "title_en"). */
export function textsFrom(data: FormData, name: string): Texts {
  const value = (locale: string) => {
    const raw = data.get(`${name}_${locale}`);
    return typeof raw === "string" ? raw.trim() : "";
  };
  return { fr: value("fr"), en: value("en") };
}

/** Lessons in reading order, for the previous / next links. */
export function lessonOrder(course: Pick<LearnerCourse, "outline">): string[] {
  return course.outline.flatMap((m) => m.lessons.map((l) => l.id));
}

/** A stored text in the requested language, French otherwise. */
export function pick(texts: Record<string, string | undefined>, locale: string): string {
  return texts[locale] || texts.fr || "";
}
