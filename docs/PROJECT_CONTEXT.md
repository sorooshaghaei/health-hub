# Health Hub project continuation context

This file is the handoff entry point for a new chat or development session.

## Repository and workflow

- Repository: `sorooshaghaei/health-hub`
- Working branch: `main`
- Work directly on `main`; do not create branches or pull requests unless explicitly instructed.
- Implement one approved phase or corrective pass at a time.
- Ask before choosing an unapproved field, state, screen, action, permission, algorithm, dependency, or workflow.
- Update documentation, validate, commit, report, and stop after each phase/corrective pass.
- Continue only after the product owner explicitly says **continue**.

## Product baseline

Health Hub is a deliberately simple clinic workflow application with Doctor and Assistant roles. It uses React/Vite, Django REST Framework, and PostgreSQL. The public Pages build uses the same React frontend with a browser-only adapter and is not medical-data storage.

## Account and workspace rule

Account identity and active workspace are separate:

- Doctor credentials can open Doctor workspace;
- Doctor credentials can open Assistant workspace for full administrator intervention;
- Assistant credentials can open Assistant workspace;
- Assistant credentials cannot open Doctor workspace.

Doctor workspace owns Room ready and otherwise stays clinically focused. It may view and edit every approved Patient field, but it cannot create/delete Patients or administer Appointments. Assistant workspace owns full Patient and Appointment administration, check-in, queue, and Patient-to-room actions. A Doctor account inside Assistant workspace receives exactly the same administrative controls as the Assistant for those workflows.

Phase 6 task authoring permissions are based on account identity rather than workspace: the Doctor account may create/edit/delete Doctor-to-Assistant tasks even when the Doctor is using Assistant workspace; the Assistant account cannot author tasks.

Phase 7 private sticky access requires account identity to match the active workspace. The Doctor sees the Doctor sticky only in Doctor workspace. The Assistant sees the Assistant sticky only in Assistant workspace. Doctor credentials inside Assistant workspace see neither private sticky.

## Authentication foundation: current implementation and current correction

The current code still has two authentication layers:

1. clinic email + shared clinic password, which establishes clinic access;
2. individual staff username + staff password, which establishes a Doctor or Assistant session.

That is the **current implementation**, not the intended final architecture.

The project is now returning to **Phase 0 for a small base-authentication corrective pass before Phase 8**.

Approved architectural direction for that correction:

- keep the clinic as the tenant/container for clinic data;
- remove the shared clinic password from normal daily authentication;
- gate clinic access through trusted clinic devices/browsers;
- keep trusted-device authorization separate from individual staff sessions;
- signing out Doctor or Assistant ends that staff session without automatically untrusting the device;
- keep the Doctor/Assistant role-selection step;
- keep Doctor and Assistant individually authenticated;
- an untrusted device must not gain clinic/Patient-data access merely because somebody knows a staff credential;
- remote access from an untrusted device is blocked.

The Phase 0 correction is intentionally small. It must resolve only the minimum behavior needed for first-device trust, legitimate additional-device trust, normal staff sign-in behind that boundary, migration of existing clinics/staff, and minimum browser-demo behavior.

Recovery, contact verification, offline codes, passkey policy/management, Assistant reset/replacement, multi-clinic Doctor identity, detailed session/security policy, and the other previously discussed questions remain preserved for **Phase 8** rather than being implemented all at once.

See:

- [`PHASE_0_FOUNDATION.md`](PHASE_0_FOUNDATION.md)
- [`PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](PHASE_8_AUTHENTICATION_ADMINISTRATION.md)

## Implemented workflow

### Patients

- reusable Patient profile;
- full name, `Man`/`Woman`, country/calling code, phone, optional date of birth, optional shared Patient note;
- Iran `+98` default;
- compact flag-and-country selector with the selected calling code beside a large national-number input; on mobile the country row sits above the code-and-number row;
- one combined phone display in the Patient profile; no separate Country code or National number cards;
- search by name, phone, or date of birth updates automatically while typing;
- Doctor workspace may edit every Patient field;
- Patient creation and deletion remain Assistant-workspace actions;
- one Possible duplicate patient warning;
- internal soft deletion;
- current/future Appointments block deletion;
- five-second Patient deletion Undo;
- Role boundary and Individual access cards are removed;
- the separate Leave clinic card/action is removed; staff use the top Sign out control to leave or switch accounts.

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
- Patient-first Appointment create/edit form: after two typed name characters, existing Patients are suggested in a floating list; selecting one collapses to a compact card, otherwise the same form continues as new-Patient creation;
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

### Doctor room call, consultation handoff, and completion

```text
CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

- Doctor taps **Room ready** as a one-time ring/call;
- any current `WITH_DOCTOR` Patient becomes `DOCTOR_FINISHED`;
- `DOCTOR_FINISHED` is the final Appointment workflow state and is displayed to users as **Completed**;
- there is no separate `CHECKED_OUT` state, Checkout button, checkout queue, checkout form, or checkout timestamp;
- `doctor_finished_at` is the completion timestamp;
- the Doctor receives five-second Undo before the Assistant is notified;
- Undo Room ready restores the completed Appointment to `WITH_DOCTOR` within that existing five-second window;
- after five seconds, the Assistant receives one short sound and persistent on-screen notice;
- a smaller Room ready indicator remains after dismissal until the call is consumed;
- one pending call persists even if the queue is empty;
- first waiting Patient is suggested, but Assistant may choose any checked-in Patient;
- Assistant taps **With doctor** and consumes the pending call;
- queue sequence remains based on original check-in, while displayed positions recalculate;
- Assistant's five-second Undo restores the Patient to the queue and restores the pending call;
- `WITH_DOCTOR` disappears from the waiting queue and appears as a badge in the Appointment list;
- completed Appointments remain in the daily Appointment list and Patient history;
- Doctor consultation card shows Patient name, scheduled time, check-in time, reason, shared Patient note, and Patient-profile access;
- card expansion and dismissal are visual only and never change status;
- no Doctor Finished, Checkout, Pause, Return, or automatic-next-patient action;
- clinic-scoped transactions prevent conflicts between separate Doctor and Assistant computers.

### Shared tasks

```text
OPEN → DONE
```

- only the Doctor account creates tasks, and every task is implicitly for the Assistant;
- no assignment or self-assignment system;
- task fields: title, description, optional date-only due date, optional one-Patient association;
- clicking **New task** opens a compact modal instead of placing the create form above the Open list;
- same shared task data appears in both workspaces;
- Open tasks sort oldest first;
- the Assistant normally performs the task and taps **Done**; the Doctor may also mark Done;
- Done has five-second Undo back to Open and no permanent Reopen action after expiry;
- Done tasks leave Open and remain in History;
- Doctor creator may edit tasks;
- only Doctor may delete tasks, including completed tasks; deletion has five-second Undo;
- both staff may comment, but each may edit/delete only their own comments;
- edited comments show **Edited** without visible revision history;
- comment deletion has five-second Undo;
- optional Patient name opens the Patient profile, but tasks do not appear inside Patient profiles;
- no task attachments;
- when the Doctor creates a new task, only the Assistant account gets a small red dot beside the Tasks tab;
- when the Assistant marks a task Done, the Doctor account gets a small red dot beside the Tasks tab;
- opening Tasks clears the current account's red dot; while Tasks remains open, the same lightweight refresh keeps activity seen;
- pre-existing tasks from before the attention-dot feature are initialized as already seen;
- the red dot is an in-app attention marker only: no task sound, push notification, popup alert, email, badge count, comment alert, or due-date alert is added;
- Room ready remains the only sound/persistent notification workflow;
- browser-demo behavior mirrors backend permissions, lifecycle, attention state, and modal UX.

### Private sticky

- exactly one private scratchpad per staff account, not multiple notes;
- plain multiline text only, with no title, ordering, formatting, history, or Edited label;
- autosaves to the server while typing with no routine Saving/Saved label;
- persists across dates, reloads, and sign-ins until its owner changes or erases the text;
- erasing the content saves a blank scratchpad; there is no Delete action or Undo;
- stays fixed to the viewport throughout the owner's workspace and has no dedicated Notes tab;
- minimizes to a small movable yellow strip at the lower-right; there is no Close button;
- desktop expanded state is draggable and resizable;
- mobile minimized state is movable and expands to a full-screen editor;
- Doctor sticky appears only in Doctor workspace;
- Assistant sticky appears only for the Assistant account in Assistant workspace;
- Doctor administrator access to Assistant workspace shows neither account's sticky;
- no Patient links, reminders, attachments, search, notifications, colors, or other note system;
- browser-demo behavior mirrors backend persistence and workspace privacy.

## Phase specifications

- [`PHASE_0_FOUNDATION.md`](PHASE_0_FOUNDATION.md)
- [`PHASE_1_PATIENT_RECORDS.md`](PHASE_1_PATIENT_RECORDS.md)
- [`PHASE_2_VISITS.md`](PHASE_2_VISITS.md)
- [`PHASE_3_QUEUE.md`](PHASE_3_QUEUE.md)
- [`PHASE_4_CONSULTATION.md`](PHASE_4_CONSULTATION.md)
- [`PHASE_5_COMPLETION.md`](PHASE_5_COMPLETION.md)
- [`PHASE_6_SHARED_TASKS.md`](PHASE_6_SHARED_TASKS.md)
- [`PHASE_7_PRIVATE_NOTES.md`](PHASE_7_PRIVATE_NOTES.md)
- [`PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](PHASE_8_AUTHENTICATION_ADMINISTRATION.md)

## Current work

**Phases 1–7 remain complete. Current work has returned to Phase 0 only for the base-authentication corrective pass. No authentication correction code has been changed yet.**

Phase 8 is deferred. Its previous answers and unresolved questions remain documented and must not be lost.

External GitHub Actions and live Pages outcomes require separate confirmation.

## Next action

Before implementing the Phase 0 correction, resolve only the minimum base-authentication questions in [`PHASE_0_FOUNDATION.md`](PHASE_0_FOUNDATION.md).

Do not predetermine or pull forward Phase 8 recovery, account-management, multi-clinic, passkey-management, or broader security behavior unless one item is strictly required for the Phase 0 correction and the product owner explicitly approves it.