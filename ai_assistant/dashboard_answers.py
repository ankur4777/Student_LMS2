"""Reliable answers to common Student Portal questions.

The local 1.5B model sometimes calls portal questions "academic teaching".
For identified modules, answer from authorized Django facts instead of
asking a language model to classify records it may not understand.
"""

import re
from datetime import date, timedelta


LINKS = {
    "recorded_classes": ("/student/recorded-classes", "Open Recorded Classes"),
    "recorded_courses": ("/student/recorded-courses", "Browse Recorded Courses"),
    "online_exams": ("/student/online-exams", "Open Online Exams"),
    "published_results": ("/student/results", "View Results"),
    "attendance": ("/student/attendance", "View Attendance"),
    "assignments": ("/student/assignments", "Open Assignments"),
    "upcoming_classes": ("/student/classes", "Open My Classes"),
    "documents": ("/student/documents", "Open Documents"),
    "fees": ("/student/fees", "View Fees"),
    "notifications": ("/student/notifications", "Open Notifications"),
    "profile": ("/student/profile", "Open Profile"),
}


def _topic(text):
    text = " ".join(text.casefold().split())

    # Querying multiple different modules should go through the AI so it can
    # combine authorized facts; single-module queries get deterministic replies.
    patterns = [
        ("recorded_classes", r"\brecord(?:ed|ing)?\s+(?:classes|class|lectures?|sessions?|videos?)\b"),
        ("recorded_courses", r"\b(?:recorded|purchased|buy)\s+courses?\b|\bcourse\s+purchase\b"),
        ("online_exams", r"\bonline\s+(?:exam|test|assessment)s?\b|\b(?:exam|test)\s+schedule\b"),
        ("published_results", r"\b(?:results?|marks|grades?|scores?)\b"),
        ("attendance", r"\battendan(?:ce|ces)\b|\babsen(?:t|ce)\b"),
        ("assignments", r"\b(?:assignments?|homework|submission|due tasks?)\b"),
        ("upcoming_classes", r"\b(?:live|upcoming|today.?s|tomorrow.?s|scheduled|my)\s+(?:class(?:es)?|lectures?|sessions?)\b|\b(?:next|any)\s+(?:class(?:es)?|lectures?|sessions?)\b|\b(?:class(?:es)?|lectures?|sessions?)\s+(?:schedule(?:d)?|today|tomorrow|upcoming)\b|\bclass(?:es)?\s+(?:are|is|will be)\s+scheduled\b|\bclass(?:es)?\s+do\s+i\s+have\b|\btimetable\b"),
        ("documents", r"\b(?:documents?|notes|syllabus|study materials?|worksheets?)\b"),
        ("fees", r"\b(?:fees?|outstanding|dues?|payments?|paid amount|fine)\b"),
        ("notifications", r"\bnotifications?\b"),
        ("notices", r"\bnotices?|announcements?\b"),
        ("enrolled_subjects", r"\b(?:my|enrolled|assigned|allowed)\s+subjects?\b|\bsubjects?\s+do\s+i\s+study\b"),
        ("profile", r"\b(?:my\s+)?(?:profile|roll number|admission number|student id|username)\b"),
    ]
    hits = [name for name, pattern in patterns if re.search(pattern, text)]
    if len(hits) != 1:
        return None
    return hits[0]


def _lines_for(topic, data):
    if topic == "attendance":
        value = data["attendance"]
        return [
            f"Attendance: {value['percentage']}%",
            f"Present: {value['present']}; Late: {value['late']}; "
            f"Absent: {value['absent']}; Excused: {value['excused']}.",
        ]
    if topic == "profile":
        user = data["student"]
        return [
            f"Student: {user['name']}",
            f"Class: {user['classroom']}, Section: {user['section']}",
            f"Roll number: {user['roll_number'] or 'Not assigned'}",
            f"Admission number: {user.get('admission_number') or 'Not assigned'}",
            f"Username: {user.get('username') or 'Not available'}",
        ]
    if topic == "enrolled_subjects":
        subjects = data["enrolled_subjects"]
        return [
            "Your enrolled subjects: " + ", ".join(subjects)
            if subjects else "No subjects are currently assigned to you."
        ]
    if topic == "recorded_classes":
        return [
            f"• {r['title']} ({r['subject']}, {r['class_date']}). "
            + (
                "You currently have access."
                if r["has_access"] else
                (
                    f"Access not active; purchase status: {r['purchase_status']}."
                    if r["purchase_status"] else
                    "Access requires a purchase or approval."
                )
            )
            + (f" Price: {r['price']}." if r["price"] is not None else "")
            for r in data["recorded_classes"]
        ]
    if topic == "recorded_courses":
        return [
            f"• {r['title']}. "
            + ("Purchased/access active." if r["has_access"] else "Access not active.")
            + (f" Purchase status: {r['purchase_status']}." if r["purchase_status"] else "")
            + f" Price: {r['price']}."
            + (
                " Your available lessons: " + ", ".join(r["lesson_titles"]) + "."
                if r["has_access"] and r["lesson_titles"] else ""
            )
            for r in data["recorded_courses"]
        ]
    if topic == "online_exams":
        return [
            f"• {exam['title']} ({exam['subject']}). "
            f"Starts: {exam['starts_at'] or 'Not scheduled'}; "
            f"Ends: {exam['ends_at'] or 'Not scheduled'}; "
            f"Duration: {exam['duration_minutes']} min; "
            f"Attempt: {exam['attempt_status']}."
            + (
                f" Published final marks: {exam['final_marks']}."
                if exam["result_published"] else
                " Final result not published."
            )
            for exam in data["online_exams"]
        ]
    if topic == "published_results":
        return [
            f"• {r['exam']} ({r['subject']}, {r['date']}): "
            f"{r['marks']}/{r['maximum']}."
            for r in data["published_results"]
        ]
    if topic == "assignments":
        return [
            f"• {a['title']} ({a['subject']}), due {a['due_date']}: "
            f"{a['status']}."
            for a in data["assignments"]
        ]
    if topic == "upcoming_classes":
        return [
            f"• {c['title']} ({c['subject']}) on {c['date']} "
            f"at {c['starts_at']} — {c['status']}."
            for c in data["upcoming_classes"]
        ]
    if topic == "fees":
        return [
            f"• {f['name']}: payable {f['payable']}, paid {f['paid']}, "
            f"outstanding {f['outstanding']}, due {f['due_date']}."
            for f in data["fees"]
        ]
    if topic == "documents":
        return [
            f"• {doc['title']} ({doc['subject']}, {doc['type']})."
            for doc in data["documents"]
        ]
    if topic == "notices":
        return [f"• {n['title']}: {n['message']}" for n in data["notices"]]
    if topic == "notifications":
        return [
            f"• {n['title']}: {n['message']} "
            f"({'read' if n['is_read'] else 'unread'})."
            for n in data["notifications"]
        ]
    return []


LABELS = {
    "recorded_classes": "Recorded Classes",
    "recorded_courses": "Recorded Courses",
    "online_exams": "Online Exams",
    "published_results": "Results",
    "attendance": "Attendance",
    "assignments": "Assignments",
    "upcoming_classes": "My Classes",
    "documents": "Documents",
    "fees": "Fees",
    "notices": "Notices",
    "notifications": "Notifications",
    "enrolled_subjects": "Subjects",
    "profile": "Profile",
}


def answer_portal_question(message, data):
    """Returns an authorized reply or None for queries needing the AI model."""
    topic = _topic(message)
    if topic is None:
        return None
    if topic not in data:
        return {
            "reply": (
                f"{LABELS[topic]} is not available for your class "
                "or has been restricted by your college."
            ),
            "links": [],
        }

    description = "today or upcoming dates"
    if topic == "upcoming_classes":
        upcoming = data["upcoming_classes"]
        asked = message.casefold()
        today = date.fromisoformat(data["as_of"])

        if re.search(r"\btomorrow\b", asked):
            tomorrow = (today + timedelta(days=1)).isoformat()
            upcoming = [item for item in upcoming if item["date"] == tomorrow]
            description = "tomorrow"
        elif re.search(r"\btoday\b", asked):
            upcoming = [
                item for item in upcoming if item["date"] == today.isoformat()
            ]
            description = "today"
        elif re.search(r"\bnext\s+(?:class|classes|lecture|session)\b", asked):
            upcoming = upcoming[:1]
            description = "next"

        data = {**data, "upcoming_classes": upcoming}

    lines = _lines_for(topic, data)
    if topic == "upcoming_classes" and not lines:
        text = (
            "You have no scheduled or live classes listed for "
            f"{description} in your enrolled subjects."
        )
    else:
        text = (
            "\n".join(lines)
            if lines else
            f"No {LABELS[topic].lower()} records are currently available "
            "for your account."
        )
    link = LINKS.get(topic)
    return {
        "reply": text,
        "links": (
            [{"label": link[1], "href": link[0]}]
            if link else []
        ),
    }
