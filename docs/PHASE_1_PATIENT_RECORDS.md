# Phase 1 — Patient records specification

Status: **Implemented. The current permission, clinic-isolation, search, phone-display, and Undo rules include later approved corrections.**

This document is the source of truth for reusable Patient records. Do not add fields, matching rules, archive screens, reminders, or permissions without product-owner approval.

## Patient and appointment separation

- **Patient** is the reusable person profile inside one clinic.
- **Appointment** is one clinic attendance attached to that Patient.

Returning Patients reuse the existing profile and receive another Appointment on a different clinic date.

Patient identity is **clinic-scoped**, not global. The same real-world person appearing in two clinics is represented by two independent Patient records unless a future explicitly approved cross-clinic feature changes that rule. Health Hub does not automatically merge or expose Patient records across clinics.

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

Every active Patient API representation includes
`country_calling_code`, `phone_number`, and `phone_e164`. The edit form also
derives the national number from `phone_e164` when an older browser-demo record
or incomplete nested payload lacks `phone_number`. Opening Edit therefore never
turns an existing displayed phone number into a blank field.

No address, Patient email, reminder, or additional field is approved.

## Clinic isolation

Patient data belongs to the active clinic selected through the current account's active membership.

A Doctor or Assistant personal account may belong to several clinics, but:

- Patient lists contain only Patients from the active clinic;
- Patient search operates only inside the active clinic;
- Patient detail and Appointment history are limited to the active clinic;
- duplicate detection compares only Patients inside the active clinic;
- switching clinics changes the available Patient data to the newly selected clinic;
- Patient data from one clinic must never appear in another clinic merely because the same staff person belongs to both clinics.

## Account-role and workspace permissions

The person's permanent account role determines Doctor/Assistant authority. The active clinic membership determines which clinic may be accessed, and the active workspace determines which operational controls are exposed.

### Doctor account in Doctor workspace

The Doctor may:

- view and automatically search Patients;
- view Patient details, shared note, and Appointment history;
- edit every approved Patient field, including name, gender, phone, date of birth, and Patient note;
- not create or delete Patients;
- not administer Appointments.

### Assistant account in Assistant workspace

The Assistant may:

- create, view, automatically search, edit, and delete Patients;
- edit every approved Patient field;
- manage Appointments, check-in, queue operations, and consultation handoff.

### Doctor account in Assistant workspace

A Doctor account with an active membership in the clinic may open Assistant workspace for administrator intervention and receives the same Patient-management controls available in that workspace, including Patient creation and deletion.

An Assistant account cannot open Doctor workspace.

All Patient access remains clinic-scoped regardless of workspace.

## Search and duplicate warning

Patient search updates automatically while the user types. No Search-button click is required. Search combines normalized name, phone digits, and date of birth.

The application uses one warning: **Possible duplicate patient**. It is triggered for a similar normalized name with the same normalized phone, including the exact identity case. Matching profiles are offered first; explicit separate-profile creation remains possible. Stored names are never automatically modified.

Duplicate detection is limited to the active clinic. A matching Patient in another clinic is not exposed or treated as a duplicate.

## Deletion and Undo

Patient deletion is an internal soft deletion with no visible archive state.

- deletion is available only from Assistant workspace, including when a Doctor account opens that workspace as administrator;
- current and future Appointments must be deleted first;
- past Appointments remain historical through Patient identity snapshots;
- the deleted Patient immediately disappears from active search and selection;
- a five-second **Undo** restores the Patient exactly;
- after the Undo period, the profile remains internally deleted and unavailable in the product UI.

## Patient-page and session navigation

- the Patient workspace uses the full available width;
- Role boundary and Individual access cards are not shown;
- **Sign out** ends the current personal-account session;
- when the signed-in person has memberships in multiple clinics, the current-clinic control may be used to switch clinics;
- switching clinics changes the operational context and therefore the visible Patient data;
- clinic switching does not merge Patient records or make Patient data global.

## Implemented scope

- clinic-scoped Patient model and indexes;
- approved validation and normalization;
- list, automatic search, create, detail, edit, delete, and Undo-delete APIs;
- Doctor-workspace Patient-edit permission with Assistant-workspace creation/deletion;
- Doctor administrator parity inside Assistant workspace;
- duplicate detection and explicit override;
- strict clinic isolation for Patient records;
- responsive country/phone UI with country selection above the code-and-number row on mobile;
- browser-demo parity through the same production React UI;
- backend and browser-adapter tests.
