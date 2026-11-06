"""Organization isolation (TASK-045, ADR-0006).

A user who is not a member of an organization must not be able to read, change or even
detect it: every endpoint answers 404, exactly like for an organization that does not exist.
"""

import uuid
from collections.abc import Awaitable, Callable

import pytest
from httpx import AsyncClient

from tests.conftest import Actor

ORGS = "/api/v1/organizations"
SignIn = Callable[[str], Awaitable[Actor]]


@pytest.fixture
async def two_tenants(client: AsyncClient, sign_in: SignIn) -> tuple[Actor, Actor, str, str]:
    """Alice owns Acme, Mallory owns Evil Corp."""
    alice, mallory = await sign_in("alice"), await sign_in("mallory")
    acme = (
        await client.post(ORGS, headers=alice.headers, json={"name": "Acme", "slug": "acme"})
    ).json()["id"]
    evil = (
        await client.post(ORGS, headers=mallory.headers, json={"name": "Evil", "slug": "evil"})
    ).json()["id"]
    return alice, mallory, acme, evil


def _requests(org: str, member_id: str) -> list[tuple[str, str, dict[str, object] | None]]:
    return [
        ("GET", f"{ORGS}/{org}", None),
        ("PATCH", f"{ORGS}/{org}", {"name": "Pwned"}),
        ("GET", f"{ORGS}/{org}/members", None),
        ("POST", f"{ORGS}/{org}/members", {"email": "mallory@example.com", "role": "owner"}),
        ("PATCH", f"{ORGS}/{org}/members/{member_id}", {"role": "member"}),
        ("DELETE", f"{ORGS}/{org}/members/{member_id}", None),
    ]


async def test_non_members_get_404_on_every_endpoint(
    client: AsyncClient, two_tenants: tuple[Actor, Actor, str, str]
) -> None:
    alice, mallory, acme, _ = two_tenants

    for method, url, body in _requests(acme, alice.id):
        response = await client.request(method, url, headers=mallory.headers, json=body)
        assert response.status_code == 404, f"{method} {url} -> {response.status_code}"
        assert response.json()["error"]["code"] == "not_found"


async def test_foreign_and_missing_organizations_are_indistinguishable(
    client: AsyncClient, two_tenants: tuple[Actor, Actor, str, str]
) -> None:
    _, mallory, acme, _ = two_tenants

    foreign = await client.get(f"{ORGS}/{acme}", headers=mallory.headers)
    missing = await client.get(f"{ORGS}/{uuid.uuid4()}", headers=mallory.headers)

    assert foreign.status_code == missing.status_code == 404
    assert foreign.json() == missing.json()


async def test_attacks_leave_the_victim_untouched(
    client: AsyncClient, two_tenants: tuple[Actor, Actor, str, str]
) -> None:
    alice, mallory, acme, _ = two_tenants

    for method, url, body in _requests(acme, alice.id):
        await client.request(method, url, headers=mallory.headers, json=body)

    org = (await client.get(f"{ORGS}/{acme}", headers=alice.headers)).json()
    members = (await client.get(f"{ORGS}/{acme}/members", headers=alice.headers)).json()
    assert org["name"] == "Acme"
    assert [(m["email"], m["role"]) for m in members] == [("alice@example.com", "owner")]


async def test_a_member_of_one_org_cannot_reach_members_of_another(
    client: AsyncClient, two_tenants: tuple[Actor, Actor, str, str]
) -> None:
    alice, mallory, acme, evil = two_tenants

    # Mallory uses her own organization's URL to target Alice's membership.
    response = await client.patch(
        f"{ORGS}/{evil}/members/{alice.id}", headers=mallory.headers, json={"role": "member"}
    )
    assert response.status_code == 404
    org = (await client.get(f"{ORGS}/{acme}", headers=alice.headers)).json()
    assert org["role"] == "owner"


async def test_lists_never_leak_other_tenants(
    client: AsyncClient, two_tenants: tuple[Actor, Actor, str, str]
) -> None:
    alice, mallory, _, _ = two_tenants

    alice_orgs = {o["slug"] for o in (await client.get(ORGS, headers=alice.headers)).json()}
    mallory_orgs = {o["slug"] for o in (await client.get(ORGS, headers=mallory.headers)).json()}
    alice_me = (await client.get("/api/v1/me", headers=alice.headers)).json()

    assert alice_orgs == {"acme"}
    assert mallory_orgs == {"evil"}
    assert [m["organization_slug"] for m in alice_me["memberships"]] == ["acme"]
