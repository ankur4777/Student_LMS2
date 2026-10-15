"""Short, source-grounded answers for teacher PDF questions.

The input is the request's already-authorized, bounded study_materials data.
This module never reads files, queries the database, or trusts model-provided
page numbers. Its fallback quotes only relevant extracted evidence.
"""

import re

from .material_retrieval import excerpt_relevance
from .source_citations import is_document_question, verified_source_for_answer

_ROLES = re.compile(r"\b(presenter|facilitator)\s*:\s*", re.I)
_NUMBER = re.compile(r"(?<![\w.])\d+(?:[.,]\d+)?(?!\w)")
_QUANTITY_QUESTION = re.compile(r"\b(how many|how much|number of)\b", re.I)
_FORMULA_QUESTION = re.compile(r"\b(formula|equation|calculate|calculation)\b", re.I)
_SOURCE_TERMINATOR = re.compile(r"(?<=[.!?])\s+")


def _source_candidates(question, data):
    """Relevant excerpts only; preserve the publisher-provided title/page."""
    if not is_document_question(question) or not isinstance(data, dict):
        return []
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
            page, text = excerpt.get("page"), excerpt.get("text")
            if type(page) is not int or page < 1 or not isinstance(text, str):
                continue
            relevance = excerpt_relevance(question, text)
            if relevance >= 6 and text.strip():
                candidates.append(
                    (relevance, " ".join(title.split())[:150], page, text.strip())
                )
    # Do not prefer the earliest page or the first uploaded document over a
    # better topical match. No new material access happens here.
    return sorted(candidates, key=lambda item: item[0], reverse=True)


def _role_fields(question, source):
    """Only return presenter/facilitator fields actually labelled in the PDF."""
    wants = [
        role for role in ("presenter", "facilitator")
        if re.search(r"\b" + role + r"\b", question, re.I)
    ]
    if not wants:
        return None
    markers = list(_ROLES.finditer(source))
    fields = {}
    for index, marker in enumerate(markers):
        role = marker.group(1).lower()
        stop = markers[index + 1].start() if index + 1 < len(markers) else len(source)
        value = " ".join(source[marker.end():stop].strip(" \t.;:-").split())
        if value:
            # The complete role label plus job description should fit on one
            # line; do not emit the rest of the page.
            fields[role] = value[:110].strip(" ,;")
    if not all(role in fields for role in wants):
        return None
    return "\n".join(f"{role.capitalize()}: {fields[role]}" for role in wants)


def _sentence_for_number(source, match):
    """Keep the local sentence and never let a preceding numeric fact intrude."""
    before = source[:match.start()]
    boundary = max(
        before.rfind(". "), before.rfind("! "), before.rfind("? "),
        before.rfind("; "),
    )
    start = boundary + 2 if boundary >= 0 else max(0, match.start() - 110)
    after = source[match.end():]
    ends = [
        index for index in (
            after.find(". "), after.find("! "), after.find("? "),
            after.find("; "),
        ) if index >= 0
    ]
    end = match.end() + min(ends) + 1 if ends else min(len(source), match.end() + 135)
    return source[start:end].strip()


def _quantity_phrase(question, source):
    """Return only a well-matched number and its nearby unit/context."""
    if not _QUANTITY_QUESTION.search(question):
        return None
    choices = []
    for match in _NUMBER.finditer(source):
        sentence = _sentence_for_number(source, match)
        score = excerpt_relevance(question, sentence)
        if score < 6:
            continue
        # For a count question, retain a short noun phrase after the number.
        # "50 conversions per ad set per week" is safer than a paragraph
        # also mentioning an unrelated "24 hours".
        tail = source[match.end():match.end() + 110]
        tail = re.split(r"[.!?;]|\s{2,}", tail, maxsplit=1)[0]
        tokens = tail.split()[:10]
        phrase = match.group() + (" " + " ".join(tokens) if tokens else "")
        # Stop naturally after a recurring time period when one is present.
        period = re.search(r"\bper\s+(?:week|day|month|year)\b", phrase, re.I)
        if period:
            phrase = phrase[:period.end()]
        phrase = phrase.strip(" ,:;-")
        if phrase:
            choices.append((score, phrase))
    if not choices:
        return None
    choices.sort(key=lambda pair: pair[0], reverse=True)
    return choices[0][1][:130]


def _formula_text(question, source):
    if not _FORMULA_QUESTION.search(question) or "=" not in source:
        return None
    parts = []
    for match in re.finditer(r"=", source):
        start = max(
            source.rfind(". ", 0, match.start()),
            source.rfind(": ", 0, match.start()),
        )
        start = start + 2 if start >= 0 else max(0, match.start() - 70)
        end = min(len(source), match.end() + 130)
        trailing = source[match.end():end]
        stop = trailing.find(". ")
        if stop >= 0:
            end = match.end() + stop
        candidate = source[start:end].strip(" .;:")
        if candidate:
            score = excerpt_relevance(question, candidate)
            parts.append((score, candidate))
    if not parts:
        return None
    parts.sort(key=lambda item: item[0], reverse=True)
    if parts[0][0] < 6:
        return None
    return parts[0][1][:200]


def _best_short_passage(question, source):
    """Last resort: a short explicit quote, never a dump of the first page."""
    passages = _SOURCE_TERMINATOR.split(source)
    ranked = sorted(
        ((excerpt_relevance(question, item), item.strip()) for item in passages),
        key=lambda pair: pair[0], reverse=True,
    )
    if not ranked or ranked[0][0] < 6:
        return None
    passage = ranked[0][1]
    if len(passage) > 210:
        return None  # do not arbitrarily truncate facts or mislead the reader
    return f'Relevant passage: "{passage}"'


def concise_pdf_fallback(question, data):
    """Use structured, limited PDF evidence when a small model falsely refuses."""
    for _, title, page, source in _source_candidates(question, data):
        answer = (
            _role_fields(question, source)
            or _quantity_phrase(question, source)
            or _formula_text(question, source)
            or _best_short_passage(question, source)
        )
        if answer:
            return f"{answer}\n\nSource: {title} (page {page})."
    return None


def polish_verified_pdf_answer(question, answer, data):
    """Improve presentation only after the answer has been verified by the server.

    A hallucinated answer must not get replaced with a plausible fact from the
    file; the existing verifier will reject it instead.
    """
    verified = verified_source_for_answer(question, answer, data)
    if verified is None:
        return answer
    title, page = verified
    for _, candidate_title, candidate_page, source in _source_candidates(question, data):
        if (candidate_title, candidate_page) != (title, page):
            continue
        roles = _role_fields(question, source)
        if roles:
            return roles
        # Expand only truly bare numeric answers, and only with evidence for
        # the same number from the selected verified page.
        if re.fullmatch(r"\s*\d+(?:[.,]\d+)?\s*", answer):
            phrase = _quantity_phrase(question, source)
            if phrase and phrase.split()[0].replace(",", "") == answer.strip().replace(",", ""):
                return phrase + "."
        break
    return answer
