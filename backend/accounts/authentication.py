import hashlib
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from .models import StaffSession


DEVICE_COOKIE_NAME = "health_hub_device"


def trusted_device_cookie_name():
    return DEVICE_COOKIE_NAME


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
                "user",
                "membership",
                "membership__clinic",
                "trusted_device",
                "reauth_passkey",
            ).get(token_hash=token_hash)
        except StaffSession.DoesNotExist:
            raise AuthenticationFailed("Invalid or expired staff session.")

        now = timezone.now()
        inactivity_age = timedelta(seconds=settings.STAFF_SESSION_INACTIVITY_AGE)
        if session.is_expired or session.last_used_at <= now - inactivity_age:
            session.delete()
            raise AuthenticationFailed("Invalid or expired staff session.")
        if not session.user.is_active:
            raise AuthenticationFailed("This staff account is inactive.")

        if session.trusted_device_id is not None:
            if session.trusted_device.user_id != session.user_id:
                session.delete()
                raise AuthenticationFailed("Invalid or expired staff session.")
            raw_device_token = (
                request.headers.get("X-Device-Token")
                or request.COOKIES.get(trusted_device_cookie_name())
            )
            if not raw_device_token:
                raise AuthenticationFailed("A trusted device is required.")
            supplied_device_hash = hashlib.sha256(
                raw_device_token.encode("utf-8")
            ).hexdigest()
            if supplied_device_hash != session.trusted_device.token_hash:
                raise AuthenticationFailed("This staff session belongs to another device.")

        if session.membership_id is not None:
            membership = session.membership
            if (
                membership.user_id != session.user_id
                or not membership.is_active
                or session.trusted_device_id is None
            ):
                session.delete()
                raise AuthenticationFailed("Invalid or expired staff session.")

        if session.last_used_at < now - timedelta(minutes=5):
            session.last_used_at = now
            session.save(update_fields=["last_used_at"])
        return session.user, session

    def authenticate_header(self, request):
        return self.keyword
