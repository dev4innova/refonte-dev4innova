import { beforeEach, describe, expect, it, vi } from "vitest";

const client = { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/api", () => ({ serverApi: () => client }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => ({ accessToken: "tok" }) }));

const actions = await import("./actions");

const reply = (status: number, data?: unknown) => ({ data, error: undefined, response: new Response(null, { status }) });
const project = { name: "Assistant RH", description: " ", status: "planned", startDate: "", dueDate: "", managerId: "" } as const;

beforeEach(() => vi.clearAllMocks());

describe("back-office portal Server Actions", () => {
  it("refuses a due date before the start date without calling the API", async () => {
    const result = await actions.createProject("org", { ...project, startDate: "2027-02-01", dueDate: "2027-01-01" });
    expect(result).toEqual({ ok: false, error: "validation" });
    expect(await actions.createProject("", project)).toEqual({ ok: false, error: "validation" });
    expect(client.POST).not.toHaveBeenCalled();
  });

  it("sends empty optional fields as null", async () => {
    client.POST.mockResolvedValue(reply(201, { id: "p-1" }));
    expect(await actions.createProject("org", project)).toEqual({ ok: true, data: { id: "p-1" } });
    expect(client.POST.mock.calls[0]![1].body).toEqual({
      organization_id: "org",
      name: "Assistant RH",
      description: "",
      status: "planned",
      start_date: null,
      due_date: null,
      manager_id: null,
    });
  });

  it("unassigns a ticket when no owner is chosen", async () => {
    client.PATCH.mockResolvedValue(reply(200, {}));
    await actions.updateTicket("t", { status: "resolved", priority: "low", assigneeId: "" });
    expect(client.PATCH.mock.calls[0]![1].body).toEqual({ status: "resolved", priority: "low", assignee_id: null, unassign: true });
  });

  it("needs a title and a file for a deliverable", async () => {
    const data = new FormData();
    data.set("file", new File(["%PDF"], "spec.pdf"));
    data.set("title", " x ");
    expect(await actions.submitDeliverable("p", data)).toEqual({ ok: false, error: "validation" });
    data.set("title", "Cahier des charges");
    client.POST.mockResolvedValue(reply(201, {}));
    expect(await actions.submitDeliverable("p", data)).toEqual({ ok: true, data: undefined });
    const body = client.POST.mock.calls[0]![1].bodySerializer() as FormData;
    expect(body.get("title")).toBe("Cahier des charges");
    expect(body.get("description")).toBeNull();
  });
});
