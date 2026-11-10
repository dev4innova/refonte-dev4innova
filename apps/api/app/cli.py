"""Operations commands.

    uv run python -m app.cli grant-staff EMAIL ROLE
    uv run python -m app.cli reset-password EMAIL
    uv run python -m app.cli purge-ai-sessions [--days N]
    uv run python -m app.cli purge-diagnostics [--days N]
    uv run python -m app.cli daily

`daily` runs every retention purge (expired sign-in sessions included); the deployment
schedules it once a day (ADR-0018). `reset-password` prints a temporary password for an
account (ADR-0019), e.g. when the only administrator forgot theirs.

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
            raise SystemExit(f"No account with email {email}: create it on the website first.")
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


async def purge_ai_sessions(days: int | None) -> str:
    """Retention of AI sessions (TASK-087); run daily by the scheduler of the deployment."""
    from app.db.session import new_session
    from app.modules.ai_experiences.service import purge_inactive_sessions

    async with new_session() as session:
        count = await purge_inactive_sessions(session, days)
    return f"{count} inactive AI session(s) deleted"


async def purge_diagnostics(days: int) -> str:
    """Diagnostics never unlocked (no contact) are kept 30 days for statistics (EPIC 10)."""
    from app.db.session import new_session
    from app.modules.diagnostic.service import purge_anonymous

    async with new_session() as session:
        count = await purge_anonymous(session, days)
    return f"{count} anonymous diagnostic(s) deleted"


async def reset_password(email: str) -> str:
    from app.core.errors import NotFoundError
    from app.db.session import new_session
    from app.modules.identity.service import reset_password as reset

    async with new_session() as session:
        try:
            password = await reset(session, email=email)
        except NotFoundError as exc:
            raise SystemExit(f"No account with email {email}.") from exc
    return f"{email}: temporary password {password} (every session signed out)"


async def purge_auth_sessions() -> str:
    from app.db.session import new_session
    from app.modules.identity.service import purge_expired_sessions

    async with new_session() as session:
        count = await purge_expired_sessions(session)
    return f"{count} expired sign-in session(s) deleted"


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    grant = commands.add_parser("grant-staff", help="Make an existing account DEV4INNOVA staff")
    grant.add_argument("email")
    grant.add_argument("role", choices=sorted(STAFF_ROLES))
    purge = commands.add_parser("purge-ai-sessions", help="Delete inactive AI sessions")
    purge.add_argument("--days", type=int, default=None, help="Default: AI_SESSION_RETENTION_DAYS")
    diagnostics = commands.add_parser("purge-diagnostics", help="Delete old anonymous diagnostics")
    diagnostics.add_argument("--days", type=int, default=30)
    reset = commands.add_parser("reset-password", help="Print a temporary password")
    reset.add_argument("email")
    commands.add_parser("daily", help="Run the daily retention purges")
    args = parser.parse_args(argv)

    async def run() -> str:
        try:
            if args.command == "purge-ai-sessions":
                return await purge_ai_sessions(args.days)
            if args.command == "purge-diagnostics":
                return await purge_diagnostics(args.days)
            if args.command == "reset-password":
                return await reset_password(args.email)
            if args.command == "daily":
                return "\n".join(
                    [
                        await purge_ai_sessions(None),
                        await purge_diagnostics(30),
                        await purge_auth_sessions(),
                    ]
                )
            return await grant_staff(args.email, args.role)
        finally:
            await dispose_engine()

    sys.stdout.write(f"{asyncio.run(run())}\n")


if __name__ == "__main__":
    main(sys.argv[1:])
