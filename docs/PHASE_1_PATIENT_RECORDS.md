# Phase 1 — Patient records specification

Status: **Product specification approved; implementation not started.**

This document is the source of truth for the first patient-record implementation. Do not add fields, permissions, matching behavior, reminders, archival behavior, or external libraries that are not recorded here without asking the product owner first.

## 1. Patient and visit separation

Health Hub separates the permanent person record from each clinic attendance:

- **Patient**: the reusable person profile.
- **Visit**: one occasion when that patient is added to a working day.

A returning patient must reuse the existing Patient profile and receive a new Visit. The application must not create a new Patient record for every attendance.

This structure is intended to preserve visit history and later support information such as return count, visit dates, appointment versus walk-in history, and operational timing. Visit creation and daily scheduling belong to Phase 2; Phase 1 establishes the reusable patient record needed by that workflow.

## 2. Approved patient fields

| Field | Required | Approved behavior |
| --- | --- | --- |
| Full name | Yes | Store the real patient name without generated suffixes or modifications. |
| Gender | Yes | Allowed values: `Man`, `Woman`. |
| Country calling code | Yes | Selected separately from the national phone number. Iran `+98` is the default for now. |
| Phone number | Yes | Validate using the selected country calling code and store a normalized international value. |
| Date of birth | No | May be empty when unknown. |
| Patient note | No | Plain shared text attached to the patient profile. |

No address, email, or additional patient fields are approved for Phase 1.

Browser-based location detection is not part of Phase 1. It may later suggest a default country code only after separate approval. The current default remains Iran `+98`.

## 3. Patient note

The field is named **Patient note**, not Assistant note.

It is:

- visible to both Doctor and Assistant;
- editable by both Doctor and Assistant;
- optional;
- plain text;
- attached to a specific patient;
- not a reminder;
- not a notification;
- not scheduled;
- separate from personal sticky notes.

Phase 7 personal notes are different: Doctor personal notes are visible only to the Doctor, and Assistant personal notes are visible only to the Assistant. Those personal notes behave conceptually like simple sticky notes and do not create reminders.

## 4. Permissions

Both Doctor and Assistant may:

- view the patient profile;
- search for patients;
- create a patient;
- edit all approved patient fields;
- edit the Patient note;
- request patient deletion, subject to the deletion rules below.

Doctor access to patient profiles is not restricted to visit-only information.

## 5. Search and reuse

Patient search combines:

- full or partial name;
- phone number;
- date of birth.

When the Assistant later adds a patient to a working day, the entry flow must suggest matching existing Patient profiles while the Assistant types. Selecting an existing result creates a new Visit for that Patient rather than duplicating the Patient profile.

The suggestion must show enough identifying context to distinguish people with the same or similar names. The real stored name must remain unchanged. Internal IDs and contextual details such as date of birth or phone information should distinguish records in the interface.

The exact visual contents of the working-day suggestion row are part of Phase 2 and must be confirmed before that interface is implemented.

## 6. Duplicate warning

Use one simple warning message: **Possible duplicate patient**.

The same generic warning is used when either condition is detected:

- normalized full name, phone number, and date of birth indicate the same patient;
- a similar name uses the same phone number.

When date of birth is empty, normalized full name plus phone number is sufficient to produce the warning.

The warning:

- does not block creation;
- must offer the existing matching profile as the preferred choice;
- may still allow an explicit decision to create a separate patient;
- must not create multiple technical warning categories in the interface.

Do not append numbers, codes, or generated text to the patient’s stored name. Distinguish same-name patients through contextual display and the internal unique identifier.

The exact internal normalization and similar-name matching implementation may be selected during implementation, but it must preserve this single-warning product behavior and must not introduce an external dependency without approval.

## 7. Editing and deletion

Patient profiles may be edited. There is no archive state.

Deletion rules:

1. A patient cannot be deleted while one or more future Visits exist.
2. Future Visits must be removed first.
3. Past Visits are never removed merely because the active Patient profile is deleted.
4. After deletion, historical Visits retain the patient details captured for historical display.
5. The deleted Patient profile is no longer active or selectable, and no new Visit can be created for it.

This means patient deletion removes the active reusable profile but preserves previous clinic history. The future Visit removal behavior itself belongs to Phase 2 and must be confirmed as part of appointment/visit cancellation rules.

## 8. Phase 1 implementation scope

After the product owner says **continue**, implement only:

- Patient database model and migration;
- approved field validation;
- international country-code and phone input with Iran `+98` as the default;
- patient create, view, edit, search, and delete APIs;
- Doctor and Assistant permissions described above;
- one non-blocking duplicate warning behavior;
- patient list, search, create, detail, edit, and deletion interface;
- backend tests;
- frontend/demo adapter tests and equivalent GitHub Pages demo behavior;
- documentation updates resulting from the implementation.

Do not implement appointments, working-day Visits, live queue states, consultation flow, checkout, shared tasks, personal notes, notifications, or estimates in Phase 1.

## 9. Continuation protocol

Before making an unrecorded product or technical choice, ask the product owner. Implement directly on `main`, validate the phase, report the exact changes, and stop until the product owner says **continue**.