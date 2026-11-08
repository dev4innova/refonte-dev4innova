"""Academy (EPIC 12): courses written in the back office in both languages, open and
restricted courses, progress, server-graded quizzes and verifiable certificates."""

from collections.abc import Awaitable, Callable
from typing import Any

import pytest
from httpx import AsyncClient

from app.cli import grant_staff
from app.modules.academy.common import InvalidVideoError, embed_url
from app.modules.academy.learning import new_code
from tests.conftest import Actor

SignIn = Callable[[str], Awaitable[Actor]]
ADMIN = "/api/v1/admin/academy"
PUBLIC = "/api/v1/academy"
ME = "/api/v1/me/academy"


def both(fr: str, en: str | None = None) -> dict[str, str]:
    return {"fr": fr, "en": en if en is not None else f"{fr} (EN)"}


async def make_staff(sign_in: SignIn, name: str, role: str = "staff_editor") -> Actor:
    actor = await sign_in(name)
    await grant_staff(actor.email, role)
    return actor


async def build_course(
    client: AsyncClient,
    staff: Actor,
    slug: str = "ia-generative",
    visibility: str = "public",
    publish: bool = True,
) -> dict[str, Any]:
    """Two modules: the first with two lessons and a 2-question quiz, the second with one lesson."""
    h = staff.headers
    course = await client.post(
        f"{ADMIN}/courses",
        headers=h,
        json={
            "slug": slug,
            "visibility": visibility,
            "level": "beginner",
            "duration_minutes": 90,
            "title": both("L'IA générative au travail"),
            "summary": both("Comprendre et utiliser l'IA générative"),
            "description_md": both("Une formation **pratique**."),
        },
    )
    assert course.status_code == 201, course.text
    course_id = course.json()["id"]
    for title in ("Les bases", "En pratique"):
        r = await client.post(
            f"{ADMIN}/courses/{course_id}/modules", headers=h, json={"title": both(title)}
        )
        assert r.status_code == 201, r.text
    modules = r.json()["outline"]
    lessons = [
        (modules[0]["id"], "Qu'est-ce qu'un LLM ?"),
        (modules[0]["id"], "Les limites"),
        (modules[1]["id"], "Rédiger un prompt"),
    ]
    for module_id, title in lessons:
        r = await client.post(
            f"{ADMIN}/modules/{module_id}/lessons",
            headers=h,
            json={
                "title": both(title),
                "body_md": both(f"## {title}\n\nContenu."),
                "duration_minutes": 10,
            },
        )
        assert r.status_code == 201, r.text
    for prompt, correct in (("Un LLM prédit…", 1), ("Une hallucination est…", 0)):
        r = await client.post(
            f"{ADMIN}/modules/{modules[0]['id']}/questions",
            headers=h,
            json={
                "prompt": both(prompt),
                "options": [both("Une réponse fausse"), both("Le mot suivant")]
                if correct
                else [both("Une invention"), both("Un bug")],
                "correct_option": correct,
                "explanation": both("Parce que."),
            },
        )
        assert r.status_code == 201, r.text
    if publish:
        r = await client.post(f"{ADMIN}/courses/{course_id}/publish", headers=h)
        assert r.status_code == 200, r.text
    data: dict[str, Any] = (await client.get(f"{ADMIN}/courses/{course_id}", headers=h)).json()
    return data


# --- Units -------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("url", "embed"),
    [
        (
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1",
            "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
        ),
        ("youtu.be/dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"),
        (
            "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
            "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
        ),
        ("https://vimeo.com/76979871", "https://player.vimeo.com/video/76979871?dnt=1"),
        (
            "https://player.vimeo.com/video/76979871",
            "https://player.vimeo.com/video/76979871?dnt=1",
        ),
        ("", None),
    ],
)
def test_videos_become_privacy_enhanced_embeds(url: str, embed: str | None) -> None:
    assert embed_url(url) == embed


@pytest.mark.parametrize(
    "url",
    [
        "https://evil.example.com/watch?v=dQw4w9WgXcQ",
        "javascript:alert(1)",
        "https://youtube.com/watch?v=<script>",
        "https://vimeo.com/abc",
    ],
)
def test_other_video_links_are_refused(url: str) -> None:
    with pytest.raises(InvalidVideoError):
        embed_url(url)


def test_certificate_codes_are_readable_and_random() -> None:
    codes = {new_code() for _ in range(200)}
    assert len(codes) == 200
    assert all(
        len(c) == 18 and c.startswith("D4I-") and not set(c[4:]) & set("01OI") for c in codes
    )


# --- Writing courses (TASK-103 to TASK-105, TASK-108) ------------------------------------


async def test_courses_are_published_only_when_complete_in_both_languages(
    client: AsyncClient, sign_in: SignIn
) -> None:
    editor = await make_staff(sign_in, "ed")
    h = editor.headers
    created = await client.post(
        f"{ADMIN}/courses", headers=h, json={"slug": "prompting", "title": {"fr": "Prompting"}}
    )
    assert created.status_code == 201
    course_id = created.json()["id"]
    assert [m["field"] for m in created.json()["missing"]] == ["title", "summary", "modules"]
    refused = await client.post(f"{ADMIN}/courses/{course_id}/publish", headers=h)
    assert refused.status_code == 409
    assert {"kind": "course", "ref": None, "field": "modules"} in refused.json()["error"][
        "details"
    ]["missing"]
    # French is required everywhere; addresses are unique.
    assert (
        await client.post(
            f"{ADMIN}/courses", headers=h, json={"slug": "x-y", "title": {"en": "Only EN"}}
        )
    ).status_code == 422
    assert (
        await client.post(
            f"{ADMIN}/courses", headers=h, json={"slug": "prompting", "title": {"fr": "Bis"}}
        )
    ).status_code == 409
    assert (
        await client.post(
            f"{ADMIN}/courses", headers=h, json={"slug": "Pas un slug", "title": {"fr": "x"}}
        )
    ).status_code == 422

    module = (
        await client.post(
            f"{ADMIN}/courses/{course_id}/modules", headers=h, json={"title": {"fr": "Module"}}
        )
    ).json()["outline"][0]
    lesson = await client.post(
        f"{ADMIN}/modules/{module['id']}/lessons",
        headers=h,
        json={
            "title": {"fr": "Leçon"},
            "body_md": {"fr": "Texte <script>alert(1)</script> [lien](javascript:alert(1))"},
            "video_url": "https://youtu.be/dQw4w9WgXcQ",
        },
    )
    assert lesson.status_code == 201
    assert lesson.json()["video_url"] == "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
    bad_video = await client.put(
        f"{ADMIN}/lessons/{lesson.json()['id']}",
        headers=h,
        json={"title": {"fr": "Leçon"}, "video_url": "https://evil.example.com/v"},
    )
    assert bad_video.status_code == 422
    question = await client.post(
        f"{ADMIN}/modules/{module['id']}/questions",
        headers=h,
        json={"prompt": {"fr": "?"}, "options": [{"fr": "a"}, {"fr": "b"}], "correct_option": 2},
    )
    assert question.status_code == 422  # the right answer must be an option
    missing = (await client.get(f"{ADMIN}/courses/{course_id}", headers=h)).json()["missing"]
    assert {(m["kind"], m["ref"], m["field"]) for m in missing} == {
        ("course", None, "title"),
        ("course", None, "summary"),
        ("module", "1", "title"),
        ("lesson", "1.1", "title"),
        ("lesson", "1.1", "body_en"),
    }

    course = await build_course(client, editor, "ia")
    assert course["status"] == "published" and course["missing"] == []
    lessons = course["outline"][0]["lessons"]
    moved = await client.post(
        f"{ADMIN}/lessons/{lessons[1]['id']}/move", headers=h, json={"direction": "up"}
    )
    assert [lesson["title"]["fr"] for lesson in moved.json()["outline"][0]["lessons"]] == [
        "Les limites",
        "Qu'est-ce qu'un LLM ?",
    ]

    # Only staff who write content manage the Academy.
    sales = await make_staff(sign_in, "sam", role="staff_sales")
    learner = await sign_in("lea")
    assert (await client.get(f"{ADMIN}/courses", headers=sales.headers)).status_code == 403
    assert (await client.get(f"{ADMIN}/courses", headers=learner.headers)).status_code == 404


async def test_lesson_markdown_is_sanitized(client: AsyncClient, sign_in: SignIn) -> None:
    editor = await make_staff(sign_in, "ed")
    course = await build_course(client, editor)
    lesson_id = course["outline"][0]["lessons"][0]["id"]
    await client.put(
        f"{ADMIN}/lessons/{lesson_id}",
        headers=editor.headers,
        json={
            "title": both("Leçon"),
            "body_md": both("Texte <script>alert(1)</script> [lien](javascript:alert(1))"),
        },
    )
    learner = await sign_in("lea")
    await client.post(f"{PUBLIC}/courses/ia-generative/enroll", headers=learner.headers)
    body = (await client.get(f"{ME}/lessons/{lesson_id}", headers=learner.headers)).json()[
        "body_html"
    ]
    assert "<script" not in body and 'href="javascript' not in body
    assert "&lt;script&gt;" in body


# --- Learning (TASK-103, TASK-106 to TASK-109) ---------------------------------------------


async def test_a_learner_follows_a_course_to_the_certificate(
    client: AsyncClient, sign_in: SignIn
) -> None:
    editor = await make_staff(sign_in, "ed")
    course = await build_course(client, editor)
    await build_course(client, editor, "brouillon", publish=False)
    await build_course(client, editor, "reserve", visibility="restricted")

    catalog = (await client.get(f"{PUBLIC}/courses", params={"locale": "en"})).json()
    assert [(c["slug"], c["title"], c["lessons"], c["quizzes"]) for c in catalog] == [
        ("ia-generative", "L'IA générative au travail (EN)", 3, 1)
    ]
    outline = (await client.get(f"{PUBLIC}/courses/ia-generative")).json()
    assert outline["description_html"] == "<p>Une formation <strong>pratique</strong>.</p>\n"
    assert "body_html" not in str(outline) and outline["outline"][0]["questions"] == 2
    for slug in ("brouillon", "reserve", "inconnu"):
        assert (await client.get(f"{PUBLIC}/courses/{slug}")).status_code == 404

    assert (await client.post(f"{PUBLIC}/courses/ia-generative/enroll")).status_code == 401
    learner = await sign_in("lea")
    enrolled = await client.post(f"{PUBLIC}/courses/ia-generative/enroll", headers=learner.headers)
    assert enrolled.status_code == 200
    assert enrolled.json()["progress"] == {
        "lessons_done": 0,
        "lessons_total": 3,
        "quizzes_passed": 0,
        "quizzes_total": 1,
        "percent": 0,
    }
    again = await client.post(f"{PUBLIC}/courses/ia-generative/enroll", headers=learner.headers)
    assert again.json()["enrolled_at"] == enrolled.json()["enrolled_at"]
    assert (
        await client.post(f"{PUBLIC}/courses/reserve/enroll", headers=learner.headers)
    ).status_code == 404

    mine = (await client.get(f"{ME}/courses/ia-generative", headers=learner.headers)).json()
    first, second = mine["outline"][0]["lessons"][:2]
    assert mine["next_lesson_id"] == first["id"]
    lesson = (await client.get(f"{ME}/lessons/{first['id']}", headers=learner.headers)).json()
    assert lesson["previous_lesson_id"] is None and lesson["next_lesson_id"] == second["id"]
    assert lesson["body_html"].startswith("<h2>") and lesson["module_has_quiz"] is True

    # Someone not enrolled reaches nothing.
    other = await sign_in("otto")
    for url in (
        f"{ME}/lessons/{first['id']}",
        f"{ME}/courses/ia-generative",
        f"{ME}/quizzes/{mine['outline'][0]['id']}",
    ):
        assert (await client.get(url, headers=other.headers)).status_code == 404
    assert (
        await client.post(f"{ME}/lessons/{first['id']}/complete", headers=other.headers)
    ).status_code == 404

    # The quiz never gives its answers away before grading.
    module_id = mine["outline"][0]["id"]
    quiz = (await client.get(f"{ME}/quizzes/{module_id}", headers=learner.headers)).json()
    assert "correct" not in str(quiz) and "explanation" not in str(quiz)
    q1, q2 = (q["id"] for q in quiz["questions"])
    failed = (
        await client.post(
            f"{ME}/quizzes/{module_id}", headers=learner.headers, json={"answers": {q1: 0}}
        )
    ).json()
    assert (failed["score"], failed["passed"]) == (0, False)
    assert [r["correct_option"] for r in failed["results"]] == [1, 0]
    assert failed["results"][1]["chosen"] is None
    passed = (
        await client.post(
            f"{ME}/quizzes/{module_id}", headers=learner.headers, json={"answers": {q1: 1, q2: 0}}
        )
    ).json()
    assert (passed["score"], passed["passed"], passed["certificate_code"]) == (100, True, None)

    for lesson_id in (first["id"], second["id"]):
        done = (
            await client.post(f"{ME}/lessons/{lesson_id}/complete", headers=learner.headers)
        ).json()
    assert done["certificate_code"] is None and done["progress"]["percent"] == 75
    last = mine["outline"][1]["lessons"][0]["id"]
    finished = (await client.post(f"{ME}/lessons/{last}/complete", headers=learner.headers)).json()
    code = finished["certificate_code"]
    assert finished["course_completed"] is True and code.startswith("D4I-")
    # Marking a lesson again changes nothing and issues no second certificate.
    again_done = (
        await client.post(f"{ME}/lessons/{last}/complete", headers=learner.headers)
    ).json()
    assert again_done["certificate_code"] is None and again_done["progress"]["percent"] == 100
    assert (await client.get(f"{ME}/courses", headers=learner.headers)).json()[0][
        "certificate_code"
    ] == code

    verified = (
        await client.get(f"{PUBLIC}/certificates/{code.lower()}", params={"locale": "en"})
    ).json()
    assert verified | {"issued_at": None} == {
        "code": code,
        "learner_name": "Lea",
        "course_title": "L'IA générative au travail (EN)",
        "course_slug": "ia-generative",
        "duration_minutes": 90,
        "issued_at": None,
        "valid": True,
    }
    pdf = await client.get(f"{PUBLIC}/certificates/{code}/pdf")
    assert pdf.content.startswith(b"%PDF") and pdf.headers["content-type"] == "application/pdf"
    assert (await client.get(f"{PUBLIC}/certificates/D4I-AAAA-BBBB-CCCC")).status_code == 404

    # Unpublished: hidden from the catalog and from its learners; the certificate stays valid.
    await client.post(f"{ADMIN}/courses/{course['id']}/unpublish", headers=editor.headers)
    assert (await client.get(f"{PUBLIC}/courses")).json() == []
    assert (await client.get(f"{ME}/courses", headers=learner.headers)).json() == []
    assert (
        await client.get(f"{ME}/lessons/{first['id']}", headers=learner.headers)
    ).status_code == 404
    assert (await client.get(f"{PUBLIC}/certificates/{code}")).json()["valid"] is True
    assert (
        await client.delete(f"{ADMIN}/courses/{course['id']}", headers=editor.headers)
    ).status_code == 409


async def test_the_team_enrolls_client_members_who_their_organization_follows(
    client: AsyncClient, sign_in: SignIn
) -> None:
    editor = await make_staff(sign_in, "ed")
    owner = await sign_in("olga")
    member = await sign_in("mia")
    rival = await sign_in("rita")
    outsider = await sign_in("otto")
    org = (
        await client.post(
            "/api/v1/organizations", headers=owner.headers, json={"name": "Acme", "slug": "acme"}
        )
    ).json()["id"]
    await client.post(
        f"/api/v1/organizations/{org}/members", headers=owner.headers, json={"email": member.email}
    )
    other = (
        await client.post(
            "/api/v1/organizations",
            headers=rival.headers,
            json={"name": "Globex", "slug": "globex"},
        )
    ).json()["id"]
    draft = await build_course(client, editor, "brouillon", visibility="restricted", publish=False)
    course = await build_course(client, editor, "reserve", visibility="restricted")
    url = f"{ADMIN}/courses/{course['id']}/enrollments"

    assert (
        await client.post(
            f"{ADMIN}/courses/{draft['id']}/enrollments",
            headers=editor.headers,
            json={"organization_id": org, "user_ids": [member.id]},
        )
    ).status_code == 409
    assert (
        await client.post(
            url, headers=editor.headers, json={"organization_id": org, "user_ids": [outsider.id]}
        )
    ).status_code == 404
    enrolled = await client.post(
        url,
        headers=editor.headers,
        json={"organization_id": org, "user_ids": [member.id, owner.id]},
    )
    assert enrolled.json() == {"enrolled": 2, "already": 0}
    assert (
        await client.post(
            url, headers=editor.headers, json={"organization_id": org, "user_ids": [member.id]}
        )
    ).json() == {"enrolled": 0, "already": 1}
    members = (
        await client.get(
            f"{ADMIN}/courses/{course['id']}/organizations/{org}/members", headers=editor.headers
        )
    ).json()
    assert all(m["enrolled"] for m in members)
    assert [
        o["slug"]
        for o in (await client.get(f"{ADMIN}/organizations", headers=editor.headers)).json()
    ] == ["acme", "globex"]

    # The member follows the restricted course; the organization's admins follow the member.
    mine = (await client.get(f"{ME}/courses", headers=member.headers)).json()
    assert [(c["course"]["slug"], c["sponsor"]["slug"]) for c in mine] == [("reserve", "acme")]
    lesson = (
        mine
        and (await client.get(f"{ME}/courses/reserve", headers=member.headers)).json()[
            "next_lesson_id"
        ]
    )
    await client.post(f"{ME}/lessons/{lesson}/complete", headers=member.headers)
    report = (
        await client.get(f"/api/v1/organizations/{org}/academy/enrollments", headers=owner.headers)
    ).json()
    progress = {r["learner"]["email"]: r["progress"]["lessons_done"] for r in report}
    assert progress == {member.email: 1, owner.email: 0}
    # Members do not see the others' progress; other organizations see nothing of Acme.
    assert (
        await client.get(f"/api/v1/organizations/{org}/academy/enrollments", headers=member.headers)
    ).status_code == 403
    assert (
        await client.get(
            f"/api/v1/organizations/{other}/academy/enrollments", headers=rival.headers
        )
    ).json() == []
    assert (
        await client.get(f"/api/v1/organizations/{org}/academy/enrollments", headers=rival.headers)
    ).status_code == 404

    staff_view = (await client.get(url, headers=editor.headers)).json()
    assert {r["sponsor"]["slug"] for r in staff_view} == {"acme"}
    removed = await client.delete(
        f"{ADMIN}/enrollments/{staff_view[0]['id']}", headers=editor.headers
    )
    assert removed.status_code == 204
    assert len((await client.get(url, headers=editor.headers)).json()) == 1
    # A course without learners can be deleted.
    assert (
        await client.delete(f"{ADMIN}/courses/{draft['id']}", headers=editor.headers)
    ).status_code == 204
