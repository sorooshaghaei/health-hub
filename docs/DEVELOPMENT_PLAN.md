# Health Hub development plan

## Working protocol

Health Hub is developed directly on `main`, one approved phase at a time.

For each phase or explicitly approved corrective pass:

1. read `PROJECT_CONTEXT.md` and the current specifications;
2. resolve genuinely unapproved product behavior;
3. implement only the approved scope;
4. validate backend, frontend, browser adapter, migrations, tests, and documentation;
5. commit directly to `main`;
6. report exact changes and stop;
7. continue only after the product owner explicitly says **continue**.

Do not create branches, pull requests, speculative features, duplicate workflows, or unapproved dependencies.

## Product baseline

- one clinic workflow with Doctor and Assistant roles;
- Doctor is clinic administrator;
- Doctor credentials may open Assistant workspace with full administrative access;
- Doctor workspace remains clinically focused: it may edit Patient information but not create/delete Patients or administer Appointments;
- React/Vite frontend;
- Django REST Framework backend;
- PostgreSQL primary database;
- English-first left-to-right UI;
- browser-only adapter for the public Pages demo.

## Global action rule

Discrete operational and destructive actions provide a five-second server-enforced Undo. Normal form edits remain editable through the regular Edit flow.

Security/account actions are outside this global Undo rule unless explicitly approved otherwise.

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Foundation | Implemented; reopened only for base authentication correction |
| 1 | Patient records | Implemented; corrected permissions/search/phone layout |
| 2 | Planned appointments | Implemented; corrected to one Appointment per Patient per date |
| 3 | Check-in and live waiting queue | Implemented |
| 4 | Doctor room call and consultation handoff | Implemented |
| 5 | Completed consultation behavior | Implemented |
| 6 | Shared tasks | Implemented; attention-dot and New Task modal UX correction included |
| 7 | Private notes | Implemented as one private sticky scratchpad per account/workspace |
| 8 | Account recovery, administration, and security | Not started; prior decisions/questions preserved |
| 9 | Sensitive attachment architecture | Not started |
| 10 | Production hardening | Not started |
| 11 | First stable release | Not started |

## Phase 0 — Foundation and base authentication correction

The implemented foundation includes clinic creation/entry, staff accounts, session-backed workspace selection, Doctor administrator status, PostgreSQL configuration, frontend/backend foundation, browser demo, tests, and repository workflows.

The original authentication implementation uses two layers:

1. clinic email + shared clinic password;
2. individual staff username + staff password.

The shared clinic-password layer is no longer the intended final boundary.

The project is therefore returning to Phase 0 for a **small corrective pass before Phase 8**. This correction does not reopen Phases 1–7 and must not change their product behavior.

Approved architectural direction:

- keep the clinic as the tenant/container for clinic data;
- remove the shared clinic password from normal daily authentication;
- gate normal clinic access through a trusted clinic device/browser;
- keep trusted-device authorization separate from staff login sessions;
- keep the Doctor/Assistant role-selection step;
- keep Doctor and Assistant individually authenticated;
- block clinic/Patient-data access from untrusted devices;
- block remote access from an untrusted device.

The Phase 0 corrective pass is intentionally limited to the minimum base-authentication work needed to make that architecture functional and migrate the existing implementation safely.

Before implementation, clarify only the base-authentication questions that are actually required for this correction: first-device trust, minimum additional-device authorization, normal staff sign-in behind the trusted-device boundary, migration of existing clinics/staff, and minimum browser-demo entry behavior.

Do **not** require the full Phase 8 recovery/account-management design before completing this corrective pass.

See [`PHASE_0_FOUNDATION.md`](PHASE_0_FOUNDATION.md).

## Phase 1 — Patient records

Implemented according to [`PHASE_1_PATIENT_RECORDS.md`](PHASE_1_PATIENT_RECORDS.md):

- reusable Patient profiles;
- full name, `Man`/`Woman`, country/calling code, phone, optional date of birth, optional shared Patient note;
- Iran `+98` default;
- compact flag-and-country selector with selected calling code beside national number, stacking cleanly on mobile;
- one combined phone display;
- automatic search while typing by name, phone, or date of birth;
- Doctor and Assistant may edit all approved Patient fields;
- Patient creation/deletion remains Assistant-workspace administration;
- Doctor administrator receives full Assistant-workspace controls there;
- one Possible duplicate patient warning;
- internal soft deletion with five-second Undo;
- current/future Appointments block Patient deletion;
- Role boundary and Individual access cards removed;
- separate Leave clinic action removed; top Sign out remains.

## Phase 2 — Planned appointments

Implemented according to [`PHASE_2_VISITS.md`](PHASE_2_VISITS.md):

- Patient, date, scheduled time, optional reason;
- one Appointment type for every clinic attendance;
- one active Appointment maximum per Patient per clinic date;
- duplicate create/edit returns the existing Appointment for opening rather than offering override;
- a deleted Appointment reserves its Patient/date during the five-second Undo period;
- database uniqueness and browser-demo validation enforce the same rule;
- migration never silently merges/deletes duplicates and stops for manual resolution when required;
- same-day ad-hoc Appointment defaults to current time in the frontend;
- Patient-first Appointment create/edit form with existing-Patient suggestions and seamless inline new-Patient creation;
- Patient Appointment history;
- Doctor list visibility and Assistant-workspace management;
- Appointment create/edit/delete controls exist in Assistant workspace, including Doctor administrator access there, but not Doctor workspace;
- legacy Visit data migrated to the Appointment-only model.

## Phase 3 — Check-in and live waiting queue

Implemented according to [`PHASE_3_QUEUE.md`](PHASE_3_QUEUE.md).

```text
PLANNED → CHECKED_IN
```

- only today's Appointments can check in;
- check-in timestamp records the actual check-in action;
- live queue contains today's checked-in Patients only;
- queue order is persisted check-in order, not scheduled time;
- deterministic sequence resolves equal timestamps;
- Assistant performs check-in and destructive actions;
- Doctor views the live queue;
- Assistant queue and Appointment list show phone; Doctor queue omits phone;
- no early/late, unavailable, Left, Cancelled, or no-show state;
- checked-in Patient and date are locked while scheduled time and reason remain editable;
- Check in, Appointment deletion, and Patient deletion use server-enforced five-second Undo;
- live operational state refreshes every three seconds.

## Phase 4 — Doctor room call and consultation handoff

Implemented according to [`PHASE_4_CONSULTATION.md`](PHASE_4_CONSULTATION.md).

```text
CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

- Doctor taps **Room ready** as a one-time call to the Assistant;
- any current `WITH_DOCTOR` Patient becomes `DOCTOR_FINISHED`;
- Assistant receives the call only after the Doctor's five-second Undo period;
- one pending room call persists even when the queue is empty;
- first waiting Patient is suggested, but Assistant may choose any checked-in Patient;
- Assistant taps **With doctor** to consume the pending call;
- original check-in sequence remains unchanged and displayed positions recalculate;
- Assistant has five-second Undo for **With doctor**, restoring the Patient and pending call;
- Doctor consultation card shows scheduled time, check-in time, reason, shared Patient note, and Patient-profile access;
- opening or closing consultation UI never changes workflow state;
- no Doctor Finished, Pause, Return to queue, or automatic-next action;
- clinic-scoped server transactions protect separate Doctor and Assistant computers;
- browser demo and automated tests mirror backend behavior.

## Phase 5 — Completed consultation behavior

Implemented according to [`PHASE_5_COMPLETION.md`](PHASE_5_COMPLETION.md).

```text
PLANNED → CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

`DOCTOR_FINISHED` is final and displayed to users as **Completed**.

- no `CHECKED_OUT` state;
- no Assistant Checkout action or checkout queue;
- no checkout form or required checkout data;
- no `checked_out_at` field;
- `doctor_finished_at` remains the completion timestamp;
- existing five-second **Undo Room ready** is the only reversal of completion and restores to `WITH_DOCTOR`;
- completed Appointments remain visible in daily Appointment list and Patient history;
- existing post-check-in editing and post-consultation deletion rules remain unchanged;
- no new notification, endpoint, migration, or browser-demo state was added for Phase 5.

## Phase 6 — Shared tasks

Implemented according to [`PHASE_6_SHARED_TASKS.md`](PHASE_6_SHARED_TASKS.md).

```text
OPEN → DONE
```

- only Doctor creates tasks and every task is implicitly for Assistant;
- no assignment/self-assignment system and no task-for-Doctor workflow;
- task fields: title, description, optional date-only due date, optional single Patient association;
- **New task** opens a compact modal rather than moving the Open list;
- both workspaces see the same clinic-scoped task data;
- Open tasks sort oldest first;
- Done tasks leave Open and remain in History;
- Assistant normally performs Done; Doctor may also mark Done;
- Done has five-second Undo back to Open and no permanent Reopen after expiry;
- Doctor creator may edit tasks;
- only Doctor may delete tasks, including completed tasks, with five-second Undo;
- Doctor and Assistant may comment, each editing/deleting only their own comments;
- edited comments show **Edited**; comment deletion has five-second Undo;
- optional Patient name opens Patient profile, but tasks do not appear in Patient profiles;
- no task attachments;
- new Doctor-created task gives Assistant a small red Tasks-tab attention dot;
- Assistant-completed task gives Doctor a small red Tasks-tab attention dot;
- opening Tasks clears current account's dot and active Tasks view stays seen;
- pre-existing tasks were initialized as already seen;
- attention dot is not a notification system: no sound, push, popup, email, badge count, comment alert, or due-date alert;
- browser demo mirrors backend behavior.

## Phase 7 — Private notes

Implemented according to [`PHASE_7_PRIVATE_NOTES.md`](PHASE_7_PRIVATE_NOTES.md):

- one private persistent scratchpad per staff account rather than a notes collection;
- plain multiline text with no title, ordering, formatting, history, or Edited label;
- autosave while typing and blank-content persistence when erased;
- fixed viewport placement with movable minimized strip and no Close action;
- draggable/resizable expanded desktop sticky;
- movable minimized mobile strip and full-screen mobile editor;
- Doctor sticky only in Doctor workspace;
- Assistant sticky only for Assistant account in Assistant workspace;
- Doctor administrator access to Assistant workspace shows neither private sticky;
- no Patient links, reminders, attachments, search, notifications, color choices, or routine save-status indicator;
- browser demo and automated tests mirror backend persistence and authorization.

## Phase 8 — Account recovery, administration, and security

Phase 8 is not implemented.

The previously discussed questions and approved answers are preserved in [`PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](PHASE_8_AUTHENTICATION_ADMINISTRATION.md), but Phase 8 is intentionally deferred until after the smaller Phase 0 base-authentication correction.

Phase 8 owns the complicated account/security lifecycle, including:

- forgotten-password recovery;
- email/SMS verification and contact changes;
- offline Doctor recovery codes;
- passkey/device-biometric account policy and management;
- staff session policy;
- Doctor administration/reset of Assistant account;
- replacement-Assistant onboarding and historical-account handling;
- multi-clinic Doctor identity/membership;
- password/security internals and hardening decisions;
- final demo behavior for account/recovery features.

Do not implement Phase 8 while the project is performing the Phase 0 corrective pass.

## Phase 9 — Sensitive attachment architecture

Approve storage, access controls, encryption, limits, file types, scanning, retention, deletion, backups, audit logging, Patient-information rules, and applicable requirements before implementation.

## Phase 10 — Production hardening

Review validation, authorization, constraints, race conditions, error states, responsive layout, accessibility, security headers, secrets, backups, deployment, logging, privacy, and retention.

## Phase 11 — First stable release

Review complete Doctor and Assistant workflows, remove unfinished UI, confirm no unapproved behavior, verify browser-demo parity, finalize deployment documentation, and release only after product-owner approval.

## Current work

**Current work is the Phase 0 base-authentication corrective pass. No Phase 0 correction code has been changed yet.**

Next: resolve only the small set of Phase 0 authentication questions in [`PHASE_0_FOUNDATION.md`](PHASE_0_FOUNDATION.md), then implement that correction, validate it, update documentation, commit, and stop before Phase 8.