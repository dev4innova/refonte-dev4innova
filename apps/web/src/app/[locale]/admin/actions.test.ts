import { beforeEach, describe, expect, it, vi } from "vitest";

const updateTag = vi.fn();
const getSession = vi.fn();
const client = { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() };

vi.mock("next/cache", () => ({ updateTag: (tag: string) => updateTag(tag) }));
vi.mock("@/lib/auth/session", () => ({ getSession: () => getSession() }));
vi.mock("@/lib/admin", () => ({ adminApi: () => client }));
vi.mock("@/lib/cms", () => ({ cmsTag: (type: string) => `cms:${type}` }));

const actions = await import("./actions");

const input = {
  type: "article" as const,
  translations: {
    fr: { title: "Titre", slug: "titre", summary: "", body_md: "", seo_title: "", seo_description: "" },
    en: { title: " ", slug: "", summary: "", body_md: "", seo_title: "", seo_description: "" },
  },
  attributes: {},
  position: 0,
  coverMediaId: null,
};

function reply(status: number, data?: unknown, error?: unknown) {
  return { data, error, response: new Response(null, { status: status === 204 ? 204 : status }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ accessToken: "token" });
});

describe("admin Server Actions", () => {
  it("asks to sign in when there is no session", async () => {
    getSession.mockResolvedValue(null);
    expect(await actions.saveDocument(null, input)).toEqual({ ok: false, error: "signin" });
    expect(client.POST).not.toHaveBeenCalled();
  });

  it("creates a document with filled-in languages only and refreshes its cache tag", async () => {
    client.POST.mockResolvedValue(reply(201, { id: "doc-1" }));
    const result = await actions.saveDocument(null, input);
    expect(result).toEqual({ ok: true, data: { id: "doc-1" } });
    const body = client.POST.mock.calls[0]?.[1].body;
    expect(Object.keys(body.translations)).toEqual(["fr"]);
    expect(updateTag).toHaveBeenCalledWith("cms:article");
  });

  it("clears the cover when an existing document has none", async () => {
    client.PATCH.mockResolvedValue(reply(200, { id: "doc-1" }));
    await actions.saveDocument("doc-1", input);
    expect(client.PATCH.mock.calls[0]?.[1].body).toMatchObject({ clear_cover: true });
  });

  it.each([
    [401, undefined, "signin"],
    [403, undefined, "forbidden"],
    [404, undefined, "forbidden"],
    [409, { error: { message: "Slug already used" } }, "slug"],
    [422, { error: { details: { missing_locales: ["en"] } } }, "missingLocale"],
    [422, { error: { details: [] } }, "validation"],
    [500, undefined, "generic"],
  ])("maps HTTP %i to the %s error without touching the cache", async (status, error, expected) => {
    client.POST.mockResolvedValue(reply(status, undefined, error));
    expect(await actions.saveDocument(null, input)).toEqual({ ok: false, error: expected });
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("refuses to delete a published document", async () => {
    client.DELETE.mockResolvedValue(
      reply(409, undefined, { error: { message: "Unpublish the document first" } }),
    );
    expect(await actions.deleteDocument("doc-1", "article")).toEqual({
      ok: false,
      error: "publishedDelete",
    });
  });

  it("publishes then refreshes the cache tag of the document type", async () => {
    client.POST.mockResolvedValue(reply(200, { id: "doc-1", status: "published" }));
    await actions.setPublished("doc-1", "service", true);
    expect(client.POST.mock.calls[0]?.[0]).toBe("/api/v1/admin/cms/documents/{document_id}/publish");
    expect(updateTag).toHaveBeenCalledWith("cms:service");
  });

  it("rejects empty and oversized uploads before calling the API", async () => {
    const empty = new FormData();
    empty.set("file", new File([], "empty.png", { type: "image/png" }));
    expect(await actions.uploadMedia(empty)).toEqual({ ok: false, error: "invalidImage" });

    const big = new FormData();
    big.set("file", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", { type: "image/png" }));
    expect(await actions.uploadMedia(big)).toEqual({ ok: false, error: "tooLarge" });
    expect(client.POST).not.toHaveBeenCalled();
  });

  it("refreshes every content type after a media change", async () => {
    client.PATCH.mockResolvedValue(reply(200, {}));
    expect(await actions.updateMediaAlt("m-1", "Texte", "Text")).toEqual({ ok: true, data: undefined });
    expect(updateTag.mock.calls.map(([tag]) => tag)).toEqual([
      "cms:article",
      "cms:project",
      "cms:service",
      "cms:page",
    ]);
  });
});
