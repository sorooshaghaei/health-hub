# Design Step 5 — Weekly clinic working hours

Status: **Implemented, merged, and validated on `main`.**

This is a post-Phase-8 design step. It is not Product Phase 5, which remains the completed-consultation phase.

## Purpose

Give clinic staff a simple weekly reference and make Appointment-time entry faster without turning Health Hub into a public booking or availability system.

Each clinic has:

- any selection of the seven weekdays as working days;
- one continuous start–end working-time range for each selected weekday;
- no date-specific exceptions or additional scheduling rules.

## Approved product contract

### Working days and hours

- The Doctor chooses the clinic's working weekdays from all seven days.
- Each selected weekday has exactly one start time and one end time.
- Start and end times may use any minute value; they are not restricted to 15-minute boundaries.
- A valid range requires the start time to be earlier than the end time.
- An unselected weekday is a non-working day.
- Until the Doctor saves working hours, the clinic is treated as unconfigured: Appointment time remains manually enterable and no suggestions are shown.

There are deliberately no holidays, one-off closed days, vacations, recurring date exceptions, weekend rules, public availability, capacity limits, or automatic prevention of Appointments.

### Location and permissions

The configuration is located at:

`Clinics → selected clinic → Working days and hours`

- The clinic's owning Doctor can configure and edit it.
- An Assistant with an active membership in that clinic can see the same section read-only.
- The data and permissions are clinic-scoped. A user who belongs to multiple clinics sees only the selected clinic's schedule.

### Appointment date behavior

- Keep the existing native Appointment date field and its current rules.
- Add a **Today** shortcut only. There is no **Tomorrow** shortcut.
- **Today** uses the selected clinic's stored operational timezone.
- When the selected date falls on a configured working weekday, show that weekday's suggested times.
- When the selected date falls on a non-working weekday, show a small warning: **This is not a working day for this clinic.**
- The warning is informational. Manual time entry remains available.

Task due dates, date filters, and every other date control remain unchanged.

### Appointment time behavior

The existing manual time input remains the source of the value saved with the Appointment. Suggestions are optional shortcuts that fill that input.

For the selected weekday's range:

1. include the exact configured start time;
2. add 15 minutes repeatedly while the next value is earlier than the configured end time;
3. include the exact configured end time as the final suggestion if it has not already been reached.

Examples:

- `09:00–17:00` produces `09:00`, `09:15`, …, `16:45`, `17:00`;
- `10:00–13:00` produces `10:00`, `10:15`, …, `12:45`, `13:00`;
- `10:05–11:00` produces `10:05`, `10:20`, `10:35`, `10:50`, `11:00`.

The Assistant may type any valid time manually, including a time outside the configured range, without a warning or confirmation. The working hours guide clinic staff; they do not enforce Appointment availability.

Suggestions apply when creating an Appointment and when editing a planned Appointment. Existing post-check-in field locks and correction rules do not change.

## Implemented architecture

### 1. Clinic data and API

- Add a clinic-owned weekly-hours record with one row per enabled weekday.
- Store weekday, start time, and end time; enforce one row per clinic and weekday plus start-before-end validation.
- Provide `GET` and `PUT /api/clinics/<clinic-id>/working-hours/` for clinic-scoped reading and idempotent full replacement.
- Return a clear permission error if an Assistant attempts to modify the hours.
- Mirror the same records, validation, and permissions in the browser-demo adapter.

The full-update payload represents the complete enabled-weekday set. Sending the same payload twice must leave the same result and must not create duplicate weekday records.

### 2. Clinic details interface

- Extend the Clinics area with a selected-clinic detail view.
- Add a **Working days and hours** section containing seven weekday rows.
- For the Doctor, each row has a working-day selector and start/end fields; disabled days do not expose active time inputs.
- Working-day labels and start/end fields provide at least 44px interactive height. The labels use readable form text, and the row remains at its existing 62px density.
- Save the weekly set as one operation and show normal saving, success, validation, and error states.
- For the Assistant, render the same weekday information as read-only content with no edit controls.
- Show a simple not-configured state before the Doctor saves any working days.

### 3. Appointment interface

- Keep the existing date and manual scheduled-time fields.
- Add **Today** beside the date field and resolve its value using the clinic's operational timezone.
- Load the selected clinic's weekly hours and derive the chosen date's weekday without converting the civil date through the viewing browser's timezone.
- Render the small non-working-day warning when appropriate.
- Generate suggestion buttons with the approved 15-minute-plus-end algorithm.
- Selecting a suggestion writes its value into the existing time input; typing a manual value continues to work normally.
- Apply suggestions to new Appointments and planned-Appointment editing only; preserve all existing workflow locks.

### 4. Validation and tests

Backend tests must cover:

- Doctor read/write and Assistant read-only permissions;
- clinic isolation for multi-clinic accounts;
- one row per clinic/weekday and start-before-end validation;
- idempotent full updates;
- browser-demo parity.

Frontend/browser-flow tests must cover:

- Doctor configuration and editing in the selected clinic;
- Assistant read-only display;
- unconfigured clinics showing no suggestions;
- the **Today** shortcut using clinic operational today;
- working-day suggestions including both configured endpoints;
- an unaligned range such as `10:05–11:00` including the exact end;
- non-working-day warning with manual entry still available;
- unrestricted manual time outside the working range;
- create and planned-edit flows;
- unchanged task dates, filters, and post-check-in behavior.

### 5. Completion gate

Before merge:

- backend, frontend, and browser-demo behavior must match this document;
- relevant automated tests and production builds must pass;
- no date/holiday/availability behavior outside this approved scope may be introduced;
- documentation must describe this work as **Design Step 5**, never as a new product phase.
