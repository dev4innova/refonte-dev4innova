import { beforeEach, describe, expect, it, vi } from "vitest";

const client = { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), DELETE: vi.fn() };
const updateTag = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ updateTag: (tag: string) => updateTag(tag) }));
vi.mock("@/lib/api", () => ({ serverApi: () => client }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => ({ accessToken: "tok" }) }));

const actions = await import("./actions");

const reply = (status: number, data?: unknown, error?: unknown) => ({ data, error, response: new Response(null, { status }) });
const empty = { fr: "", en: "" };
const course = {
  slug: " ia ",
  visibility: "public",
  level: "beginner",
  durationMinutes: 90.4,
  title: { fr: "IA", en: "AI" },
  summary: empty,
  descriptionMd: empty,
} as const;

beforeEach(() => vi.clearAllMocks());

describe("Academy back-office Server Actions", () => {
  it("creates a course and refreshes the public catalog", async () => {
    client.POST.mockResolvedValue(reply(201, { id: "c-1" }));
    expect(await actions.createCourse(course)).toEqual({ ok: true, data: { id: "c-1" } });
    expect(client.POST.mock.calls[0]![1].body).toMatchObject({ slug: "ia", duration_minutes: 90, description_md: empty });
    expect(updateTag).toHaveBeenCalledWith("academy");
  });

  it.each([
    [409, { error: { details: { field: "slug" } } }, "slug"],
    [409, { error: { details: { missing: [{}] } } }, "incomplete"],
    [422, { error: { code: "invalid_video" } }, "video"],
    [422, { error: { code: "validation_error" } }, "validation"],
    [403, undefined, "forbidden"],
  ])("maps HTTP %i to %s, without refreshing", async (status, body, error) => {
    client.PUT.mockResolvedValue(reply(status, undefined, body));
    expect(await actions.updateCourse("c-1", course)).toEqual({ ok: false, error });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("explains why a course with learners cannot be deleted", async () => {
    client.DELETE.mockResolvedValue(reply(409, undefined, { error: {} }));
    expect(await actions.deleteCourse("c-1")).toEqual({ ok: false, error: "enrolled" });
  });

  it("drops empty answers and checks the question before sending it", async () => {
    const question = {
      prompt: { fr: "Un LLM prédit…", en: "" },
      options: [{ fr: "Le mot suivant", en: "" }, empty, { fr: "Une image", en: "" }],
      correctOption: 1,
      explanation: empty,
    };
    expect(await actions.saveQuestion({ moduleId: "m" }, { ...question, correctOption: 2 })).toEqual({ ok: false, error: "validation" });
    expect(client.POST).not.toHaveBeenCalled();
    client.POST.mockResolvedValue(reply(201, {}));
    await actions.saveQuestion({ moduleId: "m" }, question);
    expect(client.POST.mock.calls[0]![1].body.options).toHaveLength(2);
  });

  it("sends an empty video link as none", async () => {
    client.PUT.mockResolvedValue(reply(200, {}));
    await actions.updateLesson("l", { title: { fr: "Leçon", en: "" }, bodyMd: empty, videoUrl: "  ", durationMinutes: 0 });
    expect(client.PUT.mock.calls[0]![1].body).toMatchObject({ video_url: null, duration_minutes: 5 });
  });

  it("enrolls only a chosen organization and people", async () => {
    expect(await actions.enrollMembers("c", "", ["u"])).toEqual({ ok: false, error: "validation" });
    expect(await actions.enrollMembers("c", "o", [])).toEqual({ ok: false, error: "validation" });
    client.POST.mockResolvedValue(reply(200, { enrolled: 2, already: 0 }));
    expect(await actions.enrollMembers("c", "o", ["u", "v"])).toEqual({ ok: true, data: { enrolled: 2 } });
  });
});
