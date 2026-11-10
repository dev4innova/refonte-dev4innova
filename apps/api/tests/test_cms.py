"""CMS (EPIC 06): staff access, documents, translations, publication, SEO, Markdown
safety, media and the public content API."""

import io
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy import text

from app.cli import grant_staff
from app.core.storage import ObjectStorage
from app.db.session import get_engine
from app.modules.cms.markdown import render_markdown
from tests.conftest import TEST_BUCKET, TEST_MEDIA_URL, Actor

ADMIN = "/api/v1/admin/cms"
PUBLIC = "/api/v1/content"
SignIn = Callable[[str], Awaitable[Actor]]


async def make_staff(sign_in: SignIn, name: str, role: str = "staff_editor") -> Actor:
    actor = await sign_in(name)
    await grant_staff(actor.email, role)
    return actor


def translations(slug: str = "premier-article", **overrides: Any) -> dict[str, Any]:
    data = {
        "fr": {
            "slug": slug,
            "title": "Premier article",
            "summary": "Résumé en français",
            "body_md": "## Introduction\n\nTexte **important**.",
            "seo_title": "Premier article sur l'IA",
            "seo_description": "Description SEO en français",
        },
        "en": {
            "slug": f"{slug}-en",
            "title": "First article",
            "summary": "English summary",
            "body_md": "Some *text*.",
        },
    }
    data.update(overrides)
    return data


def png_bytes(size: tuple[int, int] = (64, 32), *, with_exif: bool = False) -> bytes:
    image = Image.new("RGB", size, (217, 0, 0))
    output = io.BytesIO()
    if with_exif:
        exif = Image.Exif()
        exif[0x010E] = "secret description"  # ImageDescription
        image.save(output, format="PNG", exif=exif)
    else:
        image.save(output, format="PNG")
    return output.getvalue()


async def create(client: AsyncClient, staff: Actor, **body: Any) -> dict[str, Any]:
    payload = {"type": "article", "translations": translations(), **body}
    response = await client.post(f"{ADMIN}/documents", headers=staff.headers, json=payload)
    assert response.status_code == 201, response.text
    return dict(response.json())


# --- Access -------------------------------------------------------------------------


async def test_non_staff_users_cannot_see_the_back_office(
    client: AsyncClient, sign_in: SignIn
) -> None:
    visitor = await sign_in("visitor")
    # Even the owner of a client organization is not staff.
    await client.post(
        "/api/v1/organizations", headers=visitor.headers, json={"name": "Acme", "slug": "acme"}
    )

    for method, url in [
        ("GET", f"{ADMIN}/documents?type=article"),
        ("POST", f"{ADMIN}/documents"),
        ("GET", f"{ADMIN}/media"),
        ("POST", f"{ADMIN}/preview"),
    ]:
        response = await client.request(method, url, headers=visitor.headers, json={})
        assert response.status_code == 404, f"{method} {url}"


async def test_requires_authentication(client: AsyncClient) -> None:
    assert (await client.get(f"{ADMIN}/documents?type=article")).status_code == 401


async def test_sales_staff_can_read_but_not_write(client: AsyncClient, sign_in: SignIn) -> None:
    sales = await make_staff(sign_in, "sam", "staff_sales")

    listing = await client.get(f"{ADMIN}/documents?type=service", headers=sales.headers)
    creation = await client.post(
        f"{ADMIN}/documents",
        headers=sales.headers,
        json={"type": "article", "translations": translations()},
    )

    assert listing.status_code == 200
    assert creation.status_code == 403


async def test_grant_staff_requires_a_signed_in_user() -> None:
    with pytest.raises(SystemExit, match="create it on the website first"):
        await grant_staff("nobody@example.com", "staff_admin")


# --- Documents ----------------------------------------------------------------------


async def test_full_editorial_workflow(client: AsyncClient, sign_in: SignIn) -> None:
    editor = await make_staff(sign_in, "eve")
    doc = await create(client, editor)
    doc_id = doc["id"]
    assert doc["status"] == "draft"
    assert {t["locale"] for t in doc["translations"]} == {"fr", "en"}

    # Drafts are invisible on the website.
    assert (await client.get(f"{PUBLIC}/article?locale=fr")).json() == []
    assert (await client.get(f"{PUBLIC}/article/premier-article?locale=fr")).status_code == 404

    published = await client.post(f"{ADMIN}/documents/{doc_id}/publish", headers=editor.headers)
    assert published.json()["status"] == "published"
    assert published.json()["published_at"]

    listing = (await client.get(f"{PUBLIC}/article?locale=en")).json()
    assert [(c["slug"], c["title"]) for c in listing] == [("premier-article-en", "First article")]

    detail = (await client.get(f"{PUBLIC}/article/premier-article?locale=fr")).json()
    assert detail["title"] == "Premier article"
    assert (
        detail["body_html"] == "<h2>Introduction</h2>\n<p>Texte <strong>important</strong>.</p>\n"
    )
    assert detail["seo_title"] == "Premier article sur l'IA"
    assert detail["slugs"] == {"fr": "premier-article", "en": "premier-article-en"}

    # The French slug also finds the English version (language switch); the caller
    # redirects to the canonical English slug.
    switched = (await client.get(f"{PUBLIC}/article/premier-article?locale=en")).json()
    assert (switched["title"], switched["slug"]) == ("First article", "premier-article-en")

    # Edit, then unpublish: the article disappears from the website.
    updated = await client.patch(
        f"{ADMIN}/documents/{doc_id}",
        headers=editor.headers,
        json={"translations": {"fr": {**translations()["fr"], "title": "Titre modifié"}}},
    )
    assert updated.json()["translations"][1]["title"] == "Titre modifié"
    await client.post(f"{ADMIN}/documents/{doc_id}/unpublish", headers=editor.headers)
    assert (await client.get(f"{PUBLIC}/article?locale=fr")).json() == []


async def test_publishing_requires_every_language(client: AsyncClient, sign_in: SignIn) -> None:
    editor = await make_staff(sign_in, "eve")
    doc = await create(client, editor, translations={"fr": translations()["fr"]})

    response = await client.post(f"{ADMIN}/documents/{doc['id']}/publish", headers=editor.headers)

    assert response.status_code == 422
    assert response.json()["error"]["details"]["missing_locales"] == ["en"]


async def test_slugs_are_unique_per_type_and_language(client: AsyncClient, sign_in: SignIn) -> None:
    editor = await make_staff(sign_in, "eve")
    await create(client, editor)

    duplicate = await client.post(
        f"{ADMIN}/documents",
        headers=editor.headers,
        json={"type": "article", "translations": translations()},
    )
    other_type = await client.post(
        f"{ADMIN}/documents",
        headers=editor.headers,
        json={"type": "project", "translations": translations()},
    )
    invalid = await client.post(
        f"{ADMIN}/documents",
        headers=editor.headers,
        json={"type": "article", "translations": translations("Not A Slug")},
    )

    assert duplicate.status_code == 409
    assert other_type.status_code == 201
    assert invalid.status_code == 422


async def test_published_content_must_be_unpublished_before_deletion(
    client: AsyncClient, sign_in: SignIn
) -> None:
    editor = await make_staff(sign_in, "eve")
    doc_id = (await create(client, editor))["id"]
    await client.post(f"{ADMIN}/documents/{doc_id}/publish", headers=editor.headers)

    assert (
        await client.delete(f"{ADMIN}/documents/{doc_id}", headers=editor.headers)
    ).status_code == 409
    await client.post(f"{ADMIN}/documents/{doc_id}/unpublish", headers=editor.headers)
    assert (
        await client.delete(f"{ADMIN}/documents/{doc_id}", headers=editor.headers)
    ).status_code == 204


async def test_seeded_services_are_published_in_order(client: AsyncClient) -> None:
    services = (await client.get(f"{PUBLIC}/service?locale=fr")).json()

    assert [s["slug"] for s in services] == [
        "ai-strategy",
        "custom-development",
        "integration-deployment",
        "training-support",
        "run-and-improve",
    ]
    assert services[0]["title"] == "Conseil et stratégie IA"
    assert services[0]["attributes"] == {"icon": "compass"}
    detail = (await client.get(f"{PUBLIC}/service/ai-strategy?locale=en")).json()
    assert "<h2>What we deliver</h2>" in detail["body_html"]


async def test_unknown_document_types_are_rejected(client: AsyncClient) -> None:
    assert (await client.get(f"{PUBLIC}/secret?locale=fr")).status_code == 422


# --- Markdown safety ----------------------------------------------------------------


@pytest.mark.parametrize(
    ("source", "forbidden"),
    [
        ("<script>alert(1)</script>", "<script"),
        # Raw HTML is escaped into text: no real tag may remain.
        ('<img src=x onerror="alert(1)">', "<img"),
        ("[click](javascript:alert(1))", 'href="javascript'),
        ("![x](https://evil.example.com/track.png)", "evil.example.com"),
        ('<a href="https://x" style="color:red">x</a>', "<a "),
        ("<iframe src='https://evil.example.com'></iframe>", "<iframe"),
    ],
)
def test_markdown_output_is_sanitized(source: str, forbidden: str) -> None:
    assert forbidden not in render_markdown(source)


def test_markdown_keeps_safe_formatting() -> None:
    html = render_markdown(
        f"# Titre\n\n[Lien](https://example.com) ![Logo]({TEST_MEDIA_URL}/media/a.png)\n\n"
        "| A | B |\n|---|---|\n| 1 | 2 |"
    )
    assert "<h2>Titre</h2>" in html
    assert '<a href="https://example.com" rel="noopener noreferrer">Lien</a>' in html
    assert f'src="{TEST_MEDIA_URL}/media/a.png"' in html
    assert "<table>" in html


async def test_preview_renders_like_the_website(client: AsyncClient, sign_in: SignIn) -> None:
    editor = await make_staff(sign_in, "eve")
    response = await client.post(
        f"{ADMIN}/preview", headers=editor.headers, json={"body_md": "**Gras** <b>x</b>"}
    )
    assert response.json() == {"html": "<p><strong>Gras</strong> &lt;b&gt;x&lt;/b&gt;</p>\n"}


# --- Media --------------------------------------------------------------------------


async def upload(client: AsyncClient, actor: Actor, data: bytes, name: str = "photo.png") -> Any:
    return await client.post(
        f"{ADMIN}/media", headers=actor.headers, files={"file": (name, data, "image/png")}
    )


async def test_uploads_an_image_without_its_metadata(
    client: AsyncClient, sign_in: SignIn, storage: ObjectStorage
) -> None:
    editor = await make_staff(sign_in, "eve")

    response = await upload(client, editor, png_bytes(with_exif=True))

    assert response.status_code == 201
    media = response.json()
    assert (media["width"], media["height"], media["content_type"]) == (64, 32, "image/png")
    assert media["url"].startswith(f"{TEST_MEDIA_URL}/media/")
    key = media["url"].removeprefix(f"{TEST_MEDIA_URL}/")
    stored = storage._client.get_object(Bucket=TEST_BUCKET, Key=key)["Body"].read()
    assert b"secret description" not in stored  # re-encoded: EXIF removed

    # The bucket is private: the API serves the media library publicly (ADR-0019).
    served = await client.get(f"/api/v1/media/{key}")
    assert served.status_code == 200
    assert served.content == stored
    assert served.headers["content-type"] == "image/png"
    assert "immutable" in served.headers["cache-control"]
    assert served.headers["x-content-type-options"] == "nosniff"


async def test_only_media_of_the_library_are_served(
    client: AsyncClient, storage: ObjectStorage
) -> None:
    await storage.put("other/secret.txt", b"not a media", "text/plain")
    assert (await client.get("/api/v1/media/other/secret.txt")).status_code == 404
    assert (await client.get("/api/v1/media/media/missing.png")).status_code == 404


@pytest.mark.parametrize(
    "data",
    [
        b"<?php echo 'not an image'; ?>",
        b"GIF89a" + b"\x00" * 100,
    ],
)
async def test_rejects_files_that_are_not_accepted_images(
    client: AsyncClient, sign_in: SignIn, data: bytes
) -> None:
    editor = await make_staff(sign_in, "eve")
    assert (await upload(client, editor, data, "evil.png")).status_code == 422


async def test_rejects_files_that_are_too_large(
    client: AsyncClient, sign_in: SignIn, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.core.config import get_settings

    editor = await make_staff(sign_in, "eve")
    monkeypatch.setattr(get_settings(), "media_max_bytes", 1024)
    assert (await upload(client, editor, png_bytes((400, 400)))).status_code == 422


async def test_cover_image_with_translated_alt_text(client: AsyncClient, sign_in: SignIn) -> None:
    editor = await make_staff(sign_in, "eve")
    media_id = (await upload(client, editor, png_bytes())).json()["id"]
    await client.patch(
        f"{ADMIN}/media/{media_id}",
        headers=editor.headers,
        json={"alt_fr": "Logo rouge", "alt_en": "Red logo"},
    )
    doc = await create(client, editor, type="project", cover_media_id=media_id)
    await client.post(f"{ADMIN}/documents/{doc['id']}/publish", headers=editor.headers)

    fr = (await client.get(f"{PUBLIC}/project?locale=fr")).json()[0]["cover"]
    en = (await client.get(f"{PUBLIC}/project?locale=en")).json()[0]["cover"]
    assert (fr["alt"], en["alt"], fr["width"]) == ("Logo rouge", "Red logo", 64)

    # Deleting the media removes the cover, not the project.
    assert (
        await client.delete(f"{ADMIN}/media/{media_id}", headers=editor.headers)
    ).status_code == 204
    assert (await client.get(f"{PUBLIC}/project?locale=fr")).json()[0]["cover"] is None


async def test_cover_must_be_a_media_of_the_organization(
    client: AsyncClient, sign_in: SignIn
) -> None:
    editor = await make_staff(sign_in, "eve")
    response = await client.post(
        f"{ADMIN}/documents",
        headers=editor.headers,
        json={
            "type": "article",
            "translations": translations(),
            "cover_media_id": str(uuid.uuid4()),
        },
    )
    assert response.status_code == 404


async def test_content_of_another_organization_is_never_served(
    client: AsyncClient, sign_in: SignIn
) -> None:
    """A document stored for a client organization must not leak through the public API,
    which only serves the internal organization's content."""
    owner = await sign_in("owner")
    org_id = (
        await client.post(
            "/api/v1/organizations", headers=owner.headers, json={"name": "Acme", "slug": "acme"}
        )
    ).json()["id"]
    async with get_engine().begin() as conn:
        doc_id = uuid.uuid4()
        await conn.execute(
            text(
                "INSERT INTO cms_documents (id, organization_id, type, status, published_at) "
                "VALUES (:id, :org, 'article', 'published', now())"
            ),
            {"id": doc_id, "org": org_id},
        )
        for locale in ("fr", "en"):
            await conn.execute(
                text(
                    "INSERT INTO cms_document_translations "
                    "(id, document_id, organization_id, type, locale, slug, title) "
                    "VALUES (:id, :doc, :org, 'article', :locale, 'acme-secret', 'Secret')"
                ),
                {"id": uuid.uuid4(), "doc": doc_id, "org": org_id, "locale": locale},
            )

    assert (await client.get(f"{PUBLIC}/article?locale=fr")).json() == []
    assert (await client.get(f"{PUBLIC}/article/acme-secret?locale=fr")).status_code == 404
