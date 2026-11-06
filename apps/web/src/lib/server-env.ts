import "server-only";

/** Server-side environment. Never import from client components. */
export function getApiUrl(): string {
  const url = process.env.API_URL;
  if (!url) {
    throw new Error("API_URL is not set (see apps/web/.env.example)");
  }
  return url;
}
