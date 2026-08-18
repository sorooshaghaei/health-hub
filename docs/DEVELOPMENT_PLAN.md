# Health Hub development plan

## Working protocol

Health Hub is developed directly on `main`, one approved phase or corrective pass at a time.

For each approved unit:

1. read `PROJECT_CONTEXT.md` and the relevant phase specification;
2. ask about unresolved product behavior before implementation;
3. update the phase specification to the approved current contract;
4. align implementation when the approved contract changes behavior or stale architecture terminology;
5. validate affected backend/frontend/demo/tests/documentation;
6. commit directly to `main`;
7. move to the next phase only after the current phase is reconciled.

Do not create branches, pull requests, speculative features, duplicate workflows, or unapproved dependencies.

## Product baseline

- global personal `StaffUser` accounts;
- clinic-specific `StaffMembership` roles;
- one active Doctor and one active Assistant membership maximum per clinic;
- Doctor membership may open Doctor or Assistant workspace;
- Assistant membership may open Assistant workspace only;
- clinic operational data strictly tenant-scoped;
- one stored operational IANA timezone per clinic;
- React/Vite frontend;
- Django REST Framework backend;
- PostgreSQL primary database;
- GitHub Pages renders the same production React UI through a browser-local API/storage adapter.

## Global action rule

Discrete operational/destructive workflow actions use the approved five-second server-enforced Undo. Normal form edits remain editable through regular Edit flows.

Security/account actions do not use five-second Undo.

## Reconciliation status

The Phase 0–8 implementation already exists. Before Phase 9, all Phase 0–8 specifications and implementation assumptions are being reconciled to the final architecture.

| Phase | Scope | Reconciliation status |
| --- | --- | --- |
| 0 | Foundation | **Specification corrected; implementation aligned** |
| 1 | Patient records | **Specification corrected; implementation already aligned** |
| 2 | Planned appointments | **Specification corrected; implementation already aligned** |
| 3 | Check-in and live queue | **Specification corrected; implementation aligned** |
| 4 | Doctor room call and consultation handoff | **Specification corrected; implementation already aligned; coverage strengthened** |
| 5 | Completed consultation behavior | **Specification corrected; implementation already aligned** |
| 6 | Shared tasks | **Specification corrected; implementation/terminology aligned; coverage strengthened** |
| 7 | Private sticky | Next clarification target |
| 8 | Account recovery, administration, multi-clinic identity, security | Awaiting final reconciliation |
| 9 | Sensitive attachment architecture | Not started |
| 10 | Production hardening | Not started |
| 11 | First stable release | Not started |

Do not begin Phase 9 until Phase 7–8 reconciliation and the final repository-wide consistency audit are complete.

## Phase 0 — Foundation

Current contract:

- no shared clinic password;
- no active username login;
- global personal accounts + clinic memberships;
- trusted-device authorization per clinic;
- first browser trusted automatically on clinic creation;
- new browser via verified email/SMS or six-digit pairing;
- clinic-bound bearer session requires matching device proof;
- other trusted devices may be removed;
- **current trusted device cannot be removed**;
- sign-out preserves device trust;
- production and Pages use the same React UI.

See [`PHASE_0_FOUNDATION.md`](PHASE_0_FOUNDATION.md).

## Phase 1 — Patient records

Current contract:

- clinic-scoped reusable Patient records;
- full name, `Man`/`Woman`, calling code + phone, optional DOB, optional shared Patient note;
- Iran `+98` default;
- automatic search + one duplicate warning;
- Doctor workspace may edit approved Patient data;
- Assistant workspace administers Patient creation/deletion;
- Doctor in Assistant workspace receives Assistant-side administration controls;
- current/future Appointments block Patient deletion;
- deletion has five-second Undo;
- Patient records never merge across clinics.

See [`PHASE_1_PATIENT_RECORDS.md`](PHASE_1_PATIENT_RECORDS.md).

## Phase 2 — Appointments

Current contract:

- Patient, date, scheduled time, optional reason;
- one active Appointment maximum per Patient per clinic date;
- unplanned same-day arrival = normal same-day Appointment followed by check-in;
- Assistant workspace administers Appointments;
- Doctor workspace is read-only for Appointment administration;
- Patient/date lock after check-in;
- scheduled time/reason remain correctable;
- eligible deletion has five-second Undo.

See [`PHASE_2_VISITS.md`](PHASE_2_VISITS.md).

## Phase 3 — Check-in and live queue

```text
PLANNED → CHECKED_IN
```

Current contract:

- each clinic stores an operational IANA timezone captured automatically from the creating browser;
- that timezone defines clinic-operational **today**;
- check-in only for clinic-today Appointments;
- persisted original check-in sequence controls queue order;
- Assistant queue shows Patient phone; Doctor queue omits it;
- queue state is clinic-scoped;
- check-in has five-second Undo;
- three-second authenticated polling.

Implementation alignment added `Clinic.timezone`, migration `accounts.0008_clinic_timezone`, request-scoped timezone activation/reset, frontend capture, demo parity, and regression coverage.

See [`PHASE_3_QUEUE.md`](PHASE_3_QUEUE.md).

## Phase 4 — Room ready and consultation handoff

```text
CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

Current contract:

- Room ready requires Doctor membership + Doctor workspace;
- Doctor administrator access in Assistant workspace cannot Room ready;
- With doctor is an Assistant-workspace action, including Doctor administrator access;
- one pending Room-ready call maximum per clinic;
- five-second Undo before Assistant notification;
- one short sound + persistent visual indication after Undo expiry;
- first waiting Patient suggested, any checked-in Patient allowed;
- With doctor has five-second Undo and preserves original queue sequence;
- clinic operational timezone controls the active consultation day;
- three-second polling remains the synchronization mechanism.

See [`PHASE_4_CONSULTATION.md`](PHASE_4_CONSULTATION.md).

## Phase 5 — Completion

`DOCTOR_FINISHED` is final and displayed as **Completed**.

Current contract:

- no Checkout state/action/form/queue/timestamp;
- next Room ready completes the current `WITH_DOCTOR` Appointment;
- `doctor_finished_at` is the completion timestamp;
- five-second Undo Room ready is the only reversal;
- after expiry, Completed cannot reopen;
- Completed remains in date list + Patient history but leaves live queue/current Doctor card;
- Patient/date remain locked; scheduled time/reason/Patient profile corrections remain allowed;
- Completed Appointments cannot be deleted;
- clinic operational timezone governs clinic-day history/completion boundaries.

See [`PHASE_5_COMPLETION.md`](PHASE_5_COMPLETION.md).

## Phase 6 — Shared tasks

```text
OPEN → DONE
```

Current contract:

- tasks are strictly clinic-scoped Doctor-to-Assistant work;
- Doctor membership can create tasks from Doctor or Assistant workspace;
- Assistant membership cannot create/edit/delete tasks;
- only the personal creator may edit an existing task;
- active Doctor membership may delete Open or Done tasks in that clinic;
- Doctor or Assistant may mark Done;
- Done has five-second Undo and no permanent Reopen after expiry;
- Doctor completion does not create a Doctor self-attention dot;
- Assistant dot = new Doctor-created task since that membership last viewed Tasks;
- Doctor dot = Assistant-completed task since that membership last viewed Tasks;
- seen state is stored per `StaffMembership` and never clears another clinic;
- optional due date is date-only with no overdue workflow/reminders;
- optional Patient link must belong to the same clinic;
- comments are available on Open and Done tasks;
- only each personal comment author may edit/delete their comment;
- former Assistant authorship remains historical after membership replacement;
- task deletion and comment deletion have five-second Undo;
- New Task remains a compact modal;
- no task sound/popup/push/email/SMS/comment/due-date alert;
- three-second polling remains.

Reconciliation also replaced stale task-code account terminology with membership terminology and strengthened regression coverage for membership semantics.

See [`PHASE_6_SHARED_TASKS.md`](PHASE_6_SHARED_TASKS.md).

## Phase 7 — Private sticky

Existing implementation provides one global plain-text scratchpad per personal account, autosaved and private, with desktop/mobile sticky behavior.

Reconcile next:

- membership/workspace visibility language;
- cross-clinic behavior;
- Doctor administrator access privacy;
- whether current implementation already matches the approved final rules.

Do not change Phase 7 behavior until these decisions are approved.

See [`PHASE_7_PRIVATE_NOTES.md`](PHASE_7_PRIVATE_NOTES.md).

## Phase 8 — Account recovery, administration, and security

Implemented architecture includes global accounts, memberships, email/phone login, verified contacts, trusted-device authorization, recovery, passkeys, Assistant membership management, multi-clinic support, and Pages UI parity.

Final reconciliation must resolve remaining explicit questions rather than infer them, including:

- Doctor-generated Assistant emergency recovery when email/SMS access is lost;
- whether recent login itself satisfies contact-change reauthentication or a fresh password/passkey prompt is required;
- whether general login/auth throttling belongs in Phase 8 or Phase 10;
- all stale trusted-device wording, including the now-approved current-device non-removal rule.

See [`PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](PHASE_8_AUTHENTICATION_ADMINISTRATION.md).

## Phase 9 — Sensitive attachment architecture

**Not started.**

Before implementation, approve storage, access control, encryption, file types/limits, malware scanning, retention/deletion, backups, audit, Patient privacy boundaries, and deployment constraints.

## Phase 10 — Production hardening

Review authorization, validation, race conditions, accessibility, security headers, secrets, backups, logging/audit, monitoring, privacy/retention, recovery operations, production communication providers, and deployment.

## Phase 11 — First stable release

Review the complete Doctor/Assistant workflow, remove unfinished UI, confirm no unapproved behavior, verify demo parity, finalize deployment documentation, and release only after approval.

## Current work

**Phase 0–6 reconciliation is complete. Phase 7 clarification is next.**
