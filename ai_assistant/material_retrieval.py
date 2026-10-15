"""Bounded, question-relevant excerpts from authorized teacher PDFs.

The caller must already validate student enrollment, college, section, subject,
document publication and the Documents feature. Never accept a client-provided
file path or document ID. Excerpts are used in one chat prompt, not persisted.
"""

import logging
import re

from pypdf import PdfReader

logger = logging.getLogger(__name__)

MAX_PDF_BYTES = 8 * 1024 * 1024
MAX_PDF_PAGES = 80
MAX_PAGE_CHARS = 3500
MAX_EXCERPT_CHARS = 950
MAX_EXCERPT_PAGES = 4

_STOPWORDS = frozenset(
    """a an and are as at be been but by can could do does done each for
    from had has have how in into is it its me my of on or our per please
    say show so than that the their then there these they this those to us
    was were what when where which who will with would you your
    according about answer based document documents explain file files
    following give mentioned note notes page pages pdf question regarding
    related some teacher uploaded using meta ads material materials"""
    .split()
)


def _normalized_words(value):
    """Normalize search words while ignoring question scaffolding."""
    result = []
    for word in re.findall(r"[a-z0-9]+", value.lower()):
        if word in _STOPWORDS or len(word) < 3:
            continue
        if word.endswith("ing") and len(word) > 6:
            word = word[:-3]  # learning -> learn, exiting -> exit
        elif word.endswith("s") and len(word) > 4:
            word = word[:-1]  # conversions -> conversion
        result.append(word)
    return result


def _relevance(words, query_words):
    """Reward overlapping topic words and word pairs."""
    matched = set(query_words).intersection(words)
    if not matched:
        return 0
    query_pairs = set(zip(query_words, query_words[1:]))
    passage_pairs = set(zip(words, words[1:]))
    return 3 * len(matched) + 4 * len(query_pairs.intersection(passage_pairs))


def excerpt_relevance(question, excerpt):
    """Used by the provider to avoid presenting unrelated excerpts as facts."""
    return _relevance(_normalized_words(excerpt), _normalized_words(question))


def _focused_text(full_text, query_words):
    """Find a relevant window anywhere on a page, not just its beginning."""
    if len(full_text) <= MAX_EXCERPT_CHARS:
        return full_text

    size = MAX_EXCERPT_CHARS
    starts = {0, len(full_text) - size}
    for word in set(query_words):
        for match in re.finditer(r"\b" + re.escape(word) + r"\w*", full_text, re.I):
            starts.add(min(len(full_text) - size, max(0, match.start() - size // 2)))

    scored = []
    for start in starts:
        chunk = full_text[start:start + size]
        scored.append((_relevance(_normalized_words(chunk), query_words), start, chunk))
    # On ties prefer later evidence rather than always the page header.
    _, start, chunk = max(scored, key=lambda item: (item[0], item[1]))
    if start:
        first_space = chunk.find(" ")
        if 0 <= first_space < 35:
            chunk = chunk[first_space + 1:]
    if start + size < len(full_text):
        last_space = chunk.rfind(" ")
        if last_space > len(chunk) - 35:
            chunk = chunk[:last_space]
    return chunk


def pdf_excerpts(document, question):
    """Retrieve ranked PDF excerpts with actual 1-based page references.

    Open files only through the private Django file storage. Never call OCR,
    external APIs, or subprocesses. Skip encrypted, large or unreadable files.
    """
    if not document.file or not document.file.name.lower().endswith(".pdf"):
        return []

    query_words = _normalized_words(question)
    summarize = bool(re.search(r"\b(summarize|summary|overview)\b", question.lower()))
    pages = []
    first_pages = []
    try:
        if document.file.size > MAX_PDF_BYTES:
            return []
        with document.file.open("rb") as source:
            reader = PdfReader(source, strict=False)
            if reader.is_encrypted:
                return []
            for index in range(min(len(reader.pages), MAX_PDF_PAGES)):
                raw = reader.pages[index].extract_text() or ""
                text = " ".join(raw.split())[:MAX_PAGE_CHARS]
                if not text:
                    continue
                if len(first_pages) < 2:
                    first_pages.append({"page": index + 1, "text": text, "relevance": 0})
                words = _normalized_words(text)
                relevance = _relevance(words, query_words)
                # Require at least two different topic words for longer queries,
                # so an agenda page mentioning "Ad Set" cannot override a
                # direct match to "learning phase ... conversions per week".
                if relevance and len(set(words).intersection(query_words)) >= min(
                    2, len(set(query_words))
                ):
                    pages.append({
                        "page": index + 1, "text": text, "relevance": relevance
                    })
    except Exception as exc:
        logger.warning("Teacher PDF extraction skipped: %s", type(exc).__name__)
        return []

    if pages:
        pages.sort(key=lambda p: (-p["relevance"], p["page"]))
        min_score = max(3, int(pages[0]["relevance"] * 0.55))
        pages = [p for p in pages if p["relevance"] >= min_score]
    elif summarize:
        pages = first_pages
    else:
        return []

    # Preserve relevance order: the previous page-number sort put page 3's
    # agenda ahead of the actual answer on page 13.
    return [
        {
            "page": page["page"],
            "text": _focused_text(page["text"], query_words),
            "relevance": page["relevance"],
        }
        for page in pages[:MAX_EXCERPT_PAGES]
    ]
