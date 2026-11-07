/**
 * Renders CMS rich text. The HTML comes from the API, which renders Markdown without raw
 * HTML and sanitizes the output with an allow-list (apps/api/app/modules/cms/markdown.py).
 */
export function Prose({ html }: { html: string }) {
  return <div className="prose-d4i" dangerouslySetInnerHTML={{ __html: html }} />;
}
