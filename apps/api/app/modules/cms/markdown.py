"""Markdown → safe HTML (TASK-060). Raw HTML is disabled at parse time AND the output is
sanitized with an allow-list (nh3): content edited in the back office can never inject
scripts, styles or event handlers into the public website."""

from urllib.parse import urlparse

import nh3
from markdown_it import MarkdownIt

from app.core.config import get_settings

_md = MarkdownIt("commonmark", {"html": False, "linkify": False, "typographer": True}).enable(
    ["table", "strikethrough"]
)

ALLOWED_TAGS = {
    "p", "h2", "h3", "h4", "ul", "ol", "li", "strong", "em", "del", "a", "blockquote",
    "code", "pre", "img", "hr", "br", "table", "thead", "tbody", "tr", "th", "td",
}  # fmt: skip
ALLOWED_ATTRIBUTES = {"a": {"href", "title"}, "img": {"src", "alt", "title"}, "th": {"align"}}


def _attribute_filter(tag: str, attribute: str, value: str) -> str | None:
    if tag == "a" and attribute == "href":
        parsed = urlparse(value)
        if parsed.scheme in ("http", "https", "mailto") or value.startswith(("/", "#")):
            return value
        return None
    if tag == "img" and attribute == "src":
        # Only images from our own media storage.
        return value if value.startswith(f"{get_settings().media_public_base_url}/") else None
    return value


def render_markdown(source: str) -> str:
    """Renders Markdown to sanitized HTML. Headings start at <h2>: the page owns the <h1>."""
    html = _md.render(source).replace("<h1>", "<h2>").replace("</h1>", "</h2>")
    return nh3.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        attribute_filter=_attribute_filter,
        link_rel="noopener noreferrer",
        url_schemes={"http", "https", "mailto"},
    )
