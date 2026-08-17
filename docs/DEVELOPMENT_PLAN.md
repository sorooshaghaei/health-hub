# Health Hub development plan

## Working protocol

Health Hub is developed directly on `main`, one approved phase or corrective pass at a time.

For each approved unit:

1. read `PROJECT_CONTEXT.md` and the relevant phase specification;
2. resolve only genuinely unapproved product behavior;
3. implement only the approved scope;
4. validate backend, frontend, browser adapter, migrations, tests, and documentation;
5. commit directly to `main`;
6. report exact changes and stop;
7. continue only after the product owner explicitly says **continue**.

Do not create branches, pull requests, speculative features, duplicate workflows, or unapproved dependencies.

## Product baseline

- clinic workflow with Doctor and Assistant roles;
- global personal staff accounts with clinic memberships;
- at most one active Doctor and one active Assistant per clinic;
- Doctor membership may open Doctor or Assistant workspace;
- Assistant membership may open Assistant workspace only;
- Doctor workspace clinically focused;
- Assistant workspace owns Patient/Appointment administration;
- React/Vite frontend;
- Django REST Framework backend;
- PostgreSQL primary database;
- GitHub Pages renders the same production React UI and substitutes only a browser-local API adapter.

## Global action rule

Discrete operational/destructive workflow actions use the approved five-second server-enforced Undo. Normal form edits remain editable through the regular Edit flow.

Security/account actions do not use five-second Undo.

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Foundation | Implemented; trusted-device authentication correction complete |
| 1 | Patient records | Implemented |
| 2 | Planned appointments | Implemented; one Appointment per Patient per clinic date |
| 3 | Check-in and live waiting queue | Implemented |
| 4 | Doctor room call and consultation handoff | Implemented |
| 5 | Completed consultation behavior | Implemented |
| 6 | Shared tasks | Implemented |
| 7 | Private sticky | Implemented |
| 8 | Account recovery, administration, multi-clinic identity, and security | **Implemented and validated; Pages UI parity and entry-UX corrections complete** |
| 9 | Sensitive attachment architecture | Not started |
| 10 | Production hardening | Not started |
| 11 | First stable release | Not started |

## Phase 0 — Foundation

Implemented foundation includes:

- trusted clinic devices instead of shared clinic password;
- automatic trust of the first browser for a new clinic;
- six-digit trusted-device pairing;
- device list/removal;
- bearer session + matching device proof for clinic APIs;
- no `/api/clinics/enter/` shared-password flow;
- browser demo bypass of real device authority.

Phase 8 later extended this foundation with global accounts, verified contacts, new-device email/SMS authorization, recovery, passkeys, and multi-clinic membership.

See [`PHASE_0_FOUNDATION.md`](PHASE_0_FOUNDATION.md).

## Phase 1 — Patient records

Implemented:

- reusable clinic-scoped Patient profiles;
- approved identity/contact fields and shared Patient note;
- duplicate warning;
- search;
- Doctor edit permission;
- Assistant-workspace creation/deletion;
- deletion blocking for current/future Appointments;
- five-second deletion Undo.

See [`PHASE_1_PATIENT_RECORDS.md`](PHASE_1_PATIENT_RECORDS.md).

## Phase 2 — Appointments

Implemented:

- Patient, date, scheduled time, optional reason;
- one active Appointment maximum per Patient per clinic date;
- Patient-first create/edit UI;
- same-day normal Appointment for an unplanned arrival;
- Assistant-workspace administration;
- Doctor-workspace read-only appointment access;
- five-second deletion Undo.

See [`PHASE_2_VISITS.md`](PHASE_2_VISITS.md).

## Phase 3 — Check-in and live queue

```text
PLANNED → CHECKED_IN
```

Implemented today-only check-in, persisted check-in ordering, live queue, approved field locks/corrections, and five-second check-in Undo.

See [`PHASE_3_QUEUE.md`](PHASE_3_QUEUE.md).

## Phase 4 — Room ready and consultation handoff

```text
CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

Implemented one-time Doctor **Room ready** call, delayed Assistant notification after the Doctor Undo window, Assistant Patient selection, **With doctor**, queue restoration Undo, and clinic-scoped transactional protection.

See [`PHASE_4_CONSULTATION.md`](PHASE_4_CONSULTATION.md).

## Phase 5 — Completion

`DOCTOR_FINISHED` is final and displayed as **Completed**. There is no Checkout state/action/timestamp. Existing Room-ready Undo is the only short reversal of completion.

See [`PHASE_5_COMPLETION.md`](PHASE_5_COMPLETION.md).

## Phase 6 — Shared tasks

```text
OPEN → DONE
```

Implemented Doctor-to-Assistant tasks, optional due date/Patient link, comments, five-second Done/delete/comment-delete Undo, History, and attention dots. Phase 8 moved task-attention seen state to clinic membership so clinics remain independent.

See [`PHASE_6_SHARED_TASKS.md`](PHASE_6_SHARED_TASKS.md).

## Phase 7 — Private sticky

Implemented one private persistent global scratchpad per personal account, plain text/autosave, minimized/drag/resizable responsive UI, and strict workspace privacy. After Phase 8 it follows the person across clinics but appears only when the active workspace equals the person's membership role.

See [`PHASE_7_PRIVATE_NOTES.md`](PHASE_7_PRIVATE_NOTES.md).

## Phase 8 — Account recovery, administration, and security

**Implemented and validated, including the Pages demo-parity and entry-UX corrective passes.**

Final Phase 8 architecture:

- global `StaffUser` personal identity;
- `StaffMembership` for clinic + Doctor/Assistant role;
- both Doctors and Assistants may belong to multiple clinics;
- one active Doctor and one active Assistant slot per clinic;
- email/phone login instead of username;
- phone required;
- both email and phone verified before clinic data access;
- Clinic email/phone removed;
- first screen is the sign-in form, not a multi-choice architecture explainer;
- Create clinic is a secondary action;
- Assistant setup is a small **Have an Assistant setup code? Join a clinic** path, not a primary landing action;
- Forgot password is inside the sign-in area;
- after sign-in, a single clinic membership is selected automatically;
- clinic selection is shown only when the person has multiple clinic memberships;
- trusted-device authorization appears only when the selected clinic does not already trust the browser;
- workspace choice follows clinic/device resolution;
- trusted-device authorization separately per clinic;
- new device by verified email/SMS or existing trusted-device pairing;
- last trusted device may be removed;
- clinic-bound bearer sessions still require matching trusted-device proof;
- 12-hour absolute session / 2-hour inactivity timeout / no Remember Me;
- forgotten-password email/SMS recovery with 30-minute single-use grant;
- reset revokes the recovered person's sessions only and leaves device trust;
- normal password change verified by email/SMS, preserving current session and revoking other sessions;
- email/phone change requires password/passkey reauthentication and verification of the new contact;
- optional WebAuthn passkeys, maximum five;
- Doctor-only set of 10 one-time offline recovery codes; regeneration invalidates unused old codes;
- Doctor can initiate Assistant recovery;
- Assistant replacement deactivates only the old clinic membership and uses a one-time replacement setup code;
- former Assistant keeps global account/sticky/passkeys/other memberships;
- historical task authorship remains attached to the original person;
- no Doctor replacement/ownership transfer;
- GitHub Pages uses the same production Phase 8 React screens rather than a separate `DemoApp` login/application;
- Pages login is **Email or phone** and the old username contract is rejected;
- only the API/security layer is browser-local in Pages.

Migrations:

- `accounts.0006_phase8_global_accounts`;
- `accounts.0007_alter_staffuser_options`.

The original Phase 8 code validation passed on commit `78bd2753c7b8b2c049576be8454ae512e311e6a0`. The later UI corrections were revalidated on code/test commit `99e2bc072f3c99c4d0bb6bc5f846ea1db6d3bd58` through frontend tests/builds, Django checks, migration checks/application, and the PostgreSQL backend suite.

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

Do not implement attachment behavior before these decisions are resolved and the product owner explicitly says **continue**.

## Phase 10 — Production hardening

Review validation, authorization, constraints, race conditions, error states, accessibility, security headers, secrets, backups, deployment, logging, privacy, retention, and production recovery/communications configuration.

## Phase 11 — First stable release

Review complete Doctor/Assistant workflows, remove unfinished UI, confirm no unapproved behavior, verify browser-demo parity, finalize deployment documentation, and release only after product-owner approval.

## Current work

**Phases 0–8 are complete, including the Phase 8 UI corrective passes. Phase 9 has not started.**

Stop here. The next implementation work begins only after the product owner explicitly says **continue** and Phase 9's attachment/security questions are resolved.
