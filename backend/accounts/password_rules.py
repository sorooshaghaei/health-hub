import re

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError


def personal_password_tokens(user):
    values = [user.first_name, user.last_name, user.email, user.phone]
    tokens = []
    for value in values:
        normalized = str(value or "").lower()
        if "@" in normalized:
            normalized = normalized.split("@", 1)[0]
        tokens.extend(token for token in re.findall(r"[a-z0-9]+", normalized) if len(token) >= 3)
    return tokens


def validate_staff_password(password, *, user):
    validate_password(password, user=user)
    normalized = re.sub(r"[^a-z0-9]", "", str(password or "").lower())
    if any(re.sub(r"[^a-z0-9]", "", token) in normalized for token in personal_password_tokens(user)):
        raise ValidationError("The password must not include your name, email, or phone.")
