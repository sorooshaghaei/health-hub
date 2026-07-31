import re
import unicodedata

NAME_SEPARATOR_PATTERN = re.compile(r"[^\w]+", re.UNICODE)


def normalize_name(value):
    value = unicodedata.normalize("NFKC", str(value or "")).casefold()
    value = NAME_SEPARATOR_PATTERN.sub(" ", value)
    return " ".join(value.split())
