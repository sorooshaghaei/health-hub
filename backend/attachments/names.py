import re
import unicodedata
from pathlib import PurePath


DOCUMENT_NAME_MAX_LENGTH = 255


class DocumentNameError(ValueError):
    pass


def safe_original_filename(value):
    candidate = str(value or "").replace("\\", "/")
    candidate = PurePath(candidate).name
    candidate = unicodedata.normalize("NFKC", candidate)
    candidate = "".join(character for character in candidate if character.isprintable())
    candidate = re.sub(r"\s+", " ", candidate).strip().strip(".")
    if not candidate:
        raise DocumentNameError("The file must have a valid filename.")
    if len(candidate) > DOCUMENT_NAME_MAX_LENGTH:
        raise DocumentNameError("The filename must be 255 characters or fewer.")
    return candidate


def clean_document_name(value, required_extension):
    candidate = safe_original_filename(value)
    extension = PurePath(candidate).suffix.lower()
    required_extension = required_extension.lower()
    if not extension:
        candidate = f"{candidate}{required_extension}"
    elif extension != required_extension:
        raise DocumentNameError(
            f"The document name must keep the {required_extension} file type."
        )
    if len(candidate) > DOCUMENT_NAME_MAX_LENGTH:
        raise DocumentNameError("The document name must be 255 characters or fewer.")
    return candidate


def converted_document_name(value, output_extension):
    candidate = safe_original_filename(value)
    stem = PurePath(candidate).stem.strip().strip(".") or "document"
    maximum_stem = DOCUMENT_NAME_MAX_LENGTH - len(output_extension)
    return f"{stem[:maximum_stem]}{output_extension}"


def normalize_document_name(value):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", value).casefold()).strip()
