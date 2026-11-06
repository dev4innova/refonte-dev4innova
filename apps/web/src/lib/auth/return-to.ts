/**
 * Validates the page to come back to after sign-in. Only same-site absolute paths are
 * accepted: anything else ("https://evil.com", "//evil.com", "/\evil.com") would turn
 * the login route into an open redirect.
 */
export function sanitizeReturnTo(value: string | null | undefined, fallback = "/"): string {
  if (!value || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Reject control characters and backslashes anywhere (some browsers treat "\" as "/").
  if (/[\u0000-\u001f\\]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://placeholder.invalid");
    if (url.origin !== "https://placeholder.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
