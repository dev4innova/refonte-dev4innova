"""Continuous numbering per series and year (invoices F, credit notes A, quotes D).

The counter row is locked (SELECT ... FOR UPDATE) until the transaction that uses the number
commits: two invoices never share a number and a rolled-back transaction leaves no gap.
"""

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.billing.models import Counter


async def next_number(session: AsyncSession, series: str, year: int) -> str:
    await session.execute(
        insert(Counter)
        .values(series=series, year=year, value=0)
        .on_conflict_do_nothing(constraint="uq_billing_counters_series_year")
    )
    counter = await session.scalar(
        select(Counter).where(Counter.series == series, Counter.year == year).with_for_update()
    )
    assert counter is not None
    counter.value += 1
    await session.flush()
    return f"{series}-{year}-{counter.value:04d}"
