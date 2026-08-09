# Phase 1 — Patient records specification

Status: **Implemented. The current permission, search, phone-display, and Undo rules include later approved corrections.**

This document is the source of truth for reusable Patient records. Do not add fields, matching rules, archive screens, reminders, or permissions without product-owner approval.

## Patient and appointment separation

- **Patient** is the reusable person profile.
- **Appointment** is one clinic attendance attached to that Patient.

Returning Patients reuse the existing profile and receive another Appointment on a different clinic date.

## Approved Patient fields

| Field | Required | Behavior |
| --- | --- | --- |
| Full name | Yes | Stored without generated suffixes. |
| Gender | Yes | `Man` or `Woman`. |
| Country | Yes | Compact selector shows flag and country name. Iran defaults. |
| Phone number | Yes | The selected calling code is shown beside the large national-number input; normalized national and E.164 values are stored. |
| Date of birth | No | May be empty. |
| Patient note | No | Shared plain text attached to the Patient. |

The Patient profile displays one combined phone value. Separate Country code and National number cards are not shown.

No address, Patient email, reminder, or additional field is approved.

## Workspace permissions

### Doctor workspace

- view and automatically search Patients;
- view Patient details, shared note, and Appointment history;
- edit every approved Patient field, including name, gender, phone, date of birth, and Patient note;
- no Patient creation or deletion;
- no Appointment administration.

### Assistant workspace

- create, view, automatically search, edit, and delete Patients;
- edit every approved Patient field;
- manage Appointments, check-in, queue operations, and consultation handoff;
- Doctor administrator credentials may open this workspace and receive the same complete management access.

Assistant credentials cannot open Doctor workspace. All access remains clinic-scoped.

## Search and duplicate warning

Patient search updates automatically while the user types. No Search-button click is required. Search combines normalized name, phone digits, and date of birth.

The application uses one warning: **Possible duplicate patient**. It is triggered for a similar normalized name with the same normalized phone, including the exact identity case. Matching profiles are offered first; explicit separate-profile creation remains possible. Stored names are never automatically modified.

## Deletion and Undo

Patient deletion is an internal soft deletion with no visible archive state.

- deletion is available only from Assistant workspace, including when a Doctor administrator opens that workspace;
- current and future Appointments must be deleted first;
- past Appointments remain historical through Patient identity snapshots;
- the deleted Patient immediately disappears from active search and selection;
- a five-second **Undo** restores the Patient exactly;
- after the Undo period, the profile remains internally deleted and unavailable in the product UI.

## Patient-page layout

- the Patient workspace uses the full available width;
- Role boundary and Individual access cards are not shown;
- no separate clinic-exit card or browser-access clearing action is shown; staff use the top **Sign out** control to leave or switch accounts.

## Implemented scope

- clinic-scoped Patient model and indexes;
- approved validation and normalization;
- list, automatic search, create, detail, edit, delete, and Undo-delete APIs;
- Doctor Patient-edit permission with Assistant-only creation/deletion;
- Doctor administrator parity inside Assistant workspace;
- duplicate detection and explicit override;
- responsive country/phone UI with country selection above the code-and-number row on mobile;
- browser-demo parity;
- backend and browser-adapter tests.
