# Health Hub development plan

## Working protocol

Health Hub is developed directly on `main`, one approved phase at a time.

For each phase:

1. read `PROJECT_CONTEXT.md` and the current phase specification;
2. resolve genuinely unapproved product behavior before implementation;
3. implement only the approved scope;
4. validate the backend, frontend, demo adapter, migrations, and documentation;
5. commit directly on `main`;
6. report the exact changes and stop;
7. continue only after the product owner explicitly says **continue**.

Do not create branches, pull requests, speculative features, duplicate workflows, or unapproved external dependencies.

## Product baseline

- one clinic;
- one Doctor;
- one Assistant;
- Doctor is clinic administrator;
- React and Vite frontend;
- Django REST Framework backend;
- PostgreSQL primary database;
- English-first left-to-right UI;
- browser-only adapter for the public Pages demo.

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Foundation verification | Implemented |
| 1 | Patient specification and records | Implemented |
| 2 | Planned appointments and walk-ins | Implemented |
| 3 | Arrival and live waiting queue | Decisions required |
| 4 | Doctor readiness and consultation flow | Partially specified |
| 5 | Doctor-finished indication and checkout | Partially specified |
| 6 | Shared tasks | Partially specified |
| 7 | Private notes | Partially specified |
| 8 | Daily operational estimate | Not started |
| 9 | Password recovery and clinic administration | Not started |
| 10 | Sensitive attachment architecture | Not started |
| 11 | Production hardening | Not started |
| 12 | First stable release | Not started |

## Phase 0 — Foundation verification

Implemented:

- clinic creation and shared clinic access;
- separate Doctor and Assistant accounts;
- Doctor administrator enforcement;
- one account per role per clinic;
- role workspaces;
- PostgreSQL configuration;
- authentication and authorization tests;
- normal and demo frontend builds;
- GitHub Actions quality and Pages workflows;
- visual assets and design documentation.

## Phase 1 — Patient records

Implemented according to [`PHASE_1_PATIENT_RECORDS.md`](PHASE_1_PATIENT_RECORDS.md):

- reusable Patient profile separate from Visits;
- required full name;
- `Man` / `Woman` gender;
- country calling code and normalized phone;
- Iran `+98` default;
- optional date of birth;
- optional shared Patient note;
- clinic-scoped Doctor and Assistant CRUD;
- combined search;
- one non-blocking duplicate warning;
- internal soft deletion without a visible archive state.

## Phase 2 — Planned appointments and walk-ins

Implemented according to [`PHASE_2_VISITS.md`](PHASE_2_VISITS.md):

- scheduled appointment fields: Patient, date, scheduled time, optional reason;
- walk-in fields: Patient and automatic current date;
- both roles have create, view, edit, and future-removal permission;
- Assistant-first schedule UI and Doctor-secondary access;
- past and future Visits are editable;
- only future Visits are removable;
- no Cancelled state;
- past Visits remain historical;
- repeated same-day Visits are allowed;
- Visit history appears inside the Patient profile;
- Patient suggestions show full name, phone, date of birth, and gender;
- a new Patient and Visit can be created atomically in one form;
- future Visits block Patient deletion;
- Patient snapshots preserve historical display;
- scheduled appointment time remains informational and does not determine waiting order.

## Phase 3 — Arrival and live waiting queue

Confirmed transition:

```text
PLANNED → ARRIVED
```

Confirmed rule:

- waiting order is based on actual check-in order;
- scheduled appointment time does not determine live queue order.

Before implementation, confirm:

- exact queue-row information;
- how early and late arrivals are shown;
- whether and how accidental check-in can be reversed;
- ordering when check-in timestamps are equal;
- visual distinction between planned appointments and walk-ins;
- temporary Patient unavailability behavior;
- behavior when a Patient leaves before consultation.

After approval, implement check-in, arrival timestamps, one live queue, permissions, tests, and equivalent demo behavior.

## Phase 4 — Doctor readiness and consultation flow

Confirmed transitions:

```text
ARRIVED → WITH_DOCTOR → DOCTOR_FINISHED
```

Confirmed behavior:

- Doctor taps **Ready for first patient**;
- when ready and free, the first eligible checked-in Patient automatically becomes **With doctor**;
- there is no separate Prepare patient, Send in, Call next patient, or Start consultation action;
- **With doctor** means consultation has started;
- Doctor taps **Finished** when consultation ends;
- if another Patient is waiting and the Doctor remains ready, the next eligible Patient automatically becomes **With doctor**.

Before implementation, confirm:

- readiness changes;
- empty-queue behavior;
- return-to-queue behavior;
- reversal rules;
- visible Patient information;
- timestamp presentation;
- whether finishing requires confirmation.

## Phase 5 — Doctor-finished indication and checkout

Confirmed transition:

```text
DOCTOR_FINISHED → CHECKED_OUT
```

Before implementation, confirm:

- Assistant indication design and persistence;
- multiple Patients awaiting checkout;
- checkout-list information;
- whether checkout requires data or only an action;
- reversal behavior;
- completed-Patient visibility;
- Doctor visibility of checkout completion.

No email, SMS, browser push, or external notification is added without approval.

## Phase 6 — Shared tasks

Confirmed requirements:

- title and description;
- assignment between Doctor and Assistant;
- explicit **Done** action;
- relevant shared visibility;
- comments/conversation;
- no distracting completion notification.

Before implementation, confirm:

- self-assignment;
- due dates;
- editing;
- completion authority;
- reversal;
- deletion;
- comment editing;
- Patient association;
- attachment postponement.

## Phase 7 — Private notes

Confirmed requirements:

- each role can create private personal notes;
- each note is visible only to its creator;
- notes can be saved and deleted;
- notes remain separate from tasks, Patient notes, and Patient records;
- notes are simple sticky-note-style text and do not create reminders.

Before implementation, confirm:

- titles;
- editing;
- autosave;
- deletion behavior;
- ordering;
- workspace placement.

## Phase 8 — Daily operational estimate

Begin only after consultation timing data exists.

Before implementation, approve:

- formula;
- minimum data requirement;
- historical window;
- outlier handling;
- placement;
- wording;
- role visibility.

No machine-learning model is assumed.

## Phase 9 — Password recovery and clinic administration

Before implementation, confirm:

- clinic recovery channels;
- staff recovery;
- Doctor controls over the Assistant account;
- password changes;
- account editing and disabling;
- inaccessible-Doctor recovery;
- approved email or SMS infrastructure.

No fake email or SMS behavior is permitted.

## Phase 10 — Sensitive attachment architecture

Before implementation, approve:

- storage;
- access controls;
- encryption;
- limits;
- file types;
- scanning;
- retention;
- deletion;
- backups;
- audit logging;
- Patient-information rules;
- applicable operational and legal requirements.

The interface must not claim attachments are secure before the architecture supports that claim.

## Phase 11 — Production hardening

Review and complete:

- validation coverage;
- authorization boundaries;
- database constraints and race conditions;
- error states;
- responsive layout;
- accessibility;
- security headers;
- secret management;
- backups and restoration;
- production deployment;
- logging;
- privacy;
- retention.

External monitoring, analytics, hosting, storage, or email services require approval.

## Phase 12 — First stable release

- Review the complete Doctor workflow.
- Review the complete Assistant workflow.
- Remove unfinished or unreachable UI.
- Confirm no unapproved behavior exists.
- Confirm the Pages demo uses the same frontend.
- Finalize backend deployment and architecture documentation.
- Create the first stable version only after product-owner approval.
