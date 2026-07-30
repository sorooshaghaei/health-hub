# Health Hub development plan

## Working protocol

Health Hub is developed directly on `main` in small, reviewable phases.

For every phase:

1. Review the phase scope and identify unresolved product decisions.
2. Ask the product owner before choosing fields, screens, actions, states, permissions, libraries, algorithms, or behavior that have not already been approved.
3. Implement only the approved scope.
4. Validate the implementation and update the GitHub Pages demo when applicable.
5. Stop and report what changed.
6. Continue only after the product owner explicitly says **continue**.

No branch, pull request, speculative feature, duplicate workflow, or unapproved external dependency should be introduced.

For a new development session, start with [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md). Detailed approved Phase 1 behavior is recorded in [`PHASE_1_PATIENT_RECORDS.md`](PHASE_1_PATIENT_RECORDS.md).

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
- Assistant: Assistant workflow role; administrator permission remains separate from workflow behavior
- Public demo: the actual React frontend using a browser-only data adapter when backend services are unavailable

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Foundation verification | Implemented; current Actions and public URL confirmation pending |
| 1 | Patient specification and records | Specification approved; implementation not started |
| 2 | Planned appointments and walk-ins | Not started |
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

### Approved scope

- React and Vite frontend
- Django REST Framework backend
- PostgreSQL configuration
- Clinic creation and clinic-level sign-in
- Doctor and Assistant individual account creation and sign-in
- Doctor as clinic administrator
- Separate Doctor and Assistant workspaces
- GitHub Pages deployment of the actual frontend
- Browser-only demo adapter for static hosting
- Backend authentication tests
- Local setup documentation

### Completion criteria

- Frontend application build succeeds.
- GitHub Pages demo build succeeds.
- Django system checks succeed.
- No missing Django migrations are detected.
- Django tests succeed against PostgreSQL.
- Initial migrations apply successfully to PostgreSQL.
- GitHub Pages deployment succeeds and the public URL serves the frontend.
- README setup and verification instructions match the repository.
- Documentation contains no obsolete or unapproved workflow assumptions.

### Implementation record

Completed in the repository:

- normal and demo frontend build commands;
- browser-only demo adapter for the approved clinic and staff access flow;
- dependency-free Node test for the browser demo authentication flow;
- Django authentication and authorization tests;
- PostgreSQL 17 CI service, migration validation, system checks, and backend tests;
- GitHub Pages deployment workflow;
- setup, production-boundary, design, and development-plan documentation;
- removal of unapproved workflow assumptions from design documentation.

The repository-level implementation is complete. The latest push-triggered Actions results and the live Pages response must still be confirmed from GitHub because they are external deployment outcomes rather than repository code.

No patient workflow, tasks, notes, recovery flow, notifications, or timing estimate was added in this phase.

## Phase 1 — Patient specification and records

Status: **Product specification approved; implementation not started.**

The complete source of truth is [`PHASE_1_PATIENT_RECORDS.md`](PHASE_1_PATIENT_RECORDS.md).

### Approved patient model

A **Patient** is the permanent reusable person profile. A **Visit** is one clinic attendance on a working day. A returning patient reuses the existing Patient profile and later receives another Visit; Health Hub must not create a new Patient record for every attendance.

Approved fields:

- full name — required;
- gender — required, with values `Man` and `Woman`;
- country calling code — required, with Iran `+98` selected by default for now;
- phone number — required and validated using the selected country calling code;
- date of birth — optional;
- Patient note — optional, plain text, visible and editable by both Doctor and Assistant.

No address, email, reminder, notification, or additional patient field is approved for Phase 1.

### Approved permissions

Both Doctor and Assistant may create, view, search, edit, and delete Patient profiles. Both roles may view and edit the Patient note. Doctor access is not limited to visit-only information.

The Patient note is distinct from Phase 7 personal sticky notes. Phase 7 Doctor and Assistant personal notes remain creator-only and do not create reminders.

### Approved search and duplicate behavior

Patient search combines name, phone number, and date of birth.

Use one simple non-blocking warning: **Possible duplicate patient**. It applies when:

- normalized full name, phone number, and date of birth indicate the same patient;
- or a similar name uses the same phone number.

When date of birth is empty, normalized full name plus phone number is sufficient. The user may choose the existing profile or explicitly create a separate patient. The real stored patient name must never receive an automatic suffix or generated modification.

When adding a patient to a working day in Phase 2, the interface must suggest matching existing profiles so the Assistant can select the recorded Patient and create a new Visit. Exact suggestion-row presentation remains a Phase 2 interface decision.

### Approved editing and deletion behavior

There is no patient archive state.

- Patient profiles may be edited.
- Deletion is blocked while future Visits exist.
- Future Visits must be removed first.
- Past Visits remain as historical records when the active Patient profile is deleted.
- Historical Visits retain captured patient details for display.
- A deleted Patient profile is no longer selectable and cannot receive new Visits.

### Phase 1 implementation scope

After the product owner says **continue**, implement only:

- Patient model and migration;
- approved field and phone validation;
- country-code selector with Iran `+98` default;
- create, view, edit, search, and delete APIs;
- Doctor and Assistant permissions;
- the single duplicate-warning behavior;
- patient list, search, create, detail, edit, and deletion UI;
- backend tests;
- frontend and browser-demo tests;
- equivalent GitHub Pages demo behavior;
- resulting documentation updates.

Do not implement Visits, appointments, working-day scheduling, queue states, consultation flow, checkout, shared tasks, personal notes, notifications, or estimates in Phase 1.

## Phase 2 — Planned appointments and walk-ins

Before implementation, confirm:

- appointment fields;
- editing and cancellation rules, including removal of future Visits required before Patient deletion;
- past-appointment visibility;
- repeated same-day visits;
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

Before implementation, confirm:

- queue-row information;
- early and late arrival presentation;
- accidental check-in reversal;
- equal check-in timestamp handling;
- planned versus walk-in presentation;
- temporary unavailability behavior;
- patient departure before consultation.

After approval, implement check-in, actual arrival timestamps, one live queue, permissions, tests, and equivalent demo behavior.

## Phase 4 — Doctor readiness and consultation flow

Confirmed transitions:

```text
ARRIVED → WITH_DOCTOR → DOCTOR_FINISHED
```

Confirmed behavior:

- Doctor taps **Ready for first patient**.
- When ready and no patient is currently with the Doctor, the first eligible checked-in patient automatically becomes **With doctor**.
- There is no separate Prepare patient, Send in, Call next patient, or Start consultation action.
- **With doctor** means consultation has started.
- Doctor taps **Finished** when consultation ends.
- If another patient is waiting and the Doctor remains ready, the next eligible patient automatically becomes **With doctor**.

Before implementation, confirm readiness changes, empty-queue behavior, return-to-queue behavior, reversal rules, visible patient information, timestamp presentation, and whether finishing needs confirmation.

After approval, implement readiness, automatic transitions, concurrency protection, Doctor workspace behavior, tests, and equivalent demo behavior.

## Phase 5 — Doctor-finished indication and checkout

Confirmed transition:

```text
DOCTOR_FINISHED → CHECKED_OUT
```

Before implementation, confirm:

- the Assistant indication design;
- persistence of that indication;
- handling multiple patients awaiting checkout;
- checkout-list information;
- whether checkout requires data or only an action;
- reversal behavior;
- completed-patient visibility;
- whether the Doctor sees checkout completion.

After approval, implement the Assistant indication, checkout workflow, timestamps, completed section, tests, and equivalent demo behavior.

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

After approval, implement task models, permissions, lists, conversation, completion behavior, tests, and equivalent demo behavior.

## Phase 7 — Private notes

Confirmed requirements:

- each role can create private personal notes;
- each note is visible only to its creator;
- notes can be saved and deleted;
- notes remain separate from tasks, Patient notes, and patient records;
- notes are simple sticky-note-style text and do not create reminders.

Before implementation, confirm titles, editing, autosave, deletion behavior, ordering, and workspace placement.

After approval, implement private-note storage, authorization, interface, privacy tests, and equivalent demo behavior.

## Phase 8 — Daily operational estimate

Begin only after consultation timing data exists.

Before implementation, approve the formula, minimum data requirement, historical window, outlier handling, placement, wording, and role visibility.

After approval, implement duration calculations, recent averages, remaining-day estimate, uncertainty wording, tests, and equivalent demo behavior.

No machine-learning model is assumed.

## Phase 9 — Password recovery and clinic administration

Before implementation, confirm clinic recovery channels, staff recovery, Doctor controls over the Assistant account, password changes, account editing, disabling, inaccessible-Doctor recovery, and any approved email or SMS infrastructure.

After approval, implement only the confirmed recovery and administration flows with security tests. No fake email or SMS behavior is permitted.

## Phase 10 — Sensitive attachment architecture

Before implementation, approve storage, access controls, encryption, limits, file types, scanning, retention, deletion, backups, audit logging, patient-information rules, and applicable operational/legal requirements.

Only after architecture approval may private upload/download behavior and security tests be implemented. The interface must not claim attachments are secure before the architecture supports that claim.

## Phase 11 — Production hardening

Review and complete:

- backend and frontend validation coverage;
- authorization boundaries;
- database constraints and race conditions;
- error states and responsive layout;
- accessibility and input validation;
- security headers and secret management;
- PostgreSQL backup and restoration documentation;
- production deployment, logging, privacy, and retention decisions.

External monitoring, analytics, hosting, storage, or email services require approval.

## Phase 12 — First stable release

- Review the complete Doctor workflow.
- Review the complete Assistant workflow.
- Remove unfinished or unreachable UI.
- Confirm no unapproved behavior exists.
- Confirm the Pages demo uses the same product frontend.
- Finalize backend deployment and architecture documentation.
- Create the first stable version only after product-owner approval.