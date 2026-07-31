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
- Doctor credentials may open Assistant workspace;
- Doctor workspace remains focused and read-only for administration;
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
| 1 | Patient records | Implemented |
| 2 | Planned appointments | Implemented |
| 3 | Check-in and live waiting queue | Implemented |
| 4 | Doctor readiness and consultation flow | Decisions required |
| 5 | Doctor-finished indication and checkout | Partially specified |
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
- combined search;
- one duplicate warning;
- Doctor read-only and Assistant management access;
- soft deletion with five-second Undo;
- current/future Appointment deletion block.

## Phase 2 — Planned appointments

Implemented according to [`PHASE_2_VISITS.md`](PHASE_2_VISITS.md):

- Patient, date, scheduled time, optional reason;
- one Appointment type for every clinic attendance;
- same-day ad-hoc Appointment defaults to current time in the frontend;
- repeated same-day Appointments;
- inline Patient plus Appointment creation;
- Patient Appointment history;
- Doctor list visibility and Assistant management;
- legacy Visit data migration to the Appointment-only model.

## Phase 3 — Check-in and live waiting queue

Implemented according to [`PHASE_3_QUEUE.md`](PHASE_3_QUEUE.md):

```text
PLANNED → CHECKED_IN
```

- check-in time is arrival time;
- only today's Appointments can be checked in;
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

## Phase 4 — Doctor readiness and consultation flow

Confirmed transition:

```text
CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

Confirmed behavior:

- Doctor taps **Ready for first patient**;
- when ready and free, the first eligible checked-in Patient automatically becomes **With doctor**;
- there is no Assistant Prepare patient, Send in, Call next, or Start consultation action;
- **With doctor** means consultation has started;
- Doctor taps **Finished** when consultation ends;
- if another Patient is waiting and Doctor remains ready, the next eligible Patient automatically becomes **With doctor**;
- discrete status actions require the global five-second Undo behavior.

Before implementation, confirm:

- how Doctor readiness is turned off or paused;
- behavior when Doctor taps Ready with an empty queue;
- whether a Patient can return from With doctor to the queue;
- exact reversal/Undo behavior for automatic advancement;
- Doctor consultation-row information;
- Assistant visibility while a Patient is With doctor;
- whether Finished needs a confirmation in addition to Undo.

## Phase 5 — Doctor-finished indication and checkout

Confirmed transition:

```text
DOCTOR_FINISHED → CHECKED_OUT
```

Before implementation, confirm Assistant indication, multiple Patients awaiting checkout, row information, required checkout data, reversal behavior, completed visibility, and Doctor visibility of checkout completion.

No email, SMS, browser push, or external notification is added without approval.

## Phase 6 — Shared tasks

Confirmed: title, description, assignment between Doctor and Assistant, explicit Done, relevant shared visibility, comments, and no distracting completion notification.

Before implementation, confirm self-assignment, due dates, editing, completion authority, reversal, deletion, comment editing, Patient association, and attachment postponement.

## Phase 7 — Private notes

Confirmed: creator-only personal notes, save/delete, sticky-note-style text, and separation from tasks and Patient notes.

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
