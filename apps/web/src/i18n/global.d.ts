import type messages from "../../messages/fr.json";
import type { routing } from "./routing";

// Type-safe locales and message keys for useTranslations / getTranslations.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
