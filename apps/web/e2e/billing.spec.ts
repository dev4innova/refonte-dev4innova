import { expect, test } from "@playwright/test";

/*
 * Commerce and billing (EPIC 13). CI has no identity provider and no Stripe account: quotes,
 * invoices, payments and webhooks are covered by the API tests and checked manually with the
 * simulated payment pages; here, access control of the pages and documents.
 */
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "routing behaviour is viewport-independent");
});

const ORG = "11111111-2222-4333-8444-555555555555";
const ID = "66666666-7777-4888-9999-000000000000";

test("billing pages require a session", async ({ request }) => {
  for (const [path, encoded] of [
    [`/fr/espace-client/portail/${ORG}/facturation`, `%2Ffr%2Fespace-client%2Fportail%2F${ORG}%2Ffacturation`],
    [`/en/account/portal/${ORG}/billing/invoices/${ID}`, `%2Fen%2Faccount%2Fportal%2F${ORG}%2Fbilling%2Finvoices%2F${ID}`],
    ["/fr/admin/billing/quotes", "%2Ffr%2Fadmin%2Fbilling%2Fquotes"],
  ] as const) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers()["location"]).toMatch(new RegExp(`/api/auth/login\\?returnTo=${encoded}$`));
  }
});

test("invoice and quote PDFs need a session and well-formed identifiers", async ({ request }) => {
  expect((await request.get(`/api/billing/${ORG}/invoices/${ID}`)).status()).toBe(401);
  expect((await request.get(`/api/admin/billing/quotes/${ID}`)).status()).toBe(401);
  expect((await request.get(`/api/billing/${ORG}/payments/${ID}`)).status()).toBe(404);
  expect((await request.get(`/api/billing/not-an-id/invoices/${ID}`)).status()).toBe(404);
});
