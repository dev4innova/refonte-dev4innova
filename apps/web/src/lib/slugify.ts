/** "Stratégie IA : l'essentiel !" → "strategie-ia-l-essentiel" (CMS slug pattern). */
export function slugify(value: string, maxLength = 120): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** Slug being typed: same characters as `slugify`, but keeps a trailing hyphen so that
 * "mon-" can become "mon-adresse". Finalised with `slugify` when the field loses focus. */
export function slugDraft(value: string, maxLength = 120): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/g, "")
    .slice(0, maxLength);
}
