import { describe, expect, it } from "vitest";

import { isProtectedPath } from "./protected-paths";

describe("isProtectedPath", () => {
  it.each(["/fr/espace-client", "/fr/espace-client/organisations", "/en/account", "/en/account/x"])(
    "protects %s",
    (path) => {
      expect(isProtectedPath(path)).toBe(true);
    },
  );

  it.each(["/fr", "/en", "/fr/account", "/en/espace-client", "/fr/espace-clients", "/en/accounting"])(
    "leaves %s public",
    (path) => {
      expect(isProtectedPath(path)).toBe(false);
    },
  );
});
