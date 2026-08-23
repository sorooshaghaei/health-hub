# Health Hub development plan

## Working protocol

Health Hub is developed one approved product phase or design step at a time on a dedicated branch created from the current `main`.

For each unit:

1. read `PROJECT_CONTEXT.md` and the relevant product-phase or design-step specification;
2. clarify unresolved product behavior before implementation;
3. update the specification to the approved contract;
4. align backend, frontend, browser adapter, migrations, and tests;
5. validate affected behavior;
6. keep the approved unit on its dedicated branch with a small, reviewable commit history;
7. merge into `main` only after validation and product-owner approval;
8. do not start the next unit until the current unit is reconciled.

Do not add speculative features, duplicate workflows, or unapproved dependencies. Product **Phases** and post-Phase-8 **Design Steps** are separate naming systems and must not be used interchangeably.

## Current product baseline

- one global personal `StaffUser` account per person;
- one permanent role per account: Doctor or Assistant;
- role never changes and cannot differ between clinics;
- `StaffMembership` links an account to a clinic but does not own the role;
- only Doctors create/own clinics;
- one owning Doctor and at most one active Assistant per clinic in the current scope;
- Doctor account may open Doctor or Assistant workspace as administrator;
- Assistant account may open Assistant workspace only;
- both account types may belong to multiple clinics;
- trusted devices are global per personal account;
- clinic operational data remains strictly tenant-scoped;
- one stored IANA operational timezone per clinic;
- React/Vite frontend, Django REST Framework backend, PostgreSQL primary database;
- GitHub Pages renders the production React UI through a browser-local API/storage adapter.

## Global action rule

Discrete operational/destructive workflow actions use the approved five-second server-enforced Undo. Normal form edits use regular Edit flows.

Security/account actions do not use five-second Undo.

## Phase status

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Foundation | **Complete and reconciled to final Phase 8 identity model** |
| 1 | Patient records | **Complete and reconciled** |
| 2 | Planned appointments | **Complete and reconciled** |
| 3 | Check-in and live queue | **Complete and reconciled** |
| 4 | Doctor room call and consultation handoff | **Complete and reconciled** |
| 5 | Completed consultation behavior | **Complete and reconciled** |
| 6 | Shared tasks | **Complete and reconciled** |
| 7 | Private sticky | **Complete and reconciled** |
| 8 | Authentication, administration, recovery, multi-clinic identity | **Implemented; release-audit remediation in progress** |
| 9 | Sensitive attachment architecture | Not started |
| 10 | Production hardening | Not started |
| 11 | First stable release | Not started |

## Phase 0 — Foundation

Current contract:

- no shared clinic password and no username login;
- permanent account role (`DOCTOR` or `ASSISTANT`);
- clinic membership is a clinic link, not a role assignment;
- both email and phone verified before clinic operational access;
- only Doctors create/own clinics;
- global trusted devices;
- current trusted device cannot be removed;
- removing another device revokes sessions on it across all clinics;
- sign-out preserves device trust;
- clinic-bound sessions require matching trusted-device proof;
- production and Pages use the same React product UI.

See [`PHASE_0_FOUNDATION.md`](PHASE_0_FOUNDATION.md).

## Phase 1 — Patient records

- reusable clinic-scoped Patient records;
- full name, `Man`/`Woman`, country/phone, optional DOB, optional shared Patient note;
- Iran `+98` default;
- automatic search + one duplicate warning;
- Doctor workspace may edit approved Patient data;
- Assistant workspace administers creation/deletion;
- Doctor in Assistant workspace receives Assistant-side administrator controls;
- current/future Appointments block Patient deletion;
- eligible deletion has five-second Undo;
- Patient records never merge across clinics.

See [`PHASE_1_PATIENT_RECORDS.md`](PHASE_1_PATIENT_RECORDS.md).

## Phase 2 — Appointments

- Patient, date, scheduled time, optional reason;
- new Appointment creation searches existing Patients first and reveals new-Patient fields only after an explicit choice;
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

- clinic operational timezone captured automatically at clinic creation;
- clinic timezone defines operational **today**;
- check-in only for clinic-today Appointments;
- original persisted check-in sequence controls queue order;
- Assistant queue shows Patient phone; Doctor queue omits it;
- queue state is clinic-scoped;
- check-in has five-second Undo;
- three-second authenticated polling.

See [`PHASE_3_QUEUE.md`](PHASE_3_QUEUE.md).

## Phase 4 — Room ready and consultation handoff

```text
CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

- Room ready requires permanent Doctor account + Doctor workspace + active membership;
- with a current Patient, the action reads **Complete Patient and signal room ready** and discloses both effects before submission;
- Doctor administrator access in Assistant workspace cannot Room ready;
- With doctor is an Assistant-workspace action, including Doctor administrator access;
- one pending Room-ready call maximum per clinic;
- five-second Undo before Assistant notification;
- one short sound + persistent visual after Undo expiry;
- first waiting Patient suggested, any checked-in Patient allowed;
- With doctor has five-second Undo and preserves queue sequence;
- clinic timezone controls consultation day;
- three-second polling remains.

See [`PHASE_4_CONSULTATION.md`](PHASE_4_CONSULTATION.md).

## Phase 5 — Completion

`DOCTOR_FINISHED` is final and displayed as **Completed**.

- no Checkout state/action/form/queue/timestamp;
- next Room ready completes the current `WITH_DOCTOR` Appointment;
- confirmation and Undo feedback retain the completed Patient identity and name both completion and the next room call;
- `doctor_finished_at` records completion;
- five-second Undo Room ready is the only reversal;
- after expiry, Completed cannot reopen;
- Completed remains in date list + Patient history but leaves live queue/current Doctor card;
- Patient/date remain locked; scheduled time/reason/Patient profile corrections remain allowed;
- Completed Appointments cannot be deleted.

See [`PHASE_5_COMPLETION.md`](PHASE_5_COMPLETION.md).

## Phase 6 — Shared tasks

```text
OPEN → DONE
```

- tasks are clinic-scoped Doctor-to-Assistant work;
- permanent Doctor account can create tasks from Doctor or Assistant workspace while a clinic membership is active;
- Assistant account cannot create/edit/delete tasks;
- only task creator may edit an existing task;
- Doctor may delete Open or Done tasks in the active clinic;
- Doctor or Assistant may mark Done;
- Done has five-second Undo; no permanent Reopen after expiry;
- task attention state remains per clinic membership;
- optional due date is date-only;
- optional Patient link must be same-clinic;
- both roles may comment; only personal comment author may edit/delete;
- former Assistant attribution is preserved;
- task/comment deletion has five-second Undo;
- New Task uses compact modal;
- existing-task edit replaces that task's expanded details and conflicting controls until Save or Cancel;
- no task notification system beyond the red attention dot;
- three-second polling remains.

See [`PHASE_6_SHARED_TASKS.md`](PHASE_6_SHARED_TASKS.md).

## Phase 7 — Private sticky

- one global plain-text sticky per personal account;
- same content follows the account across clinics;
- Doctor workspace shows Doctor's sticky;
- Assistant workspace shows Assistant's sticky;
- Doctor in Assistant administrator workspace shows no sticky;
- minimized strip always says **Private note** and never previews content;
- autosave; empty content valid;
- no multiple notes, title, Trash, Undo, history, rich text, Patient link, task conversion, reminders, attachments, or notifications;
- desktop movement/resizing stays within safe viewport bounds below the workspace header and above the Undo lane, with no Reset control; mobile expansion remains full-screen;
- sticky layout state is not server-persisted.

See [`PHASE_7_PRIVATE_NOTES.md`](PHASE_7_PRIVATE_NOTES.md).

## Phase 8 — Authentication, administration, and security

Final contract:

- first screen chooses permanent Doctor or Assistant role;
- both contacts verified during new-account onboarding;
- new Doctor creates clinic; new Assistant joins with a Doctor setup code;
- first-clinic Doctor and Assistant screens retain account/sign-out exits and seed an in-app browser-history fallback;
- first browser is trusted automatically after first clinic creation/join;
- existing trusted browser needs no second OTP;
- browser credentials are retained per account so alternating Doctor and Assistant accounts reuses the matching trusted-device record;
- new browser uses one OTP through verified email or SMS, then becomes globally trusted;
- one clinic auto-opens; multiple clinics use clinic picker;
- Doctor defaults to Doctor workspace and may switch to Assistant administrator workspace;
- setup codes are one-time, case-insensitive, and 24-hour; plaintext appears only on creation with copy and exact-expiry controls;
- active setup status survives reload without returning plaintext, and confirmed rotation invalidates the previous unclaimed code;
- replacing an assigned Assistant requires confirmation before immediate clinic-membership deactivation;
- Assistant removal/replacement is clinic-membership-only;
- no Doctor global-recovery key for an Assistant;
- Assistants have no self-service Delete account option;
- zero active Assistant memberships starts a two-year dormant period;
- after two years, personal/auth data is anonymized while historical **Former Assistant** attribution remains;
- Doctor account deletion permanently deletes all owned clinics and their operational data while preserving other people's global accounts;
- Doctor deletion requires trusted browser, fresh password/passkey reauth, affected-clinic warning, typed `DELETE`, no Undo;
- explicit reauthentication is required for email/phone change; normal login does not count; reauth lasts 10 minutes;
- Doctor offline recovery codes remain ten one-time codes;
- passkeys optional, maximum five;
- sessions remain 12h absolute / 2h inactivity / no Remember Me;
- OTP defaults remain six digits / 10 minutes / 60-second resend / five failed attempts;
- pending verification/password challenges restore after reload with the server-derived resend window;
- pending contact replacements can be explicitly cancelled and their challenges consumed;
- password forms gate submission on client-known requirements while the backend remains authoritative;
- broader brute-force/IP throttling is Phase 10.

See [`PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](PHASE_8_AUTHENTICATION_ADMINISTRATION.md).

## Phase 9 — Sensitive attachment architecture

**Not started. Do not implement before clarification.**

Before implementation, approve storage, access control, encryption, file types/limits, malware scanning, retention/deletion, backups, audit, Patient privacy boundaries, and deployment constraints.

## Phase 10 — Production hardening

Review authorization, validation, race conditions, accessibility, security headers, secrets, login/recovery/IP throttling, backups, logging/audit, monitoring, privacy/retention, recovery operations, production communication providers, and deployment.

## Phase 11 — First stable release

Review the complete Doctor/Assistant workflow, remove unfinished UI, confirm no unapproved behavior, verify demo parity, finalize deployment documentation, and release only after approval.

## Current work

**Product Phases 0–8 and Design Steps 1–5 are implemented. Release-readiness audit remediation is now the active work and is split into reviewable parts with one validated commit per part.**

1. **Design Step 1 — complete:** critical onboarding and Patient-edit data safety;
2. **Design Step 2 — complete:** workspace usability and visual hierarchy;
3. **Design Step 3 — complete:** verification, password, and recovery guidance;
4. **Design Step 4 — complete:** task/settings/dialog accessibility;
5. **Design Step 5 — complete and validated on `main`:** weekly clinic working days/hours and optional Appointment-time suggestions.

Audit remediation status:

1. **Verification and password lifecycle — implemented:** reload restoration, authoritative resend timing, exact six-digit confirmation, pending contact-replacement cancellation, stale-error clearing, password guidance/validation parity, and submit gating;
2. **Multi-account trusted devices and recovery routing — implemented:** per-account browser credentials, trusted-device last-used tracking, duplicate-free credential reuse, and Assistant-only personal recovery methods;
3. **International phone normalization — implemented:** metadata-backed staff and Patient validation, domestic or matching international Patient input, corrected French guidance, and canonical E.164 storage in production and demo paths;
4. **Conflict-free task editing — implemented:** the in-card edit form replaces that task's normal details and mutation/comment controls until Save or Cancel and patches the same task identity;
5. **Clinic onboarding and Assistant setup codes — implemented:** safe account/sign-out exits and browser history, one-time plaintext with exact expiry and Copy, reload-safe active-code status, confirmed rotation/replacement, and production/demo parity;
6. **Private sticky safety — implemented:** no Reset control, viewport-constrained pointer/keyboard movement and resizing, reachable header/Minimize controls, and a reserved bottom-right Undo lane;
7. **Appointment creation simplification — implemented:** dedicated existing-Patient search, explicit existing/new choice, and deferred new-Patient fields with clear creation wording;
8. **Keyboard, dialog, and repeated-action accessibility — implemented:** topmost-dialog isolation and focus containment, nested-dialog restoration, Account-menu Escape/arrow behavior, contained Patient-deletion errors, focused active-form errors, and contextual Undo/task/comment names;
9. **Room-ready completion disclosure — implemented:** the combined action is explicit before submission, production/demo feedback retains the completed Patient identity, and Undo names both completion and the pending room call;
10. **Patient date-of-birth validation — implemented:** profile and inline Appointment forms use clinic today as the maximum, while frontend, production backend, and browser demo reject future birth dates;
11. **Remaining approved audit parts — pending:** continue in the agreed order without starting Product Phase 9.

Design Step 5 is intentionally limited to one working-time range per enabled weekday, a **Today** shortcut, and 15-minute suggestions that preserve unrestricted manual time entry. It does not add holidays, date-specific closures, recurring exceptions, public booking, capacity, or changes to task due dates and date filters.

See [`DESIGN_STEP_5_WORKING_HOURS.md`](DESIGN_STEP_5_WORKING_HOURS.md) for the approved contract and implementation plan. Product Phase 9 remains the reserved sensitive-attachment phase and is not part of these Design Steps.
