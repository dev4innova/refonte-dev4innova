"""Operations commands. Usage: uv run python -m app.cli grant-staff EMAIL ROLE

Staff roles are never granted through the API (TASK-043): an operator with database
access grants the first ones here, e.g. the first back-office administrator.
"""

import argparse
import asyncio
import sys

from sqlalchemy import select

from app.db.session import dispose_engine, get_engine
from app.modules.identity.models import INTERNAL_ORGANIZATION_ID, Membership, User
from app.modules.identity.permissions import STAFF_ROLES


async def grant_staff(email: str, role: str) -> str:
    from sqlalchemy.ext.asyncio import AsyncSession

    async with AsyncSession(get_engine(), expire_on_commit=False) as session:
        user = await session.scalar(select(User).where(User.email == email.lower()))
        if user is None:
            raise SystemExit(f"No user with email {email}: they must sign in once first.")
        membership = await session.scalar(
            select(Membership).where(
                Membership.organization_id == INTERNAL_ORGANIZATION_ID,
                Membership.user_id == user.id,
            )
        )
        if membership is None:
            session.add(
                Membership(organization_id=INTERNAL_ORGANIZATION_ID, user_id=user.id, role=role)
            )
            action = "granted"
        else:
            membership.role = role
            action = "updated to"
        await session.commit()
    return f"{email}: {action} {role}"


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    grant = commands.add_parser("grant-staff", help="Make a signed-in user DEV4INNOVA staff")
    grant.add_argument("email")
    grant.add_argument("role", choices=sorted(STAFF_ROLES))
    args = parser.parse_args(argv)

    async def run() -> str:
        try:
            return await grant_staff(args.email, args.role)
        finally:
            await dispose_engine()

    sys.stdout.write(f"{asyncio.run(run())}\n")


if __name__ == "__main__":
    main(sys.argv[1:])
