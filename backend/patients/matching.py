from difflib import SequenceMatcher

from django.db.models import Q

from .models import Patient
from .normalization import normalize_name


def names_are_similar(first, second):
    first = normalize_name(first)
    second = normalize_name(second)
    if not first or not second:
        return False
    if first == second:
        return True
    if sorted(first.split()) == sorted(second.split()):
        return True
    return SequenceMatcher(None, first, second).ratio() >= 0.82


def possible_duplicate_patients(*, clinic, candidate, exclude_patient=None):
    queryset = Patient.objects.filter(
        clinic=clinic,
        phone_e164=candidate["phone_e164"],
    )
    if exclude_patient is not None:
        queryset = queryset.exclude(pk=exclude_patient.pk)

    candidate_name = candidate["full_name"]
    candidate_dob = candidate.get("date_of_birth")
    matches = []
    for patient in queryset.order_by("normalized_name", "id"):
        exact_identity = (
            patient.normalized_name == normalize_name(candidate_name)
            and (
                candidate_dob is None
                or patient.date_of_birth is None
                or patient.date_of_birth == candidate_dob
            )
        )
        similar_same_phone = names_are_similar(patient.full_name, candidate_name)
        if exact_identity or similar_same_phone:
            matches.append(patient)
    return matches[:5]


def patient_search_queryset(queryset, search):
    search = str(search or "").strip()
    if not search:
        return queryset

    normalized_name = normalize_name(search)
    digits = "".join(character for character in search if character.isdigit())
    criteria = Q()
    if normalized_name:
        criteria |= Q(normalized_name__icontains=normalized_name)
    if digits:
        criteria |= Q(phone_number__icontains=digits) | Q(phone_e164__icontains=digits)

    from datetime import datetime

    for pattern in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            criteria |= Q(date_of_birth=datetime.strptime(search, pattern).date())
            break
        except ValueError:
            continue
    return queryset.filter(criteria)
