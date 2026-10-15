"""Cite only evidence checked against authorized teacher-PDF excerpts.

Document titles and pages come from the server's permission-filtered materials,
not the model's free-text citation. Never treat a keyword overlap alone as proof
that an answer is supported by a PDF.
"""

import re

from .material_retrieval import _normalized_words, excerpt_relevance

_DOCUMENT_QUESTION = re.compile(
    r"\b(pdf|uploaded|document|notes|material|slides|handout)\b", re.I
)
_NUMBER = re.compile(r"(?<![\w.])\d+(?:[.,]\d+)?(?!\w)")
_MODEL_PAGE = re.compile(r"\b(?:page|p\.)\s*\d+\b", re.I)
_UNVERIFIABLE = re.compile(
    r"\b(?:can't|cannot|couldn't|unable to|don't know|not available|"
    r"not provided|not in the|no information|not mentioned)\b", re.I
)


def is_document_question(question):
    """True when the student explicitly asks about uploaded teaching materials."""
    return bool(_DOCUMENT_QUESTION.search(question))


def _answer_without_citation(answer):
    """Do not allow a model-authored page number to count as a factual answer."""
    return _MODEL_PAGE.sub("", answer)


def _numeric_support(question, answer, excerpt):
    """Match stated answer numbers against question-relevant local source text."""
    numbers = _NUMBER.findall(_answer_without_citation(answer))
    if not numbers:
        return 0

    scores = []
    for number in numbers:
        candidates = []
        for match in _NUMBER.finditer(excerpt):
            if match.group().replace(",", "") != number.replace(",", ""):
                continue
            before = excerpt[max(0, match.start() - 110):match.start()]
            last_sentence = max(
                before.rfind(". "), before.rfind("! "), before.rfind("? ")
            )
            if last_sentence != -1:
                before = before[last_sentence + 2:]
            after = excerpt[match.end():match.end() + 130]
            ends = [
                offset for offset in (after.find(". "), after.find("! "), after.find("? "))
                if offset >= 0
            ]
            if ends:
                after = after[:min(ends) + 1]
            evidence = before + match.group() + after
            score = excerpt_relevance(question, evidence)
            if score >= 6:
                candidates.append(score)
        if not candidates:
            return 0
        scores.append(max(candidates))
    return min(scores)


def _text_support(question, answer, excerpt):
    """Require multiple non-question answer terms present in the source excerpt."""
    query_words = set(_normalized_words(question))
    words = set(_normalized_words(_answer_without_citation(answer)))
    # For names and formulae, the meaningful *new* answer words must appear in
    # the source; generic preambles like "According to the PDF" are ignored.
    informative = words - query_words - {
        "source", "state", "states", "answer", "mentioned", "according",
        "page", "provided", "document", "teacher", "pdf", "uploaded",
        "material", "note", "say", "information",
    }
    if len(informative) < 2:
        return 0
    available = set(_normalized_words(excerpt))
    matched = informative & available
    if len(matched) < 2 or len(matched) / len(informative) < 0.8:
        return 0
    return 3 * len(matched)


def verified_source_for_answer(question, answer, data):
    """Return (title, page) only for source-supported answers, else None.

    Existing study_materials were restricted to a student-authorized section
    and subject before they were provided to the model. Never query storage
    independently or read arbitrary client-supplied URLs here.
    """
    if not is_document_question(question) or not isinstance(data, dict):
        return None
    if _UNVERIFIABLE.search(answer):
        return None

    candidates = []
    for material in data.get("study_materials", []):
        if not isinstance(material, dict):
            continue
        title = material.get("title")
        if not isinstance(title, str) or not title.strip():
            continue
        for excerpt in material.get("excerpts", []):
            if not isinstance(excerpt, dict):
                continue
            text = excerpt.get("text")
            page = excerpt.get("page")
            if not isinstance(text, str) or not text or type(page) is not int or page < 1:
                continue
            relevance = excerpt_relevance(question, text)
            if relevance < 6:
                continue
            numeric = _numeric_support(question, answer, text)
            if _NUMBER.search(_answer_without_citation(answer)):
                support = numeric
            else:
                support = _text_support(question, answer, text)
            if support:
                candidates.append((support, relevance, title, page))
    if not candidates:
        return None

    # Use strongest evidence first; tie-break by the original relevance ranking.
    _, _, title, page = max(candidates, key=lambda row: (row[0], row[1]))
    return (" ".join(title.split())[:150], page)


def cite_document_answer(answer, question, data):
    """Append a verified source, or clearly state that PDF support is missing.

    Only applies to explicitly document-referential tutor questions. Ordinary
    subject explanations and Dashboard responses are unaffected.
    """
    if not is_document_question(question):
        return answer
    if _UNVERIFIABLE.search(answer):
        return answer

    source = verified_source_for_answer(question, answer, data)
    if source is None:
        return (
            "I couldn't verify that answer from the available excerpts of "
            "your uploaded PDF. Please ask about a specific topic or page."
        )

    title, page = source
    # Remove untrusted model-authored page citations and replace with the
    # server-verified page. Keep the model's actual academic answer.
    clean = re.sub(r"\s*\(\s*(?:page|p\.)\s*\d+\s*\)", "", answer, flags=re.I)
    clean = re.sub(
        r"\s*(?:\n|^)\s*(?:source|citation)\s*:\s*[^\n]+$",
        "", clean, flags=re.I,
    ).strip()
    return f"{clean}\n\nSource: {title} (page {page})."
