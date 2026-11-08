"""Client portal (EPIC 11): staff-run projects, client reviews, private files, support
tickets and in-app notifications, with isolation between organizations."""

import io
import zipfile
from collections.abc import Awaitable, Callable
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
from httpx import AsyncClient

from app.cli import grant_staff
from app.core.config import get_settings
from app.core.storage import PrivateStorage
from app.modules.identity.models import INTERNAL_ORGANIZATION_ID
from app.modules.portal.files import FileRejectedError, clean_name, detect
from tests.conftest import TEST_PORTAL_BUCKET, Actor

SignIn = Callable[[str], Awaitable[Actor]]
ADMIN = "/api/v1/admin/portal"
PDF = b"%PDF-1.4\n% test\n"


def portal(org: str) -> str:
    return f"/api/v1/organizations/{org}/portal"


def docx() -> bytes:
    out = io.BytesIO()
    with zipfile.ZipFile(out, "w") as archive:
        archive.writestr("word/document.xml", "<w:document/>")
    return out.getvalue()


async def make_staff(sign_in: SignIn, name: str, role: str = "staff_sales") -> Actor:
    actor = await sign_in(name)
    await grant_staff(actor.email, role)
    return actor


async def client_org(
    client: AsyncClient, owner: Actor, slug: str, *members: tuple[Actor, str]
) -> str:
    response = await client.post(
        "/api/v1/organizations", headers=owner.headers, json={"name": slug.title(), "slug": slug}
    )
    assert response.status_code == 201, response.text
    org: str = response.json()["id"]
    for member, role in members:
        added = await client.post(
            f"/api/v1/organizations/{org}/members",
            headers=owner.headers,
            json={"email": member.email, "role": role},
        )
        assert added.status_code == 201, added.text
    return org


async def project(client: AsyncClient, staff: Actor, org: str, **body: Any) -> dict[str, Any]:
    response = await client.post(
        f"{ADMIN}/projects",
        headers=staff.headers,
        json={"organization_id": org, "name": "Assistant RH", **body},
    )
    assert response.status_code == 201, response.text
    data: dict[str, Any] = response.json()
    return data


async def deliverable(
    client: AsyncClient, staff: Actor, project_id: str, data: bytes = PDF, name: str = "spec.pdf"
) -> dict[str, Any]:
    response = await client.post(
        f"{ADMIN}/projects/{project_id}/deliverables",
        headers=staff.headers,
        data={"title": "Cahier des charges", "description": "Version initiale"},
        files={"file": (name, data, "application/octet-stream")},
    )
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


async def notifications(client: AsyncClient, actor: Actor) -> list[dict[str, Any]]:
    response = await client.get("/api/v1/me/notifications", headers=actor.headers)
    assert response.status_code == 200
    items: list[dict[str, Any]] = response.json()["items"]
    return items


def objects(storage: PrivateStorage) -> list[str]:
    listing = storage._client.list_objects_v2(Bucket=TEST_PORTAL_BUCKET)
    return [o["Key"] for o in listing.get("Contents", [])]


# --- Files -----------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("name", "data", "content_type"),
    [
        ("devis.pdf", PDF, "application/pdf"),
        (
            "note.docx",
            docx(),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
        ("photo.jpeg", b"\xff\xd8\xff\xe0rest", "image/jpeg"),
        ("archive.zip", b"PK\x03\x04" + b"\x00" * 26, "application/zip"),
        ("data.csv", "nom;montant\nAcmé;12".encode(), "text/csv; charset=utf-8"),
    ],
)
def test_the_type_is_detected_from_the_content(name: str, data: bytes, content_type: str) -> None:
    if name == "archive.zip":
        out = io.BytesIO()
        with zipfile.ZipFile(out, "w") as archive:
            archive.writestr("a.txt", "a")
        data = out.getvalue()
    assert detect(name, data).content_type == content_type


@pytest.mark.parametrize(
    ("name", "data", "reason"),
    [
        ("vide.pdf", b"", "empty"),
        ("setup.exe", b"MZ\x90\x00binary", "unsupported_type"),
        ("faux.txt", b"text\x00with nul", "unsupported_type"),
        ("script.html", b"<script>alert(1)</script>", "unsupported_type"),
        ("casse.zip", b"PK\x03\x04broken", "unreadable"),
    ],
)
def test_other_files_are_refused(name: str, data: bytes, reason: str) -> None:
    with pytest.raises(FileRejectedError) as error:
        detect(name, data)
    assert error.value.details["reason"] == reason


def test_names_are_cleaned_and_follow_the_detected_type() -> None:
    assert clean_name("../../etc/passwd", detect("x.pdf", PDF)) == "passwd.pdf"
    assert clean_name("C:\\Users\\a\\Devis <v2>.exe", detect("x.pdf", PDF)) == "Devis _v2_.pdf"
    assert clean_name("rapport\x00\n.pdf", detect("x.pdf", PDF)) == "rapport.pdf"
    assert clean_name("...", detect("x.pdf", PDF)) == "file.pdf"


# --- Projects, tasks, dashboard (TASK-096 to TASK-098) ---------------------------------


async def test_staff_run_projects_that_clients_follow(client: AsyncClient, sign_in: SignIn) -> None:
    staff = await make_staff(sign_in, "pam")
    owner = await sign_in("olga")
    member = await sign_in("mia")
    org = await client_org(client, owner, "acme", (member, "member"))

    created = await project(client, staff, org, manager_id=staff.id, due_date="2027-03-31")
    assert created["manager"]["id"] == staff.id
    assert created["progress"] == {"done": 0, "total": 0, "percent": 0}
    for title, task_status in [
        ("Ateliers", "done"),
        ("Prototype", "in_progress"),
        ("Validation du ton", "client_review"),
    ]:
        response = await client.post(
            f"{ADMIN}/projects/{created['id']}/tasks",
            headers=staff.headers,
            json={"title": title, "status": task_status},
        )
        assert response.status_code == 201, response.text

    # The client sees the project, its progress and what waits for them.
    detail = (
        await client.get(f"{portal(org)}/projects/{created['id']}", headers=member.headers)
    ).json()
    assert [t["title"] for t in detail["tasks"]] == ["Ateliers", "Prototype", "Validation du ton"]
    assert detail["progress"] == {"done": 1, "total": 3, "percent": 33}
    assert detail["can_review"] is False
    home = (await client.get(f"{portal(org)}/dashboard", headers=member.headers)).json()
    assert home["counts"] | {"unread_notifications": 0} == {
        "active_projects": 1,
        "open_tasks": 2,
        "tasks_in_review": 1,
        "pending_deliverables": 0,
        "open_tickets": 0,
        "unread_notifications": 0,
    }
    assert home["upcoming_tasks"][0]["title"] == "Validation du ton"
    assert {n["type"] for n in await notifications(client, member)} == {
        "project_created",
        "task_client_review",
    }

    # The client comments; the project manager is told.
    task_id = detail["tasks"][2]["id"]
    commented = await client.post(
        f"{portal(org)}/comments/task/{task_id}",
        headers=member.headers,
        json={"body": "Plus chaleureux ?"},
    )
    assert commented.status_code == 201
    assert commented.json()[0]["from_staff"] is False
    assert [n["type"] for n in await notifications(client, staff)] == ["comment_added"]

    # Clients never change tasks or projects.
    assert (
        await client.patch(
            f"{ADMIN}/tasks/{task_id}", headers=owner.headers, json={"status": "done"}
        )
    ).status_code == 404
    done = await client.patch(
        f"{ADMIN}/tasks/{task_id}", headers=staff.headers, json={"status": "done"}
    )
    assert done.json()["status"] == "done"
    finished = await client.patch(
        f"{ADMIN}/projects/{created['id']}", headers=staff.headers, json={"status": "completed"}
    )
    assert finished.json()["progress"]["percent"] == 67
    assert (await client.get(f"{portal(org)}/dashboard", headers=member.headers)).json()["counts"][
        "active_projects"
    ] == 0


async def test_projects_are_for_client_organizations_and_team_members(
    client: AsyncClient, sign_in: SignIn
) -> None:
    staff = await make_staff(sign_in, "pam")
    owner = await sign_in("olga")
    org = await client_org(client, owner, "acme")
    internal = await client.post(
        f"{ADMIN}/projects",
        headers=staff.headers,
        json={"organization_id": str(INTERNAL_ORGANIZATION_ID), "name": "Interne"},
    )
    assert internal.status_code == 404
    outsider_manager = await client.post(
        f"{ADMIN}/projects",
        headers=staff.headers,
        json={"organization_id": org, "name": "Projet", "manager_id": owner.id},
    )
    assert outsider_manager.status_code == 409
    dates = await client.post(
        f"{ADMIN}/projects",
        headers=staff.headers,
        json={
            "organization_id": org,
            "name": "Projet",
            "start_date": "2027-02-01",
            "due_date": "2027-01-01",
        },
    )
    assert dates.status_code == 422
    organizations = (await client.get(f"{ADMIN}/organizations", headers=staff.headers)).json()
    assert [o["slug"] for o in organizations] == ["acme"]
    assert [p["id"] for p in (await client.get(f"{ADMIN}/team", headers=staff.headers)).json()] == [
        staff.id
    ]


async def test_portal_data_is_isolated_between_organizations(
    client: AsyncClient, sign_in: SignIn, private_storage: PrivateStorage
) -> None:
    staff = await make_staff(sign_in, "pam")
    editor = await make_staff(sign_in, "ed", role="staff_editor")
    owner = await sign_in("olga")
    rival = await sign_in("rita")
    org = await client_org(client, owner, "acme")
    other = await client_org(client, rival, "globex")
    created = await project(client, staff, org)
    item = await deliverable(client, staff, created["id"])
    ticket = await client.post(
        f"{portal(org)}/tickets",
        headers=owner.headers,
        json={"subject": "Accès", "category": "question", "message": "Comment se connecter ?"},
    )
    ticket_id = ticket.json()["id"]

    # Through the rival's own organization: nothing of Acme exists.
    base = portal(other)
    for method, url, body in [
        ("GET", f"{base}/projects/{created['id']}", None),
        ("POST", f"{base}/deliverables/{item['id']}/review", {"decision": "approved"}),
        ("GET", f"{base}/files/{item['file']['id']}/download", None),
        ("GET", f"{base}/comments/deliverable/{item['id']}", None),
        ("POST", f"{base}/comments/deliverable/{item['id']}", {"body": "x"}),
        ("GET", f"{base}/tickets/{ticket_id}", None),
        ("POST", f"{base}/tickets/{ticket_id}/messages", {"body": "x"}),
        ("POST", f"{base}/tickets/{ticket_id}/close", None),
        ("DELETE", f"{base}/documents/{item['file']['id']}", None),
    ]:
        response = await client.request(method, url, headers=rival.headers, json=body)
        assert response.status_code == 404, (method, url, response.status_code)
    assert (await client.get(f"{base}/projects", headers=rival.headers)).json()["total"] == 0
    assert (await client.get(f"{base}/tickets", headers=rival.headers)).json()["total"] == 0
    assert (await client.get(f"{base}/dashboard", headers=rival.headers)).json()["projects"] == []
    # Through Acme: not a member.
    assert (await client.get(f"{portal(org)}/dashboard", headers=rival.headers)).status_code == 404
    # The back office: staff with the right role only.
    assert (await client.get(f"{ADMIN}/projects", headers=owner.headers)).status_code == 404
    assert (await client.get(f"{ADMIN}/projects", headers=editor.headers)).status_code == 403
    # Files of two clients never share a path.
    assert all(key.startswith(f"{org}/") for key in objects(private_storage))


# --- Deliverables and documents (TASK-099, TASK-100) -----------------------------------


async def test_clients_review_deliverables_version_after_version(
    client: AsyncClient, sign_in: SignIn, private_storage: PrivateStorage
) -> None:
    staff = await make_staff(sign_in, "pam")
    owner = await sign_in("olga")
    member = await sign_in("mia")
    org = await client_org(client, owner, "acme", (member, "member"))
    created = await project(client, staff, org, manager_id=staff.id)
    item = await deliverable(client, staff, created["id"], name="../Cahier final.pdf")
    assert item["status"] == "pending_review" and item["version"] == 1
    assert item["file"]["name"] == "Cahier final.pdf"
    assert item["file"]["content_type"] == "application/pdf"
    first_key = objects(private_storage)
    review = f"{portal(org)}/deliverables/{item['id']}/review"

    # Members follow; owners and admins decide, and must explain a change request.
    assert (
        await client.post(review, headers=member.headers, json={"decision": "approved"})
    ).status_code == 403
    assert (
        await client.post(review, headers=owner.headers, json={"decision": "changes_requested"})
    ).status_code == 422
    changes = await client.post(
        review,
        headers=owner.headers,
        json={"decision": "changes_requested", "comment": "Ajouter le RGPD"},
    )
    assert changes.json()["status"] == "changes_requested"
    assert changes.json()["reviewed_by"]["id"] == owner.id
    thread = (
        await client.get(f"{portal(org)}/comments/deliverable/{item['id']}", headers=member.headers)
    ).json()
    assert [c["body"] for c in thread] == ["Ajouter le RGPD"]
    reviewed = [
        n for n in await notifications(client, staff) if n["type"] == "deliverable_reviewed"
    ]
    assert reviewed[0]["data"]["decision"] == "changes_requested"
    assert (
        await client.post(review, headers=owner.headers, json={"decision": "approved"})
    ).status_code == 409

    # A new version replaces the file and starts the review again.
    version = await client.post(
        f"{ADMIN}/deliverables/{item['id']}/versions",
        headers=staff.headers,
        files={"file": ("v2.docx", docx(), "application/pdf")},
    )
    assert version.status_code == 200, version.text
    assert (version.json()["version"], version.json()["status"]) == (2, "pending_review")
    assert version.json()["file"]["name"] == "v2.docx"
    assert version.json()["review_comment"] is None
    assert first_key[0] not in objects(private_storage) and len(objects(private_storage)) == 1
    approved = await client.post(review, headers=owner.headers, json={"decision": "approved"})
    assert approved.json()["status"] == "approved"
    again = await client.post(
        f"{ADMIN}/deliverables/{item['id']}/versions",
        headers=staff.headers,
        files={"file": ("v3.pdf", PDF, "application/pdf")},
    )
    assert again.status_code == 409

    # Downloads: a short-lived signed link, always as an attachment.
    link = (
        await client.get(
            f"{portal(org)}/files/{version.json()['file']['id']}/download", headers=member.headers
        )
    ).json()
    query = parse_qs(urlparse(link["url"]).query)
    assert link["expires_in"] == get_settings().portal_download_ttl_seconds
    assert query["response-content-disposition"][0].startswith('attachment; filename="v2.docx"')
    assert {"Signature", "X-Amz-Signature"} & query.keys()  # signed (v2 or v4 by client)

    # Deleting the project removes its files.
    assert (
        await client.delete(f"{ADMIN}/projects/{created['id']}", headers=staff.headers)
    ).status_code == 204
    assert objects(private_storage) == []


async def test_documents_are_shared_both_ways(
    client: AsyncClient,
    sign_in: SignIn,
    private_storage: PrivateStorage,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    staff = await make_staff(sign_in, "pam")
    owner = await sign_in("olga")
    member = await sign_in("mia")
    org = await client_org(client, owner, "acme", (member, "member"))
    created = await project(client, staff, org)

    def upload(actor: Actor, url: str, name: str, data: bytes, **form: str) -> Any:
        return client.post(
            url, headers=actor.headers, data=form, files={"file": (name, data, "text/plain")}
        )

    mine = await upload(
        member, f"{portal(org)}/documents", "brief.pdf", PDF, project_id=created["id"]
    )
    assert mine.status_code == 201, mine.text
    assert mine.json()["can_delete"] is True and mine.json()["uploaded_by_staff"] is False
    assert [n["type"] for n in await notifications(client, staff)] == ["document_uploaded"]
    shared = await upload(
        staff, f"{ADMIN}/organizations/{org}/documents", "charte.png", b"\x89PNG\r\n\x1a\nrest"
    )
    assert shared.status_code == 201
    assert "document_shared" in {n["type"] for n in await notifications(client, member)}

    refused = await upload(member, f"{portal(org)}/documents", "virus.exe", b"MZ\x90\x00")
    assert refused.status_code == 422
    assert refused.json()["error"]["details"]["reason"] == "unsupported_type"
    monkeypatch.setenv("PORTAL_FILE_MAX_BYTES", "2048")
    get_settings.cache_clear()
    too_large = await upload(member, f"{portal(org)}/documents", "gros.pdf", PDF + b"0" * 4096)
    assert too_large.json()["error"]["details"]["reason"] == "too_large"
    monkeypatch.delenv("PORTAL_FILE_MAX_BYTES")
    get_settings.cache_clear()
    # A project of another client cannot be targeted.
    rival = await sign_in("rita")
    other = await client_org(client, rival, "globex")
    assert (
        await upload(rival, f"{portal(other)}/documents", "a.pdf", PDF, project_id=created["id"])
    ).status_code == 404

    listing = (await client.get(f"{portal(org)}/documents", headers=owner.headers)).json()
    assert [(d["name"], d["can_delete"]) for d in listing] == [
        ("charte.png", False),
        ("brief.pdf", True),
    ]
    # Clients cannot delete what the team shared; owners can delete members' files.
    assert (
        await client.delete(f"{portal(org)}/documents/{shared.json()['id']}", headers=owner.headers)
    ).status_code == 403
    assert (
        await client.delete(f"{portal(org)}/documents/{mine.json()['id']}", headers=owner.headers)
    ).status_code == 204
    assert (
        await client.delete(f"{ADMIN}/documents/{shared.json()['id']}", headers=staff.headers)
    ).status_code == 204
    assert objects(private_storage) == []


# --- Support (TASK-101) -----------------------------------------------------------------


async def test_support_tickets_go_back_and_forth(client: AsyncClient, sign_in: SignIn) -> None:
    staff = await make_staff(sign_in, "pam")
    colleague = await make_staff(sign_in, "sam")
    owner = await sign_in("olga")
    member = await sign_in("mia")
    org = await client_org(client, owner, "acme", (member, "member"))
    invalid = await client.post(
        f"{portal(org)}/tickets",
        headers=member.headers,
        json={"subject": "?", "category": "x", "message": "court"},
    )
    assert invalid.status_code == 422
    opened = await client.post(
        f"{portal(org)}/tickets",
        headers=member.headers,
        json={
            "subject": "Erreur 500 sur l'assistant",
            "category": "incident",
            "priority": "high",
            "message": "Depuis ce matin, l'assistant répond par une erreur.",
        },
    )
    assert opened.status_code == 201, opened.text
    ticket = opened.json()
    assert ticket["number"] >= 1001 and ticket["status"] == "open"
    assert [m["from_staff"] for m in ticket["thread"]] == [False]
    # Every staff member who manages the portal is told while nobody is assigned.
    for person in (staff, colleague):
        assert [n["type"] for n in await notifications(client, person)] == ["ticket_opened"]

    url = f"{ADMIN}/tickets/{ticket['id']}"
    answered = await client.post(
        f"{url}/messages", headers=staff.headers, json={"body": "Nous regardons."}
    )
    assert (answered.json()["status"], answered.json()["assignee"]["id"]) == (
        "waiting_customer",
        staff.id,
    )
    assert answered.json()["last_from_staff"] is True
    assert "ticket_replied" in {n["type"] for n in await notifications(client, owner)}
    # The client's answer reopens it, and only the assignee is told.
    back = await client.post(
        f"{portal(org)}/tickets/{ticket['id']}/messages",
        headers=member.headers,
        json={"body": "Toujours."},
    )
    assert back.json()["status"] == "open" and len(back.json()["thread"]) == 3
    assert [n["type"] for n in await notifications(client, colleague)] == ["ticket_opened"]

    assert (
        await client.patch(url, headers=staff.headers, json={"assignee_id": owner.id})
    ).status_code == 409
    updated = await client.patch(
        url,
        headers=staff.headers,
        json={"status": "resolved", "priority": "urgent", "assignee_id": colleague.id},
    )
    assert (updated.json()["status"], updated.json()["priority"]) == ("resolved", "urgent")
    assert updated.json()["assignee"]["id"] == colleague.id
    lists = {
        state: (
            await client.get(
                f"{portal(org)}/tickets", params={"state": state}, headers=owner.headers
            )
        ).json()["total"]
        for state in ("open", "closed", "all")
    }
    assert lists == {"open": 0, "closed": 1, "all": 1}
    closed = await client.post(f"{portal(org)}/tickets/{ticket['id']}/close", headers=owner.headers)
    assert closed.json()["status"] == "closed" and closed.json()["closed_at"]
    mine = (
        await client.get(
            f"{ADMIN}/tickets", params={"state": "all", "mine": True}, headers=colleague.headers
        )
    ).json()
    assert [t["id"] for t in mine["items"]] == [ticket["id"]]
    # Staff cannot open tickets in the name of a client.
    staff_ticket = await client.post(
        f"/api/v1/organizations/{INTERNAL_ORGANIZATION_ID}/portal/tickets",
        headers=staff.headers,
        json={"subject": "Interne", "category": "other", "message": "Ceci est un test."},
    )
    assert staff_ticket.status_code == 409
    overview = (await client.get(f"{ADMIN}/dashboard", headers=staff.headers)).json()
    assert overview["open_tickets"] == 0


# --- Notifications (TASK-102) -------------------------------------------------------------


async def test_notifications_belong_to_their_recipient(
    client: AsyncClient, sign_in: SignIn
) -> None:
    staff = await make_staff(sign_in, "pam")
    owner = await sign_in("olga")
    member = await sign_in("mia")
    org = await client_org(client, owner, "acme", (member, "member"))
    await project(client, staff, org, name="Projet A")
    await project(client, staff, org, name="Projet B")

    page = (await client.get("/api/v1/me/notifications", headers=member.headers)).json()
    assert (page["total"], page["unread"]) == (2, 2)
    assert page["items"][0]["data"]["project"] == "Projet B"
    assert page["items"][0]["organization"]["slug"] == "acme"
    first = page["items"][0]["id"]
    # Nobody else can mark it read.
    assert (
        await client.post(f"/api/v1/me/notifications/{first}/read", headers=owner.headers)
    ).status_code == 404
    assert (
        await client.post(f"/api/v1/me/notifications/{first}/read", headers=member.headers)
    ).status_code == 204
    assert (await client.get("/api/v1/me/notifications/unread", headers=member.headers)).json() == {
        "unread": 1
    }
    unread = (
        await client.get(
            "/api/v1/me/notifications", params={"unread": True}, headers=member.headers
        )
    ).json()
    assert [n["data"]["project"] for n in unread["items"]] == ["Projet A"]
    assert (
        await client.post("/api/v1/me/notifications/read", headers=member.headers)
    ).status_code == 204
    assert (await client.get("/api/v1/me/notifications/unread", headers=member.headers)).json() == {
        "unread": 0
    }

    # A former member no longer sees what happens in the organization.
    assert (await client.get("/api/v1/me/notifications/unread", headers=owner.headers)).json() == {
        "unread": 2
    }
    removed = await client.delete(
        f"/api/v1/organizations/{org}/members/{member.id}", headers=owner.headers
    )
    assert removed.status_code == 204
    assert (await client.get("/api/v1/me/notifications", headers=member.headers)).json()[
        "total"
    ] == 0
