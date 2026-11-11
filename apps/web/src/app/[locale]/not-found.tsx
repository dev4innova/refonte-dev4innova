import { useTranslations } from "next-intl";

import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Localized 404, rendered inside the locale layout. */
export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <Section>
      <div className="flex max-w-2xl flex-col gap-6">
        <p className="font-heading text-display-xl font-bold text-primary-ink" aria-hidden="true">
          404
        </p>
        <h1 className="text-display-md font-semibold">{t("title")}</h1>
        <p className="text-lg text-muted-foreground">{t("description")}</p>
        <div>
          <Button asChild>
            <Link href="/">{t("backHome")}</Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
