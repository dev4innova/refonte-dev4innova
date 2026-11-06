// Conventions de commits : voir docs/rules/commits.md
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert"],
    ],
    "scope-enum": [
      1,
      "always",
      ["web", "api", "db", "infra", "ui", "i18n", "auth", "cms", "crm", "ai", "diagnostic", "portal", "academy", "billing", "docs", "deps", "repo"],
    ],
    "subject-case": [2, "never", ["upper-case", "pascal-case", "start-case"]],
    "header-max-length": [2, "always", 100],
  },
};
