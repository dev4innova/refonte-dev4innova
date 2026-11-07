"""Text extraction for the document analyzer (TASK-084).

The file is read in memory and never stored. The type is detected from the content (not
the name or the declared type). Documents longer than the limit are refused, never
truncated: an analysis of half a document would be silently wrong.
"""

import io
import zipfile
from dataclasses import dataclass

from docx import Document as DocxDocument
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from app.core.config import get_settings
from app.core.errors import AppError


class DocumentError(AppError):
    status_code = 422
    code = "document_invalid"


@dataclass(frozen=True)
class ExtractedDocument:
    text: str
    kind: str


def _detect(data: bytes) -> str:
    if data.startswith(b"%PDF-"):
        return "pdf"
    if data.startswith(b"PK"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                if "word/document.xml" in archive.namelist():
                    return "docx"
        except zipfile.BadZipFile:
            pass
        return "unknown"
    if b"\x00" not in data[:8192]:
        return "text"
    return "unknown"


def _pdf_text(data: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise DocumentError("Encrypted PDF files cannot be read", {"reason": "encrypted"})
        return "\n\n".join((page.extract_text() or "").strip() for page in reader.pages)
    except (PdfReadError, ValueError, KeyError) as error:
        raise DocumentError("This PDF file cannot be read", {"reason": "unreadable"}) from error


def _docx_text(data: bytes) -> str:
    try:
        document = DocxDocument(io.BytesIO(data))
    except Exception as error:  # python-docx raises various low-level errors
        raise DocumentError("This Word file cannot be read", {"reason": "unreadable"}) from error
    parts = [p.text for p in document.paragraphs if p.text.strip()]
    for table in document.tables:
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells]
            if any(cells):
                parts.append(" | ".join(cells))
    return "\n".join(parts)


def _plain_text(data: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise DocumentError("Unsupported text encoding", {"reason": "unreadable"})


def extract_text(data: bytes) -> ExtractedDocument:
    """Runs in a worker thread (parsing is CPU-bound)."""
    settings = get_settings()
    if len(data) > settings.ai_document_max_bytes:
        raise DocumentError(
            "This file is too large",
            {"reason": "too_large", "max_bytes": settings.ai_document_max_bytes},
        )
    kind = _detect(data)
    if kind == "pdf":
        text = _pdf_text(data)
    elif kind == "docx":
        text = _docx_text(data)
    elif kind == "text":
        text = _plain_text(data)
    else:
        raise DocumentError("Use a PDF, Word (.docx) or text file", {"reason": "type"})
    text = "\n".join(line.rstrip() for line in text.replace("\r\n", "\n").split("\n")).strip()
    if not text:
        # e.g. a scanned PDF without text layer
        raise DocumentError("No text found in this document", {"reason": "empty"})
    if len(text) > settings.ai_document_max_chars:
        raise DocumentError(
            "This document is too long to be analyzed",
            {"reason": "too_long", "chars": len(text), "max_chars": settings.ai_document_max_chars},
        )
    return ExtractedDocument(text=text, kind=kind)
