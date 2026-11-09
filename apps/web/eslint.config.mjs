import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import security from "eslint-plugin-security";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Security rules (TASK-120). Object injection reports every obj[key]: too noisy for typed code.
    ...security.configs.recommended,
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}", "src/test/**"],
    rules: { ...security.configs.recommended.rules, "security/detect-object-injection": "off" },
  },
  {
    // Internal links must be locale-aware (docs/rules/frontend.md, ADR-0008).
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/i18n/**", "src/**/*.test.{ts,tsx}", "src/test/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message: "Use Link from '@/i18n/navigation' (adds the locale and translates the path).",
            },
            {
              name: "next/navigation",
              importNames: ["redirect", "permanentRedirect", "usePathname", "useRouter"],
              message: "Use the locale-aware versions from '@/i18n/navigation'.",
            },
          ],
        },
      ],
    },
  },
  {
    // Tests render plain anchors on purpose.
    files: ["src/**/*.test.{ts,tsx}", "src/test/**"],
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
