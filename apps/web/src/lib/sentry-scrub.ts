/* What Sentry may receive from the website (ADR-0018): no personal data, no secret link. */

const SECRET_PATHS = /\/(resultat|result)\/[^/?#]+/g;

/** A URL without its query string and with the secret diagnostic token masked. */
export function scrubUrl(url: string): string {
  return url.split(/[?#]/, 1)[0]!.replace(SECRET_PATHS, "/$1/[token]");
}

type Event = {
  request?: { url?: string; headers?: unknown; cookies?: unknown; data?: unknown; query_string?: unknown };
  user?: unknown;
  transaction?: string;
  breadcrumbs?: { data?: Record<string, unknown>; message?: string }[];
};

/** beforeSend / beforeSendTransaction: keeps the URL path (scrubbed) and nothing personal. */
export function scrubEvent<T extends Event>(event: T): T {
  if (event.request) event.request = event.request.url ? { url: scrubUrl(event.request.url) } : {};
  delete event.user;
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  for (const crumb of event.breadcrumbs ?? []) {
    for (const key of ["url", "from", "to"]) {
      const value = crumb.data?.[key];
      if (typeof value === "string") crumb.data![key] = scrubUrl(value);
    }
    if (crumb.message) crumb.message = scrubUrl(crumb.message);
  }
  return event;
}
