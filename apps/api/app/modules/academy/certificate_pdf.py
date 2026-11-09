"""PDF certificate (TASK-109): A4 landscape, standard fonts, verification code and link."""

import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas

from app.modules.academy.schemas import CertificateOut

RED = colors.HexColor("#D90000")
BLACK = colors.HexColor("#171717")
GREY = colors.HexColor("#5C5C5C")

LABELS = {
    "fr": {
        "title": "Certificat de réussite",
        "certifies": "DEV4INNOVA Academy certifie que",
        "completed": "a suivi avec succès la formation",
        "duration": "Durée indicative : {hours}",
        "date": "Délivré le {date}",
        "verify": "Vérifier ce certificat : {url}",
        "code": "Code : {code}",
        "revoked": "CERTIFICAT RÉVOQUÉ",
    },
    "en": {
        "title": "Certificate of completion",
        "certifies": "DEV4INNOVA Academy certifies that",
        "completed": "has successfully completed the course",
        "duration": "Indicative duration: {hours}",
        "date": "Issued on {date}",
        "verify": "Verify this certificate: {url}",
        "code": "Code: {code}",
        "revoked": "REVOKED CERTIFICATE",
    },
}


def _safe(value: str) -> str:
    return value.encode("cp1252", errors="replace").decode("cp1252")


def _hours(minutes: int, locale: str) -> str:
    if minutes < 60:
        return f"{minutes} min"
    hours = minutes / 60
    shown = f"{hours:.1f}".rstrip("0").rstrip(".")
    return f"{shown.replace('.', ',') if locale == 'fr' else shown} h"


def _fit(canvas: Canvas, value: str, font: str, size: float, width: float) -> float:
    while size > 10 and canvas.stringWidth(value, font, size) > width:
        size -= 1
    return size


def render(certificate: CertificateOut, locale: str, verify_url: str) -> bytes:
    labels = LABELS["en" if locale == "en" else "fr"]
    out = io.BytesIO()
    width, height = landscape(A4)
    canvas = Canvas(out, pagesize=(width, height))
    canvas.setTitle(_safe(f"{labels['title']} - {certificate.course_title}"))
    canvas.setAuthor("DEV4INNOVA Academy")

    canvas.setStrokeColor(BLACK)
    canvas.setLineWidth(1)
    canvas.rect(12 * mm, 12 * mm, width - 24 * mm, height - 24 * mm)
    canvas.setStrokeColor(RED)
    canvas.setLineWidth(3)
    canvas.line(width / 2 - 20 * mm, height - 30 * mm, width / 2 + 20 * mm, height - 30 * mm)

    center = width / 2
    canvas.setFont("Helvetica-Bold", 18)
    logo = [("Dev", BLACK), ("4", RED), ("Innova", BLACK)]
    total = sum(canvas.stringWidth(part, "Helvetica-Bold", 18) for part, _ in logo)
    x = center - total / 2
    for part, color in logo:
        canvas.setFillColor(color)
        canvas.drawString(x, height - 25 * mm, part)
        x += canvas.stringWidth(part, "Helvetica-Bold", 18)

    canvas.setFillColor(BLACK)
    canvas.setFont("Helvetica-Bold", 30)
    canvas.drawCentredString(center, height - 52 * mm, _safe(labels["title"]))
    canvas.setFont("Helvetica", 13)
    canvas.setFillColor(GREY)
    canvas.drawCentredString(center, height - 70 * mm, _safe(labels["certifies"]))
    name = _safe(certificate.learner_name)
    size = _fit(canvas, name, "Helvetica-Bold", 28, width - 60 * mm)
    canvas.setFillColor(BLACK)
    canvas.setFont("Helvetica-Bold", size)
    canvas.drawCentredString(center, height - 86 * mm, name)
    canvas.setFont("Helvetica", 13)
    canvas.setFillColor(GREY)
    canvas.drawCentredString(center, height - 102 * mm, _safe(labels["completed"]))
    course = _safe(certificate.course_title)
    size = _fit(canvas, course, "Helvetica-Bold", 22, width - 60 * mm)
    canvas.setFillColor(RED)
    canvas.setFont("Helvetica-Bold", size)
    canvas.drawCentredString(center, height - 117 * mm, course)

    date = certificate.issued_at.strftime("%d/%m/%Y" if locale == "fr" else "%Y-%m-%d")
    canvas.setFillColor(BLACK)
    canvas.setFont("Helvetica", 11)
    lines = [labels["date"].format(date=date)]
    if certificate.duration_minutes:
        lines.append(labels["duration"].format(hours=_hours(certificate.duration_minutes, locale)))
    for i, line in enumerate(lines):
        canvas.drawCentredString(center, height - (135 + 7 * i) * mm, _safe(line))

    canvas.setFont("Helvetica", 9)
    canvas.setFillColor(GREY)
    canvas.drawCentredString(center, 26 * mm, _safe(labels["code"].format(code=certificate.code)))
    canvas.drawCentredString(center, 20 * mm, _safe(labels["verify"].format(url=verify_url)))

    if not certificate.valid:
        canvas.saveState()
        canvas.setFillColor(RED)
        canvas.setFont("Helvetica-Bold", 40)
        canvas.translate(center, height / 2)
        canvas.rotate(20)
        canvas.drawCentredString(0, 0, _safe(labels["revoked"]))
        canvas.restoreState()

    canvas.showPage()
    canvas.save()
    return out.getvalue()
