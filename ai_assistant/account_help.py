"""Verified Student LMS account-help replies independent of AI model classification.

Routes and instructions follow the existing Student Profile, Login and
Forgot Password components. This handler does not access credentials or
trigger password resets on behalf of the student.
"""

import re


def get_student_account_help(message):
    """Return a safe read-only help response, or None for other questions."""
    normalized = " ".join(message.casefold().split())
    if not re.search(r"\bpasswords?\b", normalized):
        return None

    if not re.search(
        r"\b(reset|forgot|forgotten|forget|change|update|recover|recovery|lost)\b"
        r"|(?:can't|cannot|don't) remember|how (?:can|do|should) i",
        normalized,
    ):
        return None

    return {
        "reply": (
            "To reset or change your Student LMS password:\n\n"
            "1. If you know your current password, open Profile → Change "
            "Password. Enter your current password and a new one, then "
            "sign in again after the update.\n\n"
            "2. If you forgot your password, open Forgot Password, enter "
            "the email registered with your Student account, choose "
            "Send Reset Link, and follow the instructions in the email.\n\n"
            "If the email does not arrive, check your spam folder and "
            "contact your college administrator to verify your email "
            "address and email delivery settings.\n\n"
            "For your security, never share passwords or reset links in chat."
        ),
        "links": [
            {"label": "Change password (Profile)", "href": "/student/profile"},
            {"label": "Forgot password", "href": "/student/forgot-password"},
        ],
    }
