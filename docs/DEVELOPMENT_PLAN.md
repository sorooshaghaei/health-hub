# Health Hub development plan

## Working protocol

Health Hub is developed directly on `main`, one approved phase or corrective pass at a time.

For each approved unit:

1. read `PROJECT_CONTEXT.md` and the relevant phase specification;
2. ask the product owner about unresolved behavior before implementation;
3. update the phase specification to the approved current contract;
4. align implementation when the approved contract changes behavior;
5. validate backend, frontend, browser adapter, migrations, tests, and documentation;
6. commit directly to `main`;
7. report the result and move to the next phase only after the current one is clear.

Do not create branches, pull requests, speculative features, duplicate workflows, or unapproved dependencies.

## Product baseline

- global personal staff accounts with clinic memberships;
- clinic workflow with Doctor and Assistant membership roles;
- at most one active Doctor and one active Assistant per clinic;
- Doctor membership may open Doctor or Assistant workspace;
- Assistant membership may open Assistant workspace only;
- Doctor workspace clinically focused;
- Assistant workspace owns Patient/Appointment administration;
- clinic operational data strictly tenant-scoped;
- React/Vite frontend;
- Django REST Framework backend;
- PostgreSQL primary database;
- GitHub Pages renders the same production React UI and substitutes only a browser-local API/storage adapter.

## Global action rule

Discrete operational/destructive workflow actions use the approved five-second server-enforced Undo. Normal form edits remain editable through the regular Edit flow.

Security/account actions do not use five-second Undo.

## Reconciliation status

The Phase 0–8 implementation already exists. Before Phase 9, the product owner requested a line-by-line correction of all Phase 0–8 specifications and corresponding implementation differences.

| Phase | Scope | Reconciliation status |
| --- | --- | --- |
| 0 | Foundation | **Specification corrected; implementation aligned** |
| 1 | Patient records | **Specification corrected; implementation already aligned** |
| 2 | Planned appointments | **Specification corrected; implementation already aligned** |
| 3 | Check-in and live queue | **Specification corrected; implementation aligned** |
| 4 | Doctor room call and consultation handoff | Next clarification target |
| 5 | Completed consultation behavior | Awaiting reconciliation |
| 6 | Shared tasks | Awaiting reconciliation |
| 7 | Private sticky | Awaiting reconciliation |
| 8 | Account recovery, administration, multi-clinic identity, security | Awaiting final reconciliation |
| 9 | Sensitive attachment architecture | Not started |
| 10 | Production hardening | Not started |
| 11 | First stable release | Not started |

Do not treat Phase 9 as the next implementation phase until Phase 4–8 reconciliation and the final repository-wide consistency audit are complete.

## Phase 0 — Foundation

Current approved foundation:

- no shared clinic password;
- no active username login;
- global personal accounts;
- clinic-specific Doctor/Assistant memberships;
- trusted-device authorization per clinic;
- first browser automatically trusted when a clinic is created;
- verified email/SMS authorization and six-digit trusted-device pairing are both supported for another browser;
- clinic-bound bearer session requires matching trusted-device proof;
- other trusted devices may be removed;
- **the current trusted device cannot be removed**;
- sign-out ends the staff session but does not untrust the browser;
- production and Pages use the same React product UI.

See [`PHASE_0_FOUNDATION.md`](PHASE_0_FOUNDATION.md).

## Phase 1 — Patient records

Current approved contract:

- reusable Patient records are clinic-scoped;
- the same physical person in two clinics remains two independent Patient records;
- full name, `Man`/`Woman`, country/calling code, phone, optional DOB, optional shared Patient note;
- Iran `+98` default;
- automatic search and one duplicate warning;
- Doctor workspace may edit approved Patient information;
- Assistant workspace may create/edit/delete Patients;
- Doctor membership in Assistant workspace receives the same Patient administration controls;
- current/future Appointments block Patient deletion;
- deletion has five-second Undo.

See [`PHASE_1_PATIENT_RECORDS.md`](PHASE_1_PATIENT_RECORDS.md).

## Phase 2 — Appointments

Current approved contract:

- Patient, date, scheduled time, optional reason;
- one active Appointment maximum per clinic Patient per clinic date;
- Patient-first create/edit UI;
- unplanned same-day arrival is represented by a normal same-day Appointment followed by check-in;
- Appointment data/history are independent between clinics;
- Assistant workspace administers Appointments;
- Doctor workspace is read-only for Appointment administration;
- approved edit locks apply after check-in;
- deletion has five-second Undo.

See [`PHASE_2_VISITS.md`](PHASE_2_VISITS.md).

## Phase 3 — Check-in and live queue

```text
PLANNED → CHECKED_IN
```

Current approved contract:

- each clinic stores one operational IANA timezone;
- timezone is captured automatically from the browser when the clinic is created;
- no manual timezone field is required in the normal clinic-creation UI;
- the stored clinic timezone determines operational **today**;
- today's Appointment list, check-in eligibility, queue membership, and consultation-day boundaries use that clinic timezone;
- a travelling staff browser does not change the clinic's operational day;
- queue data and queue sequence are independent per clinic;
- Assistant workspace performs check-in and queue operations;
- Doctor membership in Assistant workspace has the same Assistant-side controls;
- Doctor workspace views the queue read-only;
- queue ordering is the original persisted check-in sequence;
- Assistant queue shows Patient phone; Doctor queue omits phone;
- after check-in, Patient and Appointment date are locked while scheduled time/reason/Patient profile corrections remain allowed;
- check-in has server-enforced five-second Undo;
- live refresh uses authenticated three-second polling.

Implementation alignment added persisted `Clinic.timezone`, migration `accounts.0008_clinic_timezone`, request-scoped clinic timezone activation/reset, frontend browser-timezone capture, Pages/demo timezone parity, and regression coverage.

See [`PHASE_3_QUEUE.md`](PHASE_3_QUEUE.md).

## Phase 4 — Room ready and consultation handoff

Existing implementation is present, but its specification is the next item to reconcile with the final membership, clinic-isolation, and clinic-timezone architecture.

Do not change Phase 4 behavior until the product owner answers the Phase 4 clarification questions.

See [`PHASE_4_CONSULTATION.md`](PHASE_4_CONSULTATION.md).

## Phase 5 — Completion

Existing implementation uses `DOCTOR_FINISHED` as final **Completed** state with no Checkout workflow. Reconcile the specification after Phase 4 is closed.

See [`PHASE_5_COMPLETION.md`](PHASE_5_COMPLETION.md).

## Phase 6 — Shared tasks

Existing implementation uses `OPEN → DONE`, Doctor-to-Assistant task workflow, comments, History, attention indicators, and five-second Undo for approved discrete actions. Reconcile membership terminology and attention-state scope when Phase 6 is reached.

See [`PHASE_6_SHARED_TASKS.md`](PHASE_6_SHARED_TASKS.md).

## Phase 7 — Private sticky

Existing implementation provides one global plain-text private scratchpad per personal account with strict workspace privacy. Reconcile membership/workspace terminology when Phase 7 is reached.

See [`PHASE_7_PRIVATE_NOTES.md`](PHASE_7_PRIVATE_NOTES.md).

## Phase 8 — Account recovery, administration, and security

The global account/membership architecture, email/phone login, verified contacts, trusted-device authorization, recovery, passkeys, Assistant administration, multi-clinic support, and Pages UI parity are implemented.

Phase 8 must still be reconciled after Phases 4–7 because older wording includes rules superseded during this pass, including trusted-device removal. Remaining Phase 8 security/recovery ambiguities must be clarified rather than silently inferred.

See [`PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](PHASE_8_AUTHENTICATION_ADMINISTRATION.md).

## Phase 9 — Sensitive attachment architecture

**Not started.**

Before implementation, explicitly approve at least:

- which records may receive attachments;
- storage architecture and private access model;
- encryption expectations;
- file types and size/count limits;
- upload/download/delete permissions by role/workspace;
- malware/content scanning;
- filenames/metadata handling;
- retention and deletion behavior;
- backup/restore implications;
- audit requirements;
- Patient-information/privacy boundaries;
- production deployment constraints.

## Phase 10 — Production hardening

Review validation, authorization, constraints, race conditions, error states, accessibility, security headers, secrets, backups, deployment, logging, privacy, retention, production communication providers, and production recovery behavior.

## Phase 11 — First stable release

Review the complete Doctor/Assistant workflows, remove unfinished UI, confirm no unapproved behavior, verify browser-demo parity, finalize deployment documentation, and release only after product-owner approval.

## Current work

**Phase 0–3 reconciliation is complete. Phase 4 clarification is next.**
