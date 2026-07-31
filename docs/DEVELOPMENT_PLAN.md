# Health Hub development plan

## Working protocol

Health Hub is developed directly on `main` in small, reviewable phases.

For every phase:

1. Review the phase scope and identify unresolved product decisions.
2. Ask the product owner before choosing unapproved fields, screens, actions, states, permissions, libraries, algorithms, or behavior.
3. Implement only the approved scope.
4. Validate the implementation and update the GitHub Pages demo when applicable.
5. Stop and report what changed.
6. Continue only after the product owner explicitly says **continue**.

No branch, pull request, speculative feature, duplicate workflow, or unapproved external dependency should be introduced.

For a new session, start with [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md). Phase 1 behavior and its implementation record are in [`PHASE_1_PATIENT_RECORDS.md`](PHASE_1_PATIENT_RECORDS.md).

## Product baseline

- Product: Health Hub
- Initial clinic model: one clinic, one Doctor, one Assistant
- Frontend: React with Vite
- Backend: Django REST Framework
- Primary database: PostgreSQL
- Initial language: English
- Initial direction: left-to-right
- Initial calendar: Gregorian
- Doctor: clinic administrator and Doctor workflow role
- Assistant: distinct Assistant workflow role
- Public demo: the actual React frontend using a browser-only data adapter

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Foundation verification | Implemented; external Actions/Pages confirmation may be checked separately |
| 1 | Patient specification and records | Implemented; external Actions/Pages confirmation may be checked separately |
| 2 | Planned appointments and walk-ins | Product decisions not yet approved |
| 3 | Arrival and live waiting queue | Not started |
| 4 | Doctor readiness and consultation flow | Not started |
| 5 | Doctor-finished indication and checkout | Not started |
| 6 | Shared tasks | Not started |
| 7 | Private notes | Not started |
| 8 | Daily operational estimate | Not started |
| 9 | Password recovery and clinic administration | Not started |
| 10 | Sensitive attachment architecture | Not started |
| 11 | Production hardening | Not started |
| 12 | First stable release | Not started |

## Phase 0 — Foundation verification

Implemented:

- React/Vite frontend and Django REST Framework backend;
- PostgreSQL configuration;
- clinic creation and clinic-level sign-in;
- Doctor and Assistant individual accounts and sessions;
- Doctor administrator enforcement and one account per role per clinic;
- separate role workspaces;
- browser-only demo adapter;
- backend authentication tests;
- normal/demo builds, quality workflow, and Pages deployment workflow;
- setup, production-boundary, design, and continuation documentation.

No patient workflow, tasks, notes, recovery flow, notifications, or timing estimate was added in Phase 0.

## Phase 1 — Patient specification and records

Status: **Implemented.**

Source of truth: [`PHASE_1_PATIENT_RECORDS.md`](PHASE_1_PATIENT_RECORDS.md).

Implemented patient model:

- reusable clinic-scoped Patient profile, separate from future Visits;
- required full name;
- required gender: `Man` or `Woman`;
- required calling code and national phone, Iran `+98` default;
- normalized E.164 phone value;
- optional date of birth;
- optional shared Patient note;
- internal deletion timestamp without a user-visible archive state.

Implemented permissions and behavior:

- both Doctor and Assistant can create, view, search, edit, and delete active Patients;
- all access is restricted to the authenticated staff member's clinic;
- combined name, phone, and date-of-birth search;
- one **Possible duplicate patient** warning for normalized identity or similar name with the same phone;
- matching existing profiles are preferred;
- explicit separate-profile creation is allowed;
- patient names are never modified with generated suffixes;
- deleted profiles disappear from active APIs and cannot be selected;
- browser-demo behavior mirrors the backend contract.

Implemented validation and verification:

- model migration and clinic indexes;
- country-code-aware phone validation without an external dependency;
- backend API tests for both roles, search, duplicate confirmation, phone validation, clinic isolation, editing, and deletion;
- browser-adapter tests for authentication and patient CRUD/duplicate behavior;
- patient list, search, create, detail, edit, note, duplicate, and deletion UI.

Phase 1 does not implement Visits, appointments, working-day scheduling, queues, consultation flow, checkout, tasks, personal notes, notifications, or estimates.

## Phase 2 — Planned appointments and walk-ins

Do not implement until the product owner explicitly approves:

- appointment fields;
- editing and cancellation rules;
- removal of future Visits required before Patient deletion;
- past-appointment visibility;
- repeated same-day Visits;
- walk-in data requirements;
- whether a visit-reason field exists;
- exact identifying information shown in existing-patient suggestions.

After approval, implement planned appointments, walk-ins, Patient-to-Visit reuse, the daily planning interface, APIs, tests, and equivalent demo behavior.

Scheduled appointment time is informational and does not determine live waiting order.

## Phase 3 — Arrival and live waiting queue

Confirmed transition:

```text
PLANNED → ARRIVED
```

Waiting order is based on actual check-in order.

Before implementation, confirm queue-row information, early/late arrival presentation, accidental check-in reversal, equal timestamps, planned versus walk-in presentation, temporary unavailability, and patient departure before consultation.

## Phase 4 — Doctor readiness and consultation flow

Confirmed transitions:

```text
ARRIVED → WITH_DOCTOR → DOCTOR_FINISHED
```

Confirmed behavior:

- Doctor taps **Ready for first patient**.
- When ready and free, the first eligible checked-in patient automatically becomes **With doctor**.
- There is no separate Prepare patient, Send in, Call next patient, or Start consultation action.
- **With doctor** means consultation has started.
- Doctor taps **Finished** when consultation ends.
- If another patient is waiting and the Doctor remains ready, the next eligible patient automatically becomes **With doctor**.

Before implementation, confirm readiness changes, empty-queue behavior, return-to-queue behavior, reversal rules, visible patient information, timestamp presentation, and finish confirmation.

## Phase 5 — Doctor-finished indication and checkout

Confirmed transition:

```text
DOCTOR_FINISHED → CHECKED_OUT
```

Before implementation, confirm Assistant indication design and persistence, handling multiple patients awaiting checkout, checkout-list information, required checkout data, reversal, completed-patient visibility, and Doctor visibility of completion.

No email, SMS, browser-push, or external notification is added without approval.

## Phase 6 — Shared tasks

Confirmed requirements:

- title and description;
- assignment between Doctor and Assistant;
- explicit **Done** action;
- relevant shared visibility;
- comments/conversation;
- no distracting completion notification.

Before implementation, confirm self-assignment, due dates, editing, completion authority, reversal, deletion, comment editing, patient association, and whether attachments remain postponed.

## Phase 7 — Private notes

Confirmed requirements:

- each role can create private personal notes;
- each note is visible only to its creator;
- notes can be saved and deleted;
- notes remain separate from tasks, Patient notes, and patient records;
- notes are simple sticky-note-style text and do not create reminders.

Before implementation, confirm titles, editing, autosave, deletion behavior, ordering, and workspace placement.

## Phase 8 — Daily operational estimate

Begin only after consultation timing data exists.

Before implementation, approve the formula, minimum data requirement, historical window, outlier handling, placement, wording, and role visibility. No machine-learning model is assumed.

## Phase 9 — Password recovery and clinic administration

Before implementation, confirm clinic recovery channels, staff recovery, Doctor controls over the Assistant account, password changes, account editing, disabling, inaccessible-Doctor recovery, and approved email/SMS infrastructure.

No fake email or SMS behavior is permitted.

## Phase 10 — Sensitive attachment architecture

Before implementation, approve storage, access controls, encryption, limits, file types, scanning, retention, deletion, backups, audit logging, patient-information rules, and applicable operational/legal requirements.

The interface must not claim attachments are secure before the architecture supports that claim.

## Phase 11 — Production hardening

Review and complete validation coverage, authorization boundaries, database constraints and race conditions, error states, responsive layout, accessibility, security headers, secret management, backups/restoration, production deployment, logging, privacy, and retention decisions.

External monitoring, analytics, hosting, storage, or email services require approval.

## Phase 12 — First stable release

- Review the complete Doctor workflow.
- Review the complete Assistant workflow.
- Remove unfinished or unreachable UI.
- Confirm no unapproved behavior exists.
- Confirm the Pages demo uses the same product frontend.
- Finalize backend deployment and architecture documentation.
- Create the first stable version only after product-owner approval.
