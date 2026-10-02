from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend


class UsernameOrEmailBackend(ModelBackend):
    """Authenticate with the normal username or a unique email address."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        UserModel = get_user_model()

        identifier = username or kwargs.get(UserModel.USERNAME_FIELD)
        identifier = str(identifier or "").strip()

        if not identifier or password is None:
            return None

        user = UserModel.objects.filter(
            username__iexact=identifier,
        ).first()

        if user is None:
            email_matches = UserModel.objects.filter(
                email__iexact=identifier,
            ).order_by("id")

            if email_matches.count() != 1:
                return None

            user = email_matches.first()

        if user.check_password(password) and self.user_can_authenticate(user):
            return user

        return None
