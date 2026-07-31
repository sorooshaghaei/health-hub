# Phase 2 — Planned appointments and walk-ins

Status: **Repository implementation complete.**

This document records the approved Phase 2 product behavior and the implementation contract. Phase 3 arrival and live-queue behavior is not part of this phase.

## 1. Patient and Visit relationship

A Patient is the permanent reusable person profile. A Visit is one separate clinic attendance.

Every Visit belongs to exactly one Patient and one clinic. Returning patients reuse their existing Patient profile. Multiple Visits may belong to the same Patient, including multiple separate Visits on the same date.

## 2. Visit types

### Scheduled appointment

Approved fields:

- Patient — required;
- date — required;
- scheduled time — required;
- visit reason — optional plain text.

The scheduled time is informational. It does not determine the live waiting order. Phase 3 waiting order is based on actual check-in order.

### Walk-in

Approved fields:

- Patient — required;
- date — assigned automatically as the clinic's current local date.

Walk-ins do not collect a scheduled time or visit reason in Phase 2.

## 3. Permissions and workspace emphasis

Both Doctor and Assistant may:

- view appointments and walk-ins;
- create appointments and walk-ins;
- edit past and future Visits;
- remove future Visits;
- create a new Patient while creating a Visit.

The Doctor remains the clinic administrator and retains the same API permissions. Appointment administration is operationally the Assistant's job, so the frontend is assistant-first:

- the Assistant opens on the Schedule section;
- the Doctor opens on Patient records;
- the Doctor can enter the same appointment tools through a secondary **Appointments** tab.

No backend permission is removed from the Doctor.

## 4. Existing-Patient suggestions

The Visit form searches active Patient profiles while the user types.

Each suggestion shows:

- full name;
- phone;
- date of birth;
- gender.

Selecting a result attaches the new Visit to that existing Patient.

## 5. Inline Patient creation

The user may switch from Patient search to **Create new Patient** without leaving the Visit form.

The scheduled date, time, and optional reason remain visible and attached to the draft. The backend creates the Patient and Visit in one database transaction. The user does not need to create the Patient, return to search, find the profile, and then create the Visit.

The existing Phase 1 duplicate behavior remains active:

- one **Possible duplicate patient** warning;
- matching profiles are offered as the preferred choice;
- selecting a match keeps the Visit draft and uses that Patient;
- explicit separate-profile creation remains possible;
- Patient names are never modified with generated suffixes.

## 6. Editing and removal

Past and future Visits are editable.

Future Visits are removed permanently when cancelled. There is no Cancelled state in Phase 2.

Only future Visits can be removed:

- a Visit on a later date is future;
- an appointment later on the current date is future;
- a past appointment cannot be removed;
- a walk-in cannot be removed through the Phase 2 cancellation action.

This preserves historical records.

## 7. Patient history and deletion

Past and future Visits appear inside the active Patient profile.

Patient deletion rules now operate against real Visit data:

1. deletion is blocked while future Visits exist;
2. future Visits must be removed first;
3. past Visits remain after the active Patient profile is deleted;
4. Visit records store Patient identity snapshots for historical display;
5. a deleted Patient is excluded from active Patient search and cannot receive another Visit.

There is no user-visible Patient archive state.

## 8. API contract

Authenticated Doctor and Assistant sessions use:

```text
GET    /api/visits/?date=YYYY-MM-DD
GET    /api/visits/?patient=<patient-id>
POST   /api/visits/
GET    /api/visits/<visit-id>/
PATCH  /api/visits/<visit-id>/
DELETE /api/visits/<visit-id>/
```

A Visit create or update accepts either:

```json
{
  "patient_id": "<active-patient-id>"
}
```

or:

```json
{
  "new_patient": {
    "full_name": "Example Patient",
    "gender": "Woman",
    "country_calling_code": "+98",
    "phone_number": "09121234567",
    "date_of_birth": null,
    "patient_note": ""
  }
}
```

Scheduled appointment example:

```json
{
  "visit_type": "appointment",
  "patient_id": "<patient-id>",
  "date": "2026-08-03",
  "scheduled_time": "10:30",
  "reason": "Optional reason"
}
```

Walk-in example:

```json
{
  "visit_type": "walk_in",
  "patient_id": "<patient-id>"
}
```

Inline Patient duplicate warnings use the same Phase 1 HTTP `409` payload and `confirm_duplicate` override.

Deleting a Patient with future Visits returns HTTP `409` with code `future_visits_exist`.

Deleting a non-future Visit returns HTTP `400` with code `visit_not_future`.

## 9. Implementation record

Implemented:

- `Visit` model, indexes, migration, Patient identity snapshots, and PostgreSQL-compatible relations;
- appointment and walk-in validation;
- clinic-scoped list, detail, create, edit, and future-removal APIs;
- atomic inline Patient plus Visit creation;
- duplicate reuse and explicit separate creation;
- Patient deletion blocking against future Visits;
- Patient profile Visit history;
- Assistant-first and Doctor-secondary schedule navigation;
- daily appointment and walk-in lists;
- past and future Visit editing;
- equivalent browser-only GitHub Pages behavior;
- backend and demo-adapter tests.

Not implemented:

- arrival or check-in;
- waiting-order logic;
- live queue;
- `ARRIVED`, `WITH_DOCTOR`, `DOCTOR_FINISHED`, or `CHECKED_OUT` states;
- early/late indicators;
- consultation flow;
- checkout;
- notifications.
