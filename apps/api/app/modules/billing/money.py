"""Amounts: integer cents, VAT per line rounded half up (French practice), totals summed."""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal


@dataclass(frozen=True)
class LineAmounts:
    net_cents: int
    vat_cents: int


def _round(value: Decimal) -> int:
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def line_amounts(quantity: Decimal, unit_price_cents: int, vat_rate_bp: int) -> LineAmounts:
    net = _round(quantity * unit_price_cents)
    vat = _round(Decimal(net) * vat_rate_bp / 10_000)
    return LineAmounts(net, vat)


def share(total_cents: int, percent: int) -> int:
    """A percentage of an amount (deposit), rounded half up."""
    return _round(Decimal(total_cents) * percent / 100)


def euros(cents: int) -> str:
    """1 234,56 € (French format, used in PDFs)."""
    sign = "-" if cents < 0 else ""
    whole, rest = divmod(abs(cents), 100)
    # No-break space: the narrow one (U+202F) is missing from the standard PDF fonts.
    grouped = f"{whole:,}".replace(",", "\u00a0")
    return f"{sign}{grouped},{rest:02d} €"
