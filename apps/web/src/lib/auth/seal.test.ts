import { describe, expect, it } from "vitest";

import { seal, unseal } from "./seal";

const SECRET = "a-test-secret-that-is-long-enough-123456";

describe("seal / unseal", () => {
  it("round-trips a payload", async () => {
    const sealed = await seal({ sub: "user-1", accessToken: "token" }, SECRET, 60);

    expect(sealed).not.toContain("token"); // encrypted, not just signed
    await expect(unseal(sealed, SECRET)).resolves.toMatchObject({ sub: "user-1", accessToken: "token" });
  });

  it("rejects a value sealed with another secret", async () => {
    const sealed = await seal({ sub: "user-1" }, `${SECRET}-other`, 60);
    await expect(unseal(sealed, SECRET)).resolves.toBeNull();
  });

  it("rejects a tampered value", async () => {
    const sealed = await seal({ sub: "user-1" }, SECRET, 60);
    const tampered = `${sealed.slice(0, -4)}AAAA`;
    await expect(unseal(tampered, SECRET)).resolves.toBeNull();
  });

  it("rejects an expired value", async () => {
    const sealed = await seal({ sub: "user-1" }, SECRET, -10);
    await expect(unseal(sealed, SECRET)).resolves.toBeNull();
  });

  it("returns null for a missing value", async () => {
    await expect(unseal(undefined, SECRET)).resolves.toBeNull();
  });

  it("refuses short secrets", async () => {
    await expect(seal({}, "short", 60)).rejects.toThrow(/at least 32/);
  });
});
