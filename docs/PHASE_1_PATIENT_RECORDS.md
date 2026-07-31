# Phase 1 — Patient records specification

Status: **Implemented. The current permission and Undo rules include later approved corrections.**

This document is the source of truth for reusable Patient records. Do not add fields, matching rules, archive screens, reminders, or permissions without product-owner approval.

## Patient and appointment separation

- **Patient** is the reusable person profile.
- **Appointment** is one clinic attendance attached to that Patient.

Returning Patients reuse the existing profile and receive another Appointment.

## Approved Patient fields

| Field | Required | Behavior |
| --- | --- | --- |
| Full name | Yes | Stored without generated suffixes. |
| Gender | Yes | `Man` or `Woman`. |
| Country calling code | Yes | Separate from the national number; Iran `+98` defaults. |
| Phone number | Yes | Normalized national and E.164 values. |
| Date of birth | No | May be empty. |
| Patient note | No | Shared plain text attached to the Patient. |

No address, Patient email, reminder, or additional field is approved.

## Workspace permissions

### Doctor workspace

- view and search Patients;
- view Patient details, note, and appointment history;
- no Patient creation, editing, note editing, or deletion.

### Assistant workspace

- create, view, search, edit, and delete Patients;
- edit the Patient note;
- Doctor administrator credentials may open this workspace and receive the same management access.

All access remains clinic-scoped.

## Search and duplicate warning

Search combines normalized name, phone digits, and date of birth.

The application uses one warning: **Possible duplicate patient**. It is triggered for a similar normalized name with the same normalized phone, including the exact identity case. Matching profiles are offered first; explicit separate-profile creation remains possible. Stored names are never automatically modified.

## Deletion and Undo

Patient deletion is an internal soft deletion with no visible archive state.

- current and future Appointments must be deleted first;
- past Appointments remain historical through Patient identity snapshots;
- the deleted Patient immediately disappears from active search and selection;
- a five-second **Undo** restores the Patient exactly;
- after the Undo period, the profile remains internally deleted and unavailable in the product UI.

## Implemented scope

- clinic-scoped Patient model and indexes;
- approved validation and normalization;
- list, search, create, detail, edit, delete, and Undo-delete APIs;
- Doctor read-only and Assistant management boundaries;
- duplicate detection and explicit override;
- browser-demo parity;
- backend and browser-adapter tests.
