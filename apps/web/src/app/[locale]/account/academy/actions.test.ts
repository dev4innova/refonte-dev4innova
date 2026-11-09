import { beforeEach, describe, expect, it, vi } from "vitest";

const client = { POST: vi.fn() };
const getSession = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/api", () => ({ serverApi: () => client }));
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));

const actions = await import("./actions");
const reply = (status: number, data?: unknown) => ({ data, response: new Response(null, { status }) });

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ accessToken: "tok" });
});

describe("learner Server Actions", () => {
  it("asks to sign in before enrolling", async () => {
    getSession.mockResolvedValue(null);
    expect(await actions.enrollInCourse("ia", "fr")).toEqual({ ok: false, error: "signin" });
    expect(client.POST).not.toHaveBeenCalled();
  });

  it("returns the certificate issued when the last lesson is done", async () => {
    client.POST.mockResolvedValue(reply(200, { certificate_code: "D4I-AAAA-BBBB-CCCC", course_completed: true }));
    expect(await actions.completeLesson("l")).toEqual({ ok: true, data: { certificateCode: "D4I-AAAA-BBBB-CCCC" } });
  });

  it("sends the answers and reports a course that is not followed", async () => {
    client.POST.mockResolvedValue(reply(404));
    expect(await actions.submitQuiz("m", { q: 1 }, "en")).toEqual({ ok: false, error: "notFound" });
    expect(client.POST.mock.calls[0]![1]).toEqual({ params: { path: { module_id: "m" }, query: { locale: "en" } }, body: { answers: { q: 1 } } });
  });
});
