"""Organizations (TASK-041), memberships (TASK-042) and roles (TASK-043)."""

from collections.abc import Awaitable, Callable

from httpx import AsyncClient

from tests.conftest import Actor

ORGS = "/api/v1/organizations"
SignIn = Callable[[str], Awaitable[Actor]]


async def create_org(client: AsyncClient, owner: Actor, slug: str = "acme") -> str:
    response = await client.post(ORGS, headers=owner.headers, json={"name": "Acme", "slug": slug})
    assert response.status_code == 201, response.text
    return str(response.json()["id"])


async def add(client: AsyncClient, org_id: str, actor: Actor, who: Actor, role: str) -> int:
    response = await client.post(
        f"{ORGS}/{org_id}/members", headers=actor.headers, json={"email": who.email, "role": role}
    )
    return response.status_code


async def test_creator_becomes_owner(client: AsyncClient, sign_in: SignIn) -> None:
    alice = await sign_in("alice")

    response = await client.post(ORGS, headers=alice.headers, json={"name": "Acme", "slug": "acme"})

    assert response.status_code == 201
    body = response.json()
    assert body["role"] == "owner"
    assert body["kind"] == "client"
    assert "members:manage" in body["permissions"]

    me = (await client.get("/api/v1/me", headers=alice.headers)).json()
    assert [m["organization_slug"] for m in me["memberships"]] == ["acme"]


async def test_slug_must_be_unique_and_well_formed(client: AsyncClient, sign_in: SignIn) -> None:
    alice = await sign_in("alice")
    await create_org(client, alice)

    duplicate = await client.post(
        ORGS, headers=alice.headers, json={"name": "Other", "slug": "acme"}
    )
    invalid = await client.post(
        ORGS, headers=alice.headers, json={"name": "Other", "slug": "Acme Inc"}
    )

    assert duplicate.status_code == 409
    assert invalid.status_code == 422


async def test_lists_only_my_organizations(client: AsyncClient, sign_in: SignIn) -> None:
    alice, bob = await sign_in("alice"), await sign_in("bob")
    await create_org(client, alice, "acme")
    await create_org(client, bob, "globex")

    response = await client.get(ORGS, headers=alice.headers)

    assert [o["slug"] for o in response.json()] == ["acme"]


async def test_owner_renames_and_manages_members(client: AsyncClient, sign_in: SignIn) -> None:
    alice, bob = await sign_in("alice"), await sign_in("bob")
    org = await create_org(client, alice)

    renamed = await client.patch(f"{ORGS}/{org}", headers=alice.headers, json={"name": "Acme SA"})
    assert renamed.json()["name"] == "Acme SA"

    assert await add(client, org, alice, bob, "member") == 201
    assert await add(client, org, alice, bob, "member") == 409  # already a member

    members = (await client.get(f"{ORGS}/{org}/members", headers=alice.headers)).json()
    assert {(m["email"], m["role"]) for m in members} == {
        ("alice@example.com", "owner"),
        ("bob@example.com", "member"),
    }

    promoted = await client.patch(
        f"{ORGS}/{org}/members/{bob.id}", headers=alice.headers, json={"role": "admin"}
    )
    assert promoted.json()["role"] == "admin"

    removed = await client.delete(f"{ORGS}/{org}/members/{bob.id}", headers=alice.headers)
    assert removed.status_code == 204


async def test_unknown_email_cannot_be_added(client: AsyncClient, sign_in: SignIn) -> None:
    alice = await sign_in("alice")
    org = await create_org(client, alice)

    response = await client.post(
        f"{ORGS}/{org}/members", headers=alice.headers, json={"email": "nobody@example.com"}
    )
    assert response.status_code == 404


async def test_members_can_read_but_not_manage(client: AsyncClient, sign_in: SignIn) -> None:
    alice, bob, carol = await sign_in("alice"), await sign_in("bob"), await sign_in("carol")
    org = await create_org(client, alice)
    await add(client, org, alice, bob, "member")

    assert (await client.get(f"{ORGS}/{org}", headers=bob.headers)).json()["role"] == "member"
    assert (await client.get(f"{ORGS}/{org}/members", headers=bob.headers)).status_code == 200
    assert (
        await client.patch(f"{ORGS}/{org}", headers=bob.headers, json={"name": "Hacked"})
    ).status_code == 403
    assert await add(client, org, bob, carol, "member") == 403


async def test_admins_cannot_touch_owners(client: AsyncClient, sign_in: SignIn) -> None:
    alice, bob, carol = await sign_in("alice"), await sign_in("bob"), await sign_in("carol")
    org = await create_org(client, alice)
    await add(client, org, alice, bob, "admin")

    assert await add(client, org, bob, carol, "member") == 201
    assert await add(client, org, bob, carol, "owner") in (403, 409)
    demote_owner = await client.patch(
        f"{ORGS}/{org}/members/{alice.id}", headers=bob.headers, json={"role": "member"}
    )
    remove_owner = await client.delete(f"{ORGS}/{org}/members/{alice.id}", headers=bob.headers)
    self_promote = await client.patch(
        f"{ORGS}/{org}/members/{bob.id}", headers=bob.headers, json={"role": "owner"}
    )

    assert demote_owner.status_code == 403
    assert remove_owner.status_code == 403
    assert self_promote.status_code == 403


async def test_staff_roles_cannot_be_granted_through_the_api(
    client: AsyncClient, sign_in: SignIn
) -> None:
    alice, bob = await sign_in("alice"), await sign_in("bob")
    org = await create_org(client, alice)

    response = await client.post(
        f"{ORGS}/{org}/members",
        headers=alice.headers,
        json={"email": bob.email, "role": "staff_admin"},
    )
    assert response.status_code == 422


async def test_organization_keeps_at_least_one_owner(client: AsyncClient, sign_in: SignIn) -> None:
    alice, bob = await sign_in("alice"), await sign_in("bob")
    org = await create_org(client, alice)

    leave = await client.delete(f"{ORGS}/{org}/members/{alice.id}", headers=alice.headers)
    demote = await client.patch(
        f"{ORGS}/{org}/members/{alice.id}", headers=alice.headers, json={"role": "admin"}
    )
    assert leave.status_code == 409
    assert demote.status_code == 409

    # With a second owner, the first one may leave.
    assert await add(client, org, alice, bob, "owner") == 201
    assert (
        await client.delete(f"{ORGS}/{org}/members/{alice.id}", headers=alice.headers)
    ).status_code == 204


async def test_a_member_can_leave(client: AsyncClient, sign_in: SignIn) -> None:
    alice, bob = await sign_in("alice"), await sign_in("bob")
    org = await create_org(client, alice)
    await add(client, org, alice, bob, "member")

    response = await client.delete(f"{ORGS}/{org}/members/{bob.id}", headers=bob.headers)

    assert response.status_code == 204
    assert (await client.get(f"{ORGS}/{org}", headers=bob.headers)).status_code == 404
