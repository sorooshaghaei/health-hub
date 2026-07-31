# Phase 1 — Patient records specification

Status: **Implemented in the repository. External GitHub Actions and Pages deployment results must be checked separately.**

This document remains the source of truth for the first patient-record implementation. Do not add fields, permissions, matching behavior, reminders, archival behavior, or external libraries that are not recorded here without asking the product owner first.

## 1. Patient and visit separation

Health Hub separates the permanent person record from each clinic attendance:

- **Patient**: the reusable person profile.
- **Visit**: one occasion when that patient is added to a working day.

A returning patient must reuse the existing Patient profile and receive a new Visit. The application must not create a new Patient record for every attendance.

Visit creation and daily scheduling belong to Phase 2. Phase 1 implements only the reusable patient record needed by that workflow.

## 2. Approved patient fields

| Field | Required | Implemented behavior |
| --- | --- | --- |
| Full name | Yes | Stores the real patient name without generated suffixes or modifications. |
| Gender | Yes | Allowed values: `Man`, `Woman`. |
| Country calling code | Yes | Selected separately from the national phone number; Iran `+98` is the default. |
| Phone number | Yes | Validated using the selected calling code and stored as a normalized national number plus E.164 value. |
| Date of birth | No | May be empty when unknown. |
| Patient note | No | Shared plain text attached to the patient profile. |

No address, email, or additional patient field is part of Phase 1.

The implementation uses no external phone-number dependency. It applies exact national-length rules for the approved `+98` default and several stable common calling codes, with E.164 length validation for other valid calling codes.

## 3. Patient note

The field is named **Patient note**, not Assistant note. It is visible and editable by both Doctor and Assistant, optional, plain text, attached to a specific patient, and is not a reminder, notification, or scheduled item.

Phase 7 personal notes remain separate creator-only sticky notes.

## 4. Permissions

Both Doctor and Assistant can:

- view and search patient profiles;
- create a patient;
- edit all approved patient fields;
- edit the Patient note;
- delete a patient subject to deletion rules.

All patient queries and mutations are restricted to the authenticated staff member's clinic.

## 5. Search and reuse

Patient search combines full or partial normalized name, phone digits, and date of birth. Search accepts ISO date input and `DD/MM/YYYY` in the backend.

When Phase 2 adds a patient to a working day, matching existing profiles must be suggested so a new Visit is attached to the existing Patient instead of creating a duplicate Patient.

## 6. Duplicate warning

The implementation uses one warning message: **Possible duplicate patient**.

It is returned when the same normalized identity is detected or when a similar name uses the same normalized phone number. When date of birth is empty, normalized name plus phone is sufficient.

The warning does not permanently block creation. The interface offers matching existing profiles first and allows an explicit **Create separate patient** action. The stored name is never modified with generated suffixes.

The internal implementation uses Unicode normalization, token comparison, and a standard-library similarity ratio. No external matching dependency was added.

## 7. Editing and deletion

Patient profiles can be edited. There is no user-visible archive state.

Deletion removes the active reusable profile through an internal deletion timestamp. Deleted profiles disappear from patient APIs, search, and selection, and cannot receive new records through Phase 1 APIs.

Phase 1 does not create a Visit model, so future Visits cannot yet exist. The soft-deletion design preserves the required historical-link boundary for Phase 2. When Visits are introduced, the deletion endpoint must be extended to block deletion while future Visits exist and to preserve historical Visit snapshots.

## 8. Implemented Phase 1 scope

Implemented directly on `main`:

- dedicated Patient model, migration, active manager, and clinic indexes;
- approved field, gender, date, country-code, national-phone, and E.164 validation;
- patient list, combined search, create, detail, edit, and delete APIs;
- Doctor and Assistant clinic-scoped permissions;
- single non-blocking duplicate-warning contract with explicit override;
- patient list, search, create, detail, edit, note, duplicate, and deletion interface;
- equivalent browser-only GitHub Pages demo behavior;
- backend patient API tests and expanded demo-adapter tests;
- documentation and continuation-context updates.

Not implemented: Visits, appointments, working-day scheduling, queue states, consultation flow, checkout, shared tasks, personal notes, notifications, or estimates.

## 9. Continuation protocol

After Phase 1 validation, stop. Phase 2 must not begin until the product owner explicitly says **continue** and its unresolved appointment, Visit, cancellation, walk-in, and suggestion-row decisions are approved.
