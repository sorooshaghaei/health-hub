# Phase 2 — Planned appointments

Status: **Implemented and aligned with the current account-role/clinic-membership architecture.**

A Patient is a reusable profile inside one clinic. An Appointment is one separate clinic attendance attached to that clinic's Patient record.

Appointment data is always clinic-scoped through the active clinic membership. The same personal Doctor or Assistant account may work in multiple clinics, but Appointment lists, Patient histories, queue state, and Appointment constraints remain completely separate between clinics.

## Appointment fields

Required:

- Patient;
- date;
- scheduled time.

Optional:

- visit reason.

Scheduled time is planning information. It does not determine live queue order.

## One Appointment per Patient per clinic date

A Patient may have Appointments on different dates, but may have at most one active Appointment on any single date within that Patient's clinic.

Because Patient records themselves are clinic-scoped, this rule never compares or links Patients across different clinics.

The rule applies to every active Appointment state:

- `PLANNED`;
- `CHECKED_IN`;
- `WITH_DOCTOR`;
- `DOCTOR_FINISHED` (displayed to users as **Completed**).

`DOCTOR_FINISHED` is the final Appointment workflow state. There is no `CHECKED_OUT` state.

Creating a duplicate or editing an Appointment into a duplicate returns:

```text
This Patient already has an appointment on this date.
```

The response identifies the existing Appointment so the Assistant interface can open it instead of offering an override.

Appointment deletion reserves the Patient/date combination during the five-second Undo window. After that window expires, a replacement Appointment may be created. The active-record database constraint protects concurrent requests, while the API and browser adapter also enforce the temporary deletion reservation.

## Appointment-only model

Every clinic attendance is represented by an Appointment.

When a Patient arrives without an existing Appointment for today, the Assistant creates a normal same-day Appointment and then checks the Patient in. The frontend defaults the scheduled time to the current clinic time for a same-day new Appointment.

There is no active alternate Visit type or `visit_type` field in the product.

## Account-role and workspace permissions

The permanent account role supplies Doctor/Assistant authority. The active membership supplies the clinic boundary.

### Doctor account in Doctor workspace

- view Appointment lists for the active clinic;
- view Appointment history inside Patient profiles for the active clinic;
- no create, edit, delete, or check-in controls.

### Assistant account in Assistant workspace

- create Appointments;
- edit past and future Appointments subject to workflow locks;
- delete current or future Appointments only before consultation starts (`PLANNED` or `CHECKED_IN`);
- create a Patient and Appointment together;
- perform the later check-in, queue, and handoff operations defined by subsequent phases.

### Doctor account in Assistant workspace

A Doctor account with an active membership in the clinic may open Assistant workspace as administrator and receives the same Patient and Appointment administration controls available in that workspace.

An Assistant account cannot open Doctor workspace.

## Patient-first Appointment form

The create and edit forms show the Patient section before date, scheduled time, and visit reason. New Appointment creation starts with a dedicated existing-Patient search rather than displaying the complete new-Patient form.

After two typed characters, matching active Patients from the current clinic appear in a result list. The Assistant then explicitly chooses either **Select existing patient** from those results or **Create new patient**. Each existing-Patient result shows:

- full name;
- phone;
- gender;
- date of birth when available.

Selecting an existing Patient attaches the Appointment to that clinic's Patient record and collapses the Patient section into a compact selected-Patient card with **Change** and **Open profile** actions. Patient details are not edited from the Appointment form.

The full name, gender, country/phone, optional date of birth, and optional Patient note fields remain hidden until the Assistant explicitly chooses **Create new patient**. The date-of-birth maximum is clinic today, and the atomic production and browser-demo paths reject future birth dates before either record is created. The searched name is carried into the new profile and remains editable. Patient and Appointment creation then occurs atomically. The standard duplicate warning and explicit separate-profile action remain active. If the selected Patient already has an Appointment on the chosen date, the form shows the existing Appointment and provides **Open appointment**.

The creation heading and action wording is **Appointment details** / **New appointment** / **Create appointment**. Edit wording remains separate.

No Patient or Appointment suggestion is sourced from another clinic.

## Editing and deletion

- past and future Appointment details are editable subject to workflow locks;
- editing cannot create a second Appointment for the same Patient and clinic date;
- after check-in, the Patient association and Appointment date are locked;
- scheduled time and reason remain correctable after check-in, including during and after consultation;
- current and future Appointments may be deleted only while `PLANNED` or `CHECKED_IN`;
- Appointments cannot be deleted after consultation starts (`WITH_DOCTOR` or `DOCTOR_FINISHED` / **Completed**);
- past Appointments cannot be deleted;
- deletion removes the Appointment from active lists, queue, and Patient history;
- deletion has a server-enforced five-second Undo;
- the deleted Appointment reserves its Patient/date until that Undo period expires.

## Clinic-isolation invariant

All Appointment operations resolve through the active clinic membership.

If one permanent-role account belongs to Clinic A and Clinic B:

- Clinic A Appointment lists contain only Clinic A Appointments;
- Clinic B Appointment lists contain only Clinic B Appointments;
- Patient histories do not cross clinics;
- uniqueness checks do not cross clinics;
- queue and consultation state do not cross clinics.

A physically identical person recorded independently in two clinics remains two separate Patient records with separate Appointment histories.

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

All endpoints operate only on the active clinic and require the account-role/workspace/membership permissions defined above.

## Later design-step extension

Post-Phase-8 **Design Step 5** adds clinic weekly working hours, a **Today** shortcut, and optional 15-minute scheduled-time suggestions without changing this phase's Appointment model, permissions, manual time entry, workflow locks, or deletion rules.

See [`DESIGN_STEP_5_WORKING_HOURS.md`](DESIGN_STEP_5_WORKING_HOURS.md). Product Phase 5 remains the separate completed-consultation phase.
