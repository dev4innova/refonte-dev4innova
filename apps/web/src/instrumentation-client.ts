import { scrubEvent } from "@/lib/sentry-scrub";

/* Browser error tracking (TASK-117, ADR-0018): loaded only when NEXT_PUBLIC_SENTRY_DSN was set
 * at build time, so visitors download nothing otherwise. No replay, no personal data. */

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  void import("@sentry/nextjs").then((Sentry) =>
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "production",
      tracesSampleRate: 0.05,
      sendDefaultPii: false,
      beforeSend: (event) => scrubEvent(event),
      beforeSendTransaction: (event) => scrubEvent(event),
    }),
  );
}
