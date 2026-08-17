import logging

from django.conf import settings
from django.core.mail import send_mail
from django.utils.module_loading import import_string

logger = logging.getLogger(__name__)


class DeliveryNotConfigured(Exception):
    pass


def console_sms_sender(destination, message):
    logger.info("Development SMS to %s: %s", destination, message)


def deliver_verification_code(*, channel, destination, code, purpose):
    purpose_label = purpose.replace("_", " ")
    message = f"Your Health Hub {purpose_label} code is {code}. It expires shortly."
    if channel == "email":
        send_mail(subject="Health Hub verification code", message=message, from_email=settings.DEFAULT_FROM_EMAIL, recipient_list=[destination], fail_silently=False)
        return
    if channel == "sms":
        sender_path = getattr(settings, "SMS_SENDER", "")
        if sender_path:
            import_string(sender_path)(destination, message)
            return
        if settings.DEBUG:
            console_sms_sender(destination, message)
            return
        raise DeliveryNotConfigured("SMS delivery is not configured.")
    raise DeliveryNotConfigured("Unsupported verification channel.")


def deliver_security_notice(*, channel, destination, message):
    if not destination:
        return
    try:
        if channel == "email":
            send_mail(subject="Health Hub security notice", message=message, from_email=settings.DEFAULT_FROM_EMAIL, recipient_list=[destination], fail_silently=True)
            return
        if channel == "sms":
            sender_path = getattr(settings, "SMS_SENDER", "")
            if sender_path:
                import_string(sender_path)(destination, message)
            elif settings.DEBUG:
                console_sms_sender(destination, message)
    except Exception:
        logger.exception("Health Hub security notice delivery failed")
