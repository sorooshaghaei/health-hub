from django.utils import timezone


class ClinicTimeZoneResetMiddleware:
    """Prevent an activated clinic timezone from leaking between requests."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        timezone.deactivate()
        try:
            return self.get_response(request)
        finally:
            timezone.deactivate()
