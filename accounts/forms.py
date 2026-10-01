from django import forms
from django.contrib.auth.forms import UserCreationForm

from .models import User, generate_available_username


class LMSUserCreationForm(UserCreationForm):
    username = forms.CharField(
        required=False,
        help_text=(
            "Leave blank to auto-generate for College Admin, Teacher, "
            "Student, or Parent. Platform Admin usernames are entered manually."
        ),
    )

    class Meta(UserCreationForm.Meta):
        model = User
        fields = (
            "username",
            "first_name",
            "last_name",
            "email",
            "role",
            "organization",
        )

    def clean(self):
        cleaned_data = super().clean()
        role = cleaned_data.get("role")
        username = str(cleaned_data.get("username") or "").strip()

        if role == User.Role.PLATFORM_ADMIN:
            if not username:
                self.add_error(
                    "username",
                    "Platform Admin username must be entered manually.",
                )
            return cleaned_data

        if not username:
            generated = generate_available_username(
                User,
                cleaned_data.get("first_name", ""),
                cleaned_data.get("last_name", ""),
            )
            cleaned_data["username"] = generated
            self.instance.username = generated

        return cleaned_data
