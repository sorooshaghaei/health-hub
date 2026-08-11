# Health Hub development plan

## Working protocol

Health Hub is developed directly on `main`, one approved phase at a time.

For each phase:

1. read `PROJECT_CONTEXT.md` and the current specifications;
2. resolve genuinely unapproved product behavior;
3. implement only the approved scope;
4. validate backend, frontend, browser adapter, migrations, tests, and documentation;
5. commit directly to `main`;
6. report exact changes and stop;
7. continue only after the product owner explicitly says **continue**.

Do not create branches, pull requests, speculative features, duplicate workflows, or unapproved dependencies.

## Product baseline

- one clinic;
- one Doctor account;
- one Assistant account;
- Doctor is clinic administrator;
- Doctor credentials may open Assistant workspace with full administrative access;
- Doctor workspace remains focused: it may edit Patient information but not create/delete Patients or administer Appointments;
- React/Vite frontend;
- Django REST Framework backend;
- PostgreSQL primary database;
- English-first left-to-right UI;
- browser-only adapter for the public Pages demo.

## Global action rule

Discrete operational and destructive actions provide a five-second server-enforced Undo. Normal form edits remain editable through the regular Edit flow.

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Foundation verification | Implemented |
| 1 | Patient records | Implemented; corrected permissions/search/phone layout |
| 2 | Planned appointments | Implemented; corrected to one Appointment per Patient per date |
| 3 | Check-in and live waiting queue | Implemented |
| 4 | Doctor room call and consultation handoff | Implemented |
| 5 | Completed consultation behavior | Implemented |
| 6 | Shared tasks | Partially specified |
| 7 | Private notes | Partially specified |
| 8 | Daily operational estimate | Not started |
| 9 | Password recovery and clinic administration | Not started |
| 10 | Sensitive attachment architecture | Not started |
| 11 | Production hardening | Not started |
| 12 | First stable release | Not started |

## Phase 0 — Foundation

Implemented clinic creation and entry, individual accounts, session-backed workspace selection, Doctor administrator status, PostgreSQL configuration, authentication tests, frontend builds, GitHub workflows, and design documentation.

## Phase 1 — Patient records

Implemented according to [`PHASE_1_PATIENT_RECORDS.md`](PHASE_1_PATIENT_RECORDS.md):

- reusable Patient profiles;
- approved fields and normalization;
- automatic search while typing;
- one duplicate warning;
- Doctor and Assistant may edit all approved Patient fields;
- Patient creation/deletion remains Assistant-workspace administration;
- Doctor administrator receives full Assistant-workspace controls when entering that workspace;
- compact flag-and-country selector with the selected calling code beside a large national-number field, using a stacked two-part mobile layout;
- one combined phone display; no separate Country code or National number cards;
- Role boundary and Individual access cards removed;
- separate Leave clinic card and browser-access clearing action removed; the top Sign out control remains;
- soft deletion with five-second Undo;
- current/future Appointment deletion block.

## Phase 2 — Planned appointments

Implemented according to [`PHASE_2_VISITS.md`](PHASE_2_VISITS.md):

- Patient, date, scheduled time, optional reason;
- one Appointment type for every clinic attendance;
- one active Appointment maximum per Patient per clinic date;
- duplicate create/edit returns the existing Appointment for opening instead of offering an override;
- a deleted Appointment reserves its Patient/date during the five-second Undo period;
- active uniqueness is protected by a database constraint and mirrored by the browser demo;
- existing active duplicates are never silently deleted or merged; migration stops for manual resolution;
- same-day ad-hoc Appointment defaults to current time in the frontend;
- Patient-first Appointment form with existing-Patient suggestions after two name characters and seamless inline new-Patient creation;
- Patient Appointment history;
- Doctor list visibility and Assistant-workspace management;
- Appointment deletion is available to Assistant workspace, including Doctor administrator access there, but not Doctor workspace;
- legacy Visit data migration to the Appointment-only model.

## Phase 3 — Check-in and live waiting queue

Implemented according to [`PHASE_3_QUEUE.md`](PHASE_3_QUEUE.md):

```text
PLANNED → CHECKED_IN
```

- only today's Appointments can be checked in;
- check-in time records the Assistant's check-in action;
- live queue contains today's checked-in Patients only;
- queue order is persisted check-in order, not scheduled time;
- deterministic sequence resolves equal timestamps;
- Assistant performs check-in and destructive actions;
- Doctor views the live queue;
- Assistant queue and Appointment list show phone; Doctor queue omits it;
- no early/late, unavailable, Left, Cancelled, or no-show state;
- checked-in Patient and date are locked while time and reason remain editable;
- Check in, Appointment deletion, and Patient deletion have five-second Undo;
- queue refresh uses three-second authenticated polling.

## Phase 4 — Doctor room call and consultation handoff

Implemented according to [`PHASE_4_CONSULTATION.md`](PHASE_4_CONSULTATION.md):

```text
CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

- Doctor taps **Room ready** as a one-time call to the Assistant;
- the current `WITH_DOCTOR` Patient, if any, becomes `DOCTOR_FINISHED`;
- the Assistant receives the call only after the Doctor's five-second Undo period;
- one pending room call persists even when the waiting queue is empty;
- the first waiting Patient is suggested, but the Assistant may choose any checked-in Patient;
- Assistant taps **With doctor** to consume the pending call;
- original check-in sequence remains unchanged and displayed positions recalculate;
- Assistant has five-second Undo for **With doctor**, restoring the Patient and pending call;
- Doctor consultation card shows scheduled time, check-in time, reason, shared Patient note, and Patient-profile access;
- opening or closing the consultation overlay never changes workflow state;
- there is no Doctor Finished, Pause, Return to queue, or automatic-next action;
- server-side clinic locks protect the workflow across separate Doctor and Assistant computers;
- browser-demo behavior and automated tests mirror the backend.

## Phase 5 — Completed consultation behavior

Implemented according to [`PHASE_5_COMPLETION.md`](PHASE_5_COMPLETION.md).

```text
PLANNED → CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

`DOCTOR_FINISHED` is the final Appointment state. It is displayed to users as **Completed**.

- there is no `CHECKED_OUT` state;
- there is no Assistant Checkout action or checkout queue;
- there is no checkout form or required checkout data;
- there is no `checked_out_at` field;
- `doctor_finished_at` remains the completion timestamp;
- the existing five-second **Undo Room ready** is the only reversal of completion and restores the Appointment to `WITH_DOCTOR`;
- completed Appointments remain visible in the daily Appointment list and Patient history;
- existing post-check-in editing and post-consultation deletion rules remain unchanged;
- no new notification, endpoint, migration, or browser-demo state is added.

## Phase 6 — Shared tasks

Confirmed: title, description, assignment between Doctor and Assistant, explicit Done, relevant shared visibility, comments, and no distracting completion notification.

Before implementation, confirm self-assignment, due dates, editing, completion authority, reversal, deletion, comment editing, Patient association, and attachment postponement.

## Phase 7 — Private notes

Confirmed: creator-only personal notes, save/delete, sticky-note-style text, and separation from tasks and shared Patient notes.

Before implementation, confirm titles, editing, autosave, ordering, deletion behavior, and workspace placement.

## Phase 8 — Daily operational estimate

Begin only after consultation timing data exists. Approve formula, minimum data, historical window, outliers, placement, wording, and role visibility. No machine-learning model is assumed.

## Phase 9 — Password recovery and clinic administration

Confirm clinic recovery, staff recovery, Doctor controls over Assistant account, password changes, account editing/disabling, inaccessible-Doctor recovery, and approved email/SMS infrastructure.

## Phase 10 — Sensitive attachment architecture

Approve storage, access controls, encryption, limits, file types, scanning, retention, deletion, backups, audit logging, Patient-information rules, and applicable requirements before implementation.

## Phase 11 — Production hardening

Review validation, authorization, constraints, race conditions, error states, responsive layout, accessibility, security headers, secrets, backups, deployment, logging, privacy, and retention.

## Phase 12 — First stable release

Review complete Doctor and Assistant workflows, remove unfinished UI, confirm no unapproved behavior, verify browser-demo parity, finalize deployment documentation, and release only after product-owner approval.
