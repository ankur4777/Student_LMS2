"""Bounded, read-only excerpts from authorized teacher-uploaded PDF files.

Call only after the student, subject, class and Documents feature have been
authorized. Never use a document ID or file path supplied by a chat client.
"""

import logging
import re

from pypdf import PdfReader

logger = logging.getLogger(__name__)

MAX_PDF_BYTES = 8 * 1024 * 1024
MAX_PDF_PAGES = 80
MAX_PAGE_CHARS = 3500
MAX_EXCERPT_CHARS = 1900
MAX_EXCERPT_PAGES = 4
MAX_MATERIAL_CHARS = 11000

_STOPWORDS = frozenset(
    """according about after also among answer based been before could
    document documents explain file files following from have into mentioned
    notes please question regarding related show some teacher that their
    these this those uploaded using what when where which with would
    meta ads pdf page pages give tell how many does your"""
    .split()
)


def _tokens(value):
    """Lightweight query/page matching, not an authorization mechanism."""
    words = re.findall(r"[a-z0-9]+", value.lower())
    return {
        word[:-1] if word.endswith("s") and len(word) > 4 else word
        for word in words
        if len(word) > 2 and word not in _STOPWORDS
    }


def _clean_text(value):
    return " ".join(value.split())


def pdf_excerpts(document, question):
    """Return relevant page excerpts, or [] for unreadable/unsupported PDFs.

    Private files are opened through their configured Django storage; no
    public URLs, subprocesses, OCR, or arbitrary upload paths are used.
    """
    if not document.file or not document.file.name.lower().endswith(".pdf"):
        return []

    try:
        if document.file.size > MAX_PDF_BYTES:
            return []
        pages = []
        with document.file.open("rb") as source:
            reader = PdfReader(source, strict=False)
            if reader.is_encrypted:
                return []
            for index in range(min(len(reader.pages), MAX_PDF_PAGES)):
                raw = reader.pages[index].extract_text() or ""
                text = _clean_text(raw)[:MAX_PAGE_CHARS]
                if text:
                    pages.append({"page": index + 1, "text": text})
    except Exception as exc:
        # A malformed PDF must not take down the student's chat.
        logger.warning("Teacher PDF extraction skipped: %s", type(exc).__name__)
        return []

    if not pages:
        return []

    query_terms = _tokens(question)
    scored = []
    for page in pages:
        page_terms = _tokens(page["text"])
        overlap = query_terms & page_terms
        score = len(overlap)
        # Prefer pages matching multiple independent words of the question.
        if score:
            scored.append((score, page))

    if scored:
        scored.sort(key=lambda item: (-item[0], item[1]["page"]))
        chosen = [page for _, page in scored[:MAX_EXCERPT_PAGES]]
    elif not query_terms:
        # "Summarize the PDF" should still have some first-page context.
        chosen = pages[:2]
    else:
        return []

    return [
        {"page": page["page"], "text": page["text"][:MAX_EXCERPT_CHARS]}
        for page in sorted(chosen, key=lambda item: item["page"])
    ]
