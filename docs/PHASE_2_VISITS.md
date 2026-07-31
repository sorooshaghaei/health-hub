# Phase 2 — Planned appointments

Status: **Implemented and updated to the appointment-only model approved before Phase 3.**

A Patient is the permanent reusable profile. An Appointment is one separate clinic attendance. Multiple Appointments may belong to the same Patient, including more than one on the same date.

## Appointment fields

Required:

- Patient;
- date;
- scheduled time.

Optional:

- visit reason.

Scheduled time is planning information. It does not determine live queue order.

## Appointment-only model

Every clinic attendance is represented by an Appointment.

When a Patient arrives without an existing Appointment, the Assistant creates a normal same-day Appointment and then checks the Patient in. The frontend defaults the scheduled time to the current local time for a same-day new Appointment.

The database migration fills missing scheduled times in legacy rows, then removes the obsolete `visit_type` field. The browser demo performs the equivalent local-storage migration.

## Workspace permissions

### Doctor workspace

- view Appointment lists;
- view Appointment history inside Patient profiles;
- no create, edit, delete, or check-in controls.

### Assistant workspace

- create Appointments;
- edit past and future Appointments;
- delete current or future Appointments;
- create a Patient and Appointment together;
- Doctor administrator credentials may open this workspace.

## Existing-Patient selection

Suggestions show:

- full name;
- phone;
- date of birth;
- gender.

Selecting a suggestion attaches the Appointment to that Patient.

## Inline Patient creation

The Assistant can create a Patient without leaving the Appointment form. Date, scheduled time, and reason remain attached to the draft. Patient and Appointment creation occurs atomically. The standard duplicate warning and explicit separate-profile action remain active.

## Editing and deletion

- past and future Appointment details are editable;
- after check-in, Phase 3 locks the Patient association and Appointment date;
- scheduled time and reason remain correctable after check-in;
- current and future Appointments can be deleted;
- past Appointments cannot be deleted;
- deletion removes the Appointment from active lists, queue, and Patient history;
- deletion has a server-enforced five-second Undo.

## API contract

```text
GET    /api/visits/?date=YYYY-MM-DD
GET    /api/visits/?patient=<patient-id>
POST   /api/visits/
GET    /api/visits/<visit-id>/
PATCH  /api/visits/<visit-id>/
DELETE /api/visits/<visit-id>/
POST   /api/visits/<visit-id>/undo-delete/
```

Create and update payloads do not contain `visit_type`.

```json
{
  "patient_id": "<active-patient-id>",
  "date": "2026-08-03",
  "scheduled_time": "10:30",
  "reason": "Optional reason"
}
```

A nested `new_patient` may replace `patient_id` during creation or before check-in.
