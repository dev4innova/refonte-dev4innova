import { expect, test } from "@playwright/test";

/*
 * Client portal (EPIC 11). CI has no identity provider or object storage: the full flow is
 * covered by the API tests and checked manually; here, access control up to sign-in.
 */
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "routing behaviour is viewport-independent");
});

const ORG = "11111111-2222-4333-8444-555555555555";
const FILE = "66666666-7777-4888-9999-000000000000";

for (const [path, encoded] of [
  [`/fr/espace-client/portail/${ORG}`, `%2Ffr%2Fespace-client%2Fportail%2F${ORG}`],
  [`/en/account/portal/${ORG}/support`, `%2Fen%2Faccount%2Fportal%2F${ORG}%2Fsupport`],
  ["/fr/espace-client/notifications", "%2Ffr%2Fespace-client%2Fnotifications"],
] as const) {
  test(`${path} sends anonymous visitors to sign-in`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toMatch(new RegExp(`/api/auth/login\\?returnTo=${encoded}$`));
  });
}

test("the back office of the portal requires a session", async ({ request }) => {
  const response = await request.get("/fr/admin/portal/support", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers()["location"]).toMatch(/\/api\/auth\/login\?returnTo=%2Ffr%2Fadmin%2Fportal%2Fsupport$/);
});

test("downloads need a session and well-formed identifiers", async ({ request }) => {
  expect((await request.get(`/api/portal/${ORG}/files/${FILE}`, { maxRedirects: 0 })).status()).toBe(401);
  expect((await request.get(`/api/admin/portal/files/${FILE}`, { maxRedirects: 0 })).status()).toBe(401);
  expect((await request.get(`/api/portal/not-an-id/files/${FILE}`, { maxRedirects: 0 })).status()).toBe(404);
});
