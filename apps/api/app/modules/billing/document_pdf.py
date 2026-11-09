"""PDF of an invoice, a credit note or a quote (TASK-111, TASK-112), with the legal mentions
of French invoices: numbers, dates, seller and customer details, VAT per rate, payment terms,
late payment penalties and the fixed recovery fee for business customers."""

import io
from typing import Any

# Escapes the text written into the PDF: no XML is parsed.
from xml.sax.saxutils import escape  # nosec B406

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.modules.billing.money import euros

RED = colors.HexColor("#D90000")
BLACK = colors.HexColor("#171717")
GREY = colors.HexColor("#5C5C5C")
LIGHT = colors.HexColor("#F4F4F4")

TITLES = {"invoice": "FACTURE", "credit_note": "AVOIR", "quote": "DEVIS"}


def _t(value: Any) -> str:
    return escape(str(value or "").encode("cp1252", errors="replace").decode("cp1252"))


def _qty(value: Any) -> str:
    text = f"{float(value):g}"
    return text.replace(".", ",")


def _rate(bp: int) -> str:
    return f"{bp / 100:g} %".replace(".", ",")


def render(document: dict[str, Any]) -> bytes:
    """`document`: kind, number, title, dates, seller, customer, lines, totals, notes, extra."""
    base = ParagraphStyle("base", fontName="Helvetica", fontSize=9, leading=12, textColor=BLACK)
    small = ParagraphStyle("small", parent=base, fontSize=7.5, leading=10, textColor=GREY)
    bold = ParagraphStyle("bold", parent=base, fontName="Helvetica-Bold")
    big = ParagraphStyle("big", parent=base, fontName="Helvetica-Bold", fontSize=18, leading=22)
    out = io.BytesIO()
    doc = SimpleDocTemplate(
        out,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"{TITLES[document['kind']]} {document['number']}",
        author=document["seller"].get("name", ""),
    )
    seller, customer = document["seller"], document["customer"]
    seller_lines = [
        f"<b>{_t(seller.get('name'))}</b> {_t(seller.get('legal_form'))}",
        _t(seller.get("address")),
    ]
    if seller.get("siren"):
        seller_lines.append(f"SIREN {_t(seller['siren'])}")
    if seller.get("vat_number"):
        seller_lines.append(f"TVA {_t(seller['vat_number'])}")
    if seller.get("email"):
        seller_lines.append(_t(seller["email"]))
    customer_lines = [
        f"<b>{_t(customer.get('legal_name'))}</b>",
        _t(customer.get("address")),
        f"{_t(customer.get('postal_code'))} {_t(customer.get('city'))} {_t(customer.get('country'))}",
    ]
    if customer.get("siren"):
        customer_lines.append(f"SIREN {_t(customer['siren'])}")
    if customer.get("vat_number"):
        customer_lines.append(f"TVA {_t(customer['vat_number'])}")
    story: list[Any] = [
        Table(
            [
                [
                    Paragraph("<br/>".join(seller_lines), base),
                    Paragraph(
                        f"{TITLES[document['kind']]}<br/><font size=11>N° {_t(document['number'])}</font>",
                        big,
                    ),
                ]
            ],
            colWidths=[110 * mm, 64 * mm],
            style=TableStyle(
                [("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEABOVE", (0, 0), (0, 0), 2, RED)]
            ),
        ),
        Spacer(1, 6 * mm),
        Table(
            [
                [
                    Paragraph(
                        "<br/>".join(f"{_t(k)} : {_t(v)}" for k, v in document["dates"]), base
                    ),
                    Paragraph("<br/>".join(customer_lines), base),
                ]
            ],
            colWidths=[87 * mm, 87 * mm],
            style=TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BACKGROUND", (1, 0), (1, 0), LIGHT),
                    ("LEFTPADDING", (1, 0), (1, 0), 8),
                ]
            ),
        ),
        Spacer(1, 6 * mm),
        Paragraph(f"<b>{_t(document['title'])}</b>", base),
        Spacer(1, 3 * mm),
    ]
    rows: list[list[Any]] = [
        [Paragraph(h, bold) for h in ("Désignation", "Qté", "PU HT", "TVA", "Total HT")]
    ]
    for line in document["lines"]:
        rows.append(
            [
                Paragraph(_t(line["description"]), base),
                _qty(line["quantity"]),
                euros(line["unit_price_cents"]),
                _rate(line["vat_rate_bp"]),
                euros(line["net_cents"]),
            ]
        )
    story.append(
        Table(
            rows,
            colWidths=[84 * mm, 16 * mm, 26 * mm, 18 * mm, 30 * mm],
            repeatRows=1,
            style=TableStyle(
                [
                    ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                    ("LINEBELOW", (0, 0), (-1, 0), 0.8, BLACK),
                    ("LINEBELOW", (0, 1), (-1, -1), 0.3, colors.HexColor("#E2E2E2")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            ),
        )
    )
    totals = [["Total HT", euros(document["net_cents"])]]
    totals += [
        [f"TVA {_rate(v['vat_rate_bp'])} (base {euros(v['net_cents'])})", euros(v["vat_cents"])]
        for v in document["vat_breakdown"]
    ]
    totals += [["Total TTC", euros(document["gross_cents"])]]
    totals += document.get("extra_totals", [])
    story += [
        Spacer(1, 4 * mm),
        Table(
            totals,
            colWidths=[124 * mm, 50 * mm],
            style=TableStyle(
                [
                    ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
                    ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                    (
                        "FONTNAME",
                        (0, len(totals) - 1 - len(document.get("extra_totals", []))),
                        (-1, len(totals) - 1 - len(document.get("extra_totals", []))),
                        "Helvetica-Bold",
                    ),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                ]
            ),
        ),
    ]
    for paragraph in document.get("paragraphs", []):
        story += [Spacer(1, 3 * mm), Paragraph(_t(paragraph), base)]
    story += [Spacer(1, 6 * mm)] + [Paragraph(_t(m), small) for m in document.get("mentions", [])]
    doc.build(story)
    return out.getvalue()
