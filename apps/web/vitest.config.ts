import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const alias = { "@": path.resolve(import.meta.dirname, "src") };

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        // Pure logic and server-side modules.
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        // React components, rendered in a simulated DOM.
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
