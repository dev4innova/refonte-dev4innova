"""PDF report of a diagnostic (TASK-094), generated with ReportLab (pure Python).

Standard Helvetica fonts (no font file to ship): text is reduced to the Windows-1252
character set they support. Every text is escaped: answers and the AI analysis are data.
"""

import io
import math
from typing import Literal
from xml.sax.saxutils import escape

from reportlab.graphics.shapes import Drawing, Line, Polygon, PolyLine, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.modules.diagnostic.schemas import DiagnosticResult

RED = colors.HexColor("#D90000")
BLACK = colors.HexColor("#171717")
GREY = colors.HexColor("#5C5C5C")
LIGHT = colors.HexColor("#F4F4F4")
BORDER = colors.HexColor("#E2E2E2")

HORIZONS: dict[str, dict[str, str]] = {
    "fr": {"quick_win": "Action rapide", "short_term": "3 à 6 mois", "mid_term": "6 à 12 mois"},
    "en": {"quick_win": "Quick win", "short_term": "3 to 6 months", "mid_term": "6 to 12 months"},
}

LABELS: dict[str, dict[str, str]] = {
    "fr": {
        "title": "Diagnostic de maturité IA",
        "for": "Pour {company}",
        "date": "Réalisé le {date}",
        "overall": "Score global",
        "dimensions": "Résultats par axe",
        "priorities": "Vos priorités",
        "recommendations": "Recommandations",
        "analysis": "Analyse personnalisée",
        "analysis_missing": "L'analyse personnalisée n'est pas encore disponible.",
        "footer": "DEV4INNOVA, l'intégrateur de solutions IA · Page {page}",
        "disclaimer": "Résultats établis à partir de vos réponses déclaratives. L'analyse est rédigée par une IA : vérifiez les informations importantes.",
    },
    "en": {
        "title": "AI maturity assessment",
        "for": "For {company}",
        "date": "Completed on {date}",
        "overall": "Overall score",
        "dimensions": "Results by dimension",
        "priorities": "Your priorities",
        "recommendations": "Recommendations",
        "analysis": "Personalized analysis",
        "analysis_missing": "The personalized analysis is not available yet.",
        "footer": "DEV4INNOVA, the AI solutions integrator · Page {page}",
        "disclaimer": "Results based on your self-assessment. The analysis is written by an AI: check important information.",
    },
}

_REPLACEMENTS = {
    "\u2192": "->",
    "\u2190": "<-",
    "\u2265": ">=",
    "\u2264": "<=",
    "\u2713": "-",
    "\u2022": "-",
    "\u202f": " ",
}


def _text(value: str) -> str:
    """Escaped, and limited to what the standard fonts can draw."""
    for source, target in _REPLACEMENTS.items():
        value = value.replace(source, target)
    value = value.encode("cp1252", errors="replace").decode("cp1252")
    return escape(value)


def _styles() -> dict[str, ParagraphStyle]:
    base = ParagraphStyle(
        "base", fontName="Helvetica", fontSize=10, leading=14, textColor=BLACK, alignment=TA_LEFT
    )
    return {
        "base": base,
        "muted": ParagraphStyle("muted", parent=base, textColor=GREY, fontSize=9, leading=12),
        "title": ParagraphStyle(
            "title", parent=base, fontName="Helvetica-Bold", fontSize=22, leading=27
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base,
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            spaceBefore=10,
            spaceAfter=6,
        ),
        "h3": ParagraphStyle("h3", parent=base, fontName="Helvetica-Bold", fontSize=11, leading=14),
        "score": ParagraphStyle(
            "score", parent=base, fontName="Helvetica-Bold", fontSize=34, leading=38, textColor=RED
        ),
        "level": ParagraphStyle(
            "level", parent=base, fontName="Helvetica-Bold", fontSize=13, leading=16
        ),
    }


def _radar(result: DiagnosticResult, size: float = 70 * mm) -> Drawing:
    """Radar chart of the dimension scores (0-100)."""
    drawing = Drawing(size + 60 * mm, size)
    cx, cy, radius = drawing.width / 2, size / 2, size / 2 - 8 * mm
    count = len(result.dimensions)

    def point(index: int, value: float) -> tuple[float, float]:
        angle = math.pi / 2 - 2 * math.pi * index / count
        return cx + radius * value / 100 * math.cos(angle), cy + radius * value / 100 * math.sin(
            angle
        )

    for ring in (25, 50, 75, 100):
        ring_points = [c for i in range(count) for c in point(i, ring)]
        drawing.add(PolyLine(ring_points + ring_points[:2], strokeColor=BORDER, strokeWidth=0.6))
    for index, dimension in enumerate(result.dimensions):
        x, y = point(index, 100)
        drawing.add(Line(cx, cy, x, y, strokeColor=BORDER, strokeWidth=0.6))
        lx, ly = point(index, 118)
        anchor: Literal["start", "middle", "end"] = (
            "middle" if abs(lx - cx) < 5 else ("start" if lx > cx else "end")
        )
        drawing.add(
            String(
                lx,
                ly - 3,
                _text(f"{dimension.label} ({dimension.score})"),
                fontName="Helvetica",
                fontSize=7.5,
                fillColor=BLACK,
                textAnchor=anchor,
            )
        )
    shape = [c for i, d in enumerate(result.dimensions) for c in point(i, max(d.score, 2))]
    drawing.add(
        Polygon(
            shape, fillColor=colors.Color(0.85, 0, 0, alpha=0.18), strokeColor=RED, strokeWidth=1.5
        )
    )
    return drawing


def _bars(result: DiagnosticResult, styles: dict[str, ParagraphStyle]) -> Table:
    rows = []
    for dimension in result.dimensions:
        bar = Table(
            [["", ""]],
            colWidths=[
                max(dimension.score, 1) * 0.6 * mm,
                (100 - dimension.score) * 0.6 * mm + 0.1,
            ],
            rowHeights=[3 * mm],
        )
        bar.setStyle(
            TableStyle([("BACKGROUND", (0, 0), (0, 0), RED), ("BACKGROUND", (1, 0), (1, 0), LIGHT)])
        )
        rows.append(
            [
                Paragraph(_text(dimension.label), styles["base"]),
                bar,
                Paragraph(f"<b>{dimension.score}</b>/100", styles["base"]),
            ]
        )
    table = Table(rows, colWidths=[60 * mm, 62 * mm, 20 * mm])
    table.setStyle(
        TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("BOTTOMPADDING", (0, 0), (-1, -1), 5)])
    )
    return table


def render(result: DiagnosticResult) -> bytes:
    labels = LABELS[result.locale]
    styles = _styles()
    out = io.BytesIO()

    def footer(canvas, document):  # type: ignore[no-untyped-def]
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(GREY)
        canvas.drawString(
            20 * mm,
            12 * mm,
            _text(labels["footer"].format(page=document.page)).replace("&amp;", "&"),
        )
        canvas.setStrokeColor(RED)
        canvas.setLineWidth(2)
        canvas.line(20 * mm, A4[1] - 14 * mm, 40 * mm, A4[1] - 14 * mm)
        canvas.restoreState()

    document = SimpleDocTemplate(
        out,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        title=labels["title"],
        author="DEV4INNOVA",
    )
    date = result.created_at.strftime("%d/%m/%Y" if result.locale == "fr" else "%Y-%m-%d")
    story = [
        Paragraph(
            '<font color="#171717">Dev</font><font color="#D90000">4</font><font color="#171717">Innova</font>',
            ParagraphStyle("logo", parent=styles["h3"], fontSize=16, leading=20),
        ),
        Spacer(1, 6 * mm),
        Paragraph(_text(labels["title"]), styles["title"]),
    ]
    if result.report and result.report.company:
        story.append(
            Paragraph(_text(labels["for"].format(company=result.report.company)), styles["level"])
        )
    story += [
        Paragraph(_text(labels["date"].format(date=date)), styles["muted"]),
        Spacer(1, 8 * mm),
        Table(
            [
                [
                    Paragraph(
                        f"{result.overall_score}<font size=14 color='#5C5C5C'>/100</font>",
                        styles["score"],
                    ),
                    [
                        Paragraph(_text(labels["overall"]), styles["muted"]),
                        Paragraph(_text(result.level_label), styles["level"]),
                        Paragraph(_text(result.level_description), styles["base"]),
                    ],
                ]
            ],
            colWidths=[45 * mm, 125 * mm],
            style=TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
                    ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ]
            ),
        ),
        Paragraph(_text(labels["dimensions"]), styles["h2"]),
        _radar(result),
        Spacer(1, 3 * mm),
        _bars(result, styles),
        Paragraph(_text(labels["priorities"]), styles["h2"]),
    ]
    for index, priority in enumerate(result.priorities, start=1):
        story.append(Paragraph(f"<b>{index}. {_text(priority.title)}</b>", styles["base"]))
    if result.report:
        story.append(Paragraph(_text(labels["recommendations"]), styles["h2"]))
        for recommendation in result.report.recommendations:
            story.append(
                KeepTogether(
                    [
                        Paragraph(_text(recommendation.title), styles["h3"]),
                        Paragraph(
                            _text(HORIZONS[result.locale][recommendation.horizon]), styles["muted"]
                        ),
                        Paragraph(_text(recommendation.text or ""), styles["base"]),
                        Spacer(1, 4 * mm),
                    ]
                )
            )
        story.append(Paragraph(_text(labels["analysis"]), styles["h2"]))
        analysis = result.report.ai_analysis
        if analysis:
            for block in analysis.split("\n"):
                if block.strip():
                    story.append(Paragraph(_text(block.strip()), styles["base"]))
                    story.append(Spacer(1, 1.5 * mm))
        else:
            story.append(Paragraph(_text(labels["analysis_missing"]), styles["muted"]))
    story += [Spacer(1, 8 * mm), Paragraph(_text(labels["disclaimer"]), styles["muted"])]
    document.build(story, onFirstPage=footer, onLaterPages=footer)
    return out.getvalue()
