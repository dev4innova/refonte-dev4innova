"""Checks of the files shared in the portal (TASK-099, TASK-100).

The type is detected from the content, never from the declared type: only documents,
spreadsheets, presentations, images, archives and plain text are accepted. The stored
name keeps the original one, cleaned, with the extension of the detected type.
"""

import io
import re
import unicodedata
import zipfile
from dataclasses import dataclass

from app.core.errors import AppError


class FileRejectedError(AppError):
    status_code = 422
    code = "file_rejected"


@dataclass(frozen=True)
class FileType:
    content_type: str
    extension: str


PDF = FileType("application/pdf", "pdf")
DOCX = FileType("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx")
XLSX = FileType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx")
PPTX = FileType("application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx")
ZIP = FileType("application/zip", "zip")
PNG = FileType("image/png", "png")
JPEG = FileType("image/jpeg", "jpg")
WEBP = FileType("image/webp", "webp")
TEXT_TYPES = {
    "txt": FileType("text/plain; charset=utf-8", "txt"),
    "md": FileType("text/markdown; charset=utf-8", "md"),
    "csv": FileType("text/csv; charset=utf-8", "csv"),
}
_OFFICE = {"word/document.xml": DOCX, "xl/workbook.xml": XLSX, "ppt/presentation.xml": PPTX}
_EXTENSION_ALIASES = {"jpeg": "jpg"}


def _extension(name: str) -> str:
    _, dot, extension = name.rpartition(".")
    extension = extension.lower() if dot else ""
    return _EXTENSION_ALIASES.get(extension, extension)


def detect(name: str, data: bytes) -> FileType:
    if not data:
        raise FileRejectedError("The file is empty", {"reason": "empty"})
    if data.startswith(b"%PDF-"):
        return PDF
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return PNG
    if data.startswith(b"\xff\xd8\xff"):
        return JPEG
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return WEBP
    if data.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                names = set(archive.namelist())
        except zipfile.BadZipFile as error:
            raise FileRejectedError("This archive is damaged", {"reason": "unreadable"}) from error
        for marker, file_type in _OFFICE.items():
            if marker in names:
                return file_type
        return ZIP
    extension = _extension(name)
    if extension in TEXT_TYPES and b"\x00" not in data:
        try:
            data.decode("utf-8")
        except UnicodeDecodeError:
            pass
        else:
            return TEXT_TYPES[extension]
    raise FileRejectedError(
        "Accepted files: PDF, Word, Excel, PowerPoint, images (PNG, JPEG, WebP), ZIP or text",
        {"reason": "unsupported_type"},
    )


def clean_name(name: str, file_type: FileType) -> str:
    """Name without path, control characters or reserved characters, at most 150 characters,
    ending with the extension of the detected type."""
    name = unicodedata.normalize("NFC", name.replace("\\", "/").rsplit("/", 1)[-1])
    name = "".join(c for c in name if unicodedata.category(c)[0] != "C")
    name = re.sub(r'[<>:"|?*]+', "_", name).strip(" .")
    stem = name.rsplit(".", 1)[0] if "." in name else name
    stem = stem.strip(" .")[:140] or "file"
    return f"{stem}.{file_type.extension}"
