# Health Hub project continuation context

This file is the handoff entry point for a new chat or development session.

## Repository and workflow

- Repository: `sorooshaghaei/health-hub`
- Working branch: `main`
- Work directly on `main`; do not create branches or pull requests unless explicitly instructed.
- Implement one approved phase at a time.
- Ask before choosing an unapproved field, state, screen, action, permission, algorithm, dependency, or workflow.
- Update documentation, validate, commit, report, and stop after each phase.
- Continue only after the product owner explicitly says **continue**.

## Product baseline

Health Hub is a deliberately simple clinic workflow application for one clinic with one Doctor account and one Assistant account. It uses React/Vite, Django REST Framework, and PostgreSQL. The public Pages build uses the same React frontend with a browser-only adapter and is not medical-data storage.

## Account and workspace rule

Account identity and active workspace are separate:

- Doctor credentials can open Doctor workspace;
- Doctor credentials can open Assistant workspace for full administrator intervention;
- Assistant credentials can open Assistant workspace;
- Assistant credentials cannot open Doctor workspace.

Doctor workspace owns Room ready and otherwise stays clinically focused. It may view and edit every approved Patient field, but it cannot create/delete Patients or administer Appointments. Assistant workspace owns full Patient and Appointment administration, check-in, queue, and Patient-to-room actions. A Doctor account inside Assistant workspace receives exactly the same administrative controls as the Assistant.

## Implemented workflow

### Patients

- reusable Patient profile;
- full name, `Man`/`Woman`, country/calling code, phone, optional date of birth, optional shared Patient note;
- Iran `+98` default;
- small country selector with flag, country name, and calling code beside a large national-number input;
- one combined phone display in the Patient profile; no separate Country code or National number cards;
- search by name, phone, or date of birth updates automatically while typing;
- Doctor workspace may edit every Patient field;
- Patient creation and deletion remain Assistant-workspace actions;
- one Possible duplicate patient warning;
- internal soft deletion;
- current/future Appointments block deletion;
- five-second Patient deletion Undo;
- Role boundary and Individual access cards are removed;
- Leave clinic completely remains with an explanation that it clears browser access without deleting clinic data.

### Appointments

- Patient, date, scheduled time, optional reason;
- one Appointment type for every clinic attendance;
- a Patient may have Appointments on different dates but only one active Appointment per clinic date;
- duplicate create/edit returns the existing Appointment with **Open appointment** rather than an override;
- a just-deleted Appointment reserves its Patient/date during the five-second Undo period;
- after Undo expiry, a replacement Appointment may be created;
- database uniqueness, API validation, and browser-demo validation enforce the same rule;
- migration never silently deletes or merges existing duplicates and stops for manual resolution if needed;
- a Patient arriving without an Appointment for today receives a normal same-day Appointment, whose frontend time defaults to current time, then check-in;
- inline Patient plus Appointment creation;
- past and future history inside Patient profile;
- current/future Appointment deletion before consultation with five-second Undo;
- Appointment create/edit/delete controls are present in Assistant workspace, including when opened by the Doctor administrator;
- Doctor workspace does not expose Appointment administration controls;
- legacy Visit records migrate to the Appointment-only model.

### Check-in and queue

```text
PLANNED → CHECKED_IN
```

- only today's Appointments can check in;
- check-in timestamp records the check-in action;
- live queue contains today's checked-in Appointments only;
- queue order uses persisted check-in sequence, not scheduled time;
- equal timestamps retain first-saved order;
- queue row: position, Patient name, gender, scheduled time, check-in time, optional reason;
- Assistant Appointment list and queue show phone;
- Doctor queue omits phone;
- no early/late, unavailable, Left, Cancelled, or no-show state;
- checked-in Patient and date cannot change;
- scheduled time, reason, and Patient profile details remain correctable;
- Check in, Appointment deletion, and Patient deletion use server-enforced five-second Undo;
- live operational data refreshes every three seconds.

### Doctor room call and consultation handoff

```text
CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

- Doctor taps **Room ready** as a one-time ring/call;
- any current `WITH_DOCTOR` Patient becomes `DOCTOR_FINISHED`;
- the Doctor receives five-second Undo before the Assistant is notified;
- after five seconds, the Assistant receives one short sound and persistent on-screen notice;
- a smaller Room ready indicator remains after dismissal until the call is consumed;
- one pending call persists even if the queue is empty;
- first waiting Patient is suggested, but Assistant may choose any checked-in Patient;
- Assistant taps **With doctor** and consumes the pending call;
- queue sequence remains based on original check-in, while displayed positions recalculate;
- Assistant's five-second Undo restores the Patient to the queue and restores the pending call;
- `WITH_DOCTOR` disappears from the waiting queue and appears as a badge in the Appointment list;
- Doctor consultation card shows Patient name, scheduled time, check-in time, reason, shared Patient note, and Patient-profile access;
- card expansion and dismissal are visual only and never change status;
- no Doctor Finished, Pause, Return, or automatic-next-patient action;
- clinic-scoped transactions prevent conflicts between separate Doctor and Assistant computers.

See:

- [`PHASE_1_PATIENT_RECORDS.md`](PHASE_1_PATIENT_RECORDS.md)
- [`PHASE_2_VISITS.md`](PHASE_2_VISITS.md)
- [`PHASE_3_QUEUE.md`](PHASE_3_QUEUE.md)
- [`PHASE_4_CONSULTATION.md`](PHASE_4_CONSULTATION.md)

## Current phase

**Phase 4 repository implementation is complete, including the approved one-Appointment-per-Patient-per-date and Patient-workspace corrections. Stop until the product owner explicitly says continue.**

External GitHub Actions and live Pages outcomes require separate confirmation.

## Next action

Do not begin Phase 5 automatically.

When the product owner says **continue**, first resolve the Phase 5 checkout decisions in [`DEVELOPMENT_PLAN.md`](DEVELOPMENT_PLAN.md).

The implemented handoff leaves completed consultations in `DOCTOR_FINISHED`; Phase 5 must define the Assistant's checkout flow before any further status or UI is added.
