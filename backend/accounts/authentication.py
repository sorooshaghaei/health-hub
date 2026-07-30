import hashlib
from datetime import timedelta

from django.utils import timezone
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from .models import StaffSession


class StaffSessionAuthentication(BaseAuthentication):
    keyword = "Bearer"

    def authenticate(self, request):
        header = get_authorization_header(request).decode("utf-8")
        if not header:
            return None

        parts = header.split()
        if len(parts) != 2 or parts[0].lower() != self.keyword.lower():
            raise AuthenticationFailed("Invalid authorization header.")

        token_hash = hashlib.sha256(parts[1].encode("utf-8")).hexdigest()
        try:
            session = StaffSession.objects.select_related(
                "user", "user__clinic"
            ).get(token_hash=token_hash)
        except StaffSession.DoesNotExist:
            raise AuthenticationFailed("Invalid or expired staff session.")

        if session.is_expired:
            session.delete()
            raise AuthenticationFailed("Invalid or expired staff session.")

        if not session.user.is_active:
            raise AuthenticationFailed("This staff account is inactive.")

        now = timezone.now()
        if session.last_used_at < now - timedelta(minutes=5):
            session.last_used_at = now
            session.save(update_fields=["last_used_at"])

        return session.user, session

    def authenticate_header(self, request):
        return self.keyword
