# Health Hub

[![Verify foundation](https://github.com/sorooshaghaei/health-hub/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/sorooshaghaei/health-hub/actions/workflows/quality.yml)
[![Deploy frontend demo](https://github.com/sorooshaghaei/health-hub/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/sorooshaghaei/health-hub/actions/workflows/pages.yml)
[![Sponsor Health Hub](https://img.shields.io/badge/Sponsor-Health%20Hub-EA4AAA?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/sorooshaghaei)

Health Hub is a deliberately simple clinic workflow application for Doctor and Assistant roles. The frontend is React/Vite. The backend is Django REST Framework with PostgreSQL as the primary database.

Public frontend demo: <https://sorooshaghaei.github.io/health-hub/>

## Sources of truth

- Continuation handoff: [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md)
- Phased roadmap: [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md)
- Foundation/base authentication: [`docs/PHASE_0_FOUNDATION.md`](docs/PHASE_0_FOUNDATION.md)
- Patient records: [`docs/PHASE_1_PATIENT_RECORDS.md`](docs/PHASE_1_PATIENT_RECORDS.md)
- Appointments: [`docs/PHASE_2_VISITS.md`](docs/PHASE_2_VISITS.md)
- Check-in/live queue: [`docs/PHASE_3_QUEUE.md`](docs/PHASE_3_QUEUE.md)
- Consultation handoff: [`docs/PHASE_4_CONSULTATION.md`](docs/PHASE_4_CONSULTATION.md)
- Completion: [`docs/PHASE_5_COMPLETION.md`](docs/PHASE_5_COMPLETION.md)
- Shared tasks: [`docs/PHASE_6_SHARED_TASKS.md`](docs/PHASE_6_SHARED_TASKS.md)
- Private sticky: [`docs/PHASE_7_PRIVATE_NOTES.md`](docs/PHASE_7_PRIVATE_NOTES.md)
- Account/recovery/security: [`docs/PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](docs/PHASE_8_AUTHENTICATION_ADMINISTRATION.md)

The project is developed directly on `main`, one approved phase/corrective pass at a time. Implementation stops after each approved unit until the product owner explicitly says **continue**.

## Current status

**Phases 0–8 are implemented. Phase 9 has not started.**

Phase 8 introduced global personal staff accounts, clinic memberships, mandatory verified personal email/phone before clinic-data access, email/phone login, optional passkeys, recovery, per-clinic trusted-device authorization, multi-clinic staff identity, and membership-based Assistant replacement.

The final Phase 8 UI correction keeps the security architecture but simplifies daily use: the first screen is the sign-in form, Create clinic is secondary, Assistant setup is a small setup-code link, single-clinic users skip the clinic picker, and trusted-device authorization appears only when actually needed.

The latest Phase 8 corrective code/test commit `99e2bc072f3c99c4d0bb6bc5f846ea1db6d3bd58` passed browser-demo tests, production/demo frontend builds, Django checks, committed migration verification, PostgreSQL migration application, and the full backend test suite.

## Account and clinic model

Personal identity is global; clinic workflow data is tenant-scoped.

`StaffUser` owns global personal data:

- first/last name;
- email;
- phone;
- password;
- contact verification state;
- passkeys;
- Doctor offline recovery codes;
- private sticky.

`StaffMembership` owns clinic-specific identity:

- clinic;
- Doctor/Assistant role;
- active state;
- task-attention seen state.

Each clinic has at most one active Doctor and one active Assistant. Both Doctors and Assistants may belong to multiple clinics.

Clinic-level email and phone have been removed. There is no shared clinic password and no production username login.

## Authentication flow

The normal entry flow is intentionally simple:

```text
sign in with email or phone
    ↓
verify email + phone if still required
    ↓
1 clinic → select it automatically
multiple clinics → choose clinic
    ↓
authorize this browser only if that clinic does not already trust it
    ↓
choose allowed workspace
```

The landing page does not expose the account/tenant architecture. It shows the sign-in form directly. **Create a clinic** is a secondary action, **Forgot password?** stays with sign-in, and a new Assistant uses the small **Have an Assistant setup code? Join a clinic** path.

Personal sign-in accepts email or phone + password. A registered WebAuthn passkey may be used instead.

Before clinic operational data opens, both personal email and phone must be verified.

Device trust is per clinic. A browser may be authorized through:

- a code sent to the signed-in person's verified email;
- a code sent to their verified phone/SMS; or
- a six-digit pairing code approved on an already trusted device for that clinic.

Clinic-bound API requests require both the bearer session and proof of the matching trusted device. A copied bearer token alone cannot open clinic operational data.

Trusted devices remain trusted until removed. The last trusted device may be removed because verified-contact authorization can establish a new trusted browser later.

Default session policy is 12-hour absolute lifetime with 2-hour inactivity timeout and no Remember Me.

## Workspace access

- Doctor membership can open Doctor workspace.
- Doctor membership can also open Assistant workspace as administrator.
- Assistant membership can open Assistant workspace.
- Assistant membership cannot open Doctor workspace.

Doctor workspace remains clinically focused. It may edit approved Patient information but does not create/delete Patients or administer Appointments.

Assistant workspace owns Patient/Appointment administration, check-in, queue, and consultation handoff. A Doctor account in Assistant workspace receives those administrative controls.

Doctor task authoring depends on the active clinic membership, not the chosen workspace.

The global private sticky appears only when the active workspace matches that membership's own role. Doctor administrator access to Assistant workspace shows no sticky.

## Recovery and account security

- forgotten password: verified email or SMS;
- recovery authorization: up to 30 minutes and single-use;
- newer recovery grant invalidates older outstanding grants;
- successful reset revokes all sessions for that person and leaves trusted devices intact;
- normal password change uses verified email/SMS, preserves current session, revokes other sessions;
- email/phone changes require password/passkey reauthentication and verification of the new contact;
- optional passkeys, maximum five per account;
- Doctor-only offline recovery codes: ten one-time codes; generating a new set invalidates unused old codes;
- security/account actions do not use the five-second Undo workflow.

## Assistant replacement

The Doctor manages the Assistant membership for the active clinic.

Replacement:

- deactivates only the old Assistant membership for that clinic;
- ends sessions tied to that membership;
- keeps Patient/Appointment/queue/task data unchanged;
- does not erase the former Assistant's global account, private sticky, passkeys, contacts, or memberships in other clinics;
- preserves historical task/comment authorship;
- creates a one-time setup code for the replacement Assistant.

The replacement may create or attach a global personal account, then must verify both contacts and authorize a trusted browser before clinic data opens.

Doctor ownership transfer/replacement is not implemented.

## Clinic workflow

### Patients

- reusable clinic-scoped Patient profiles;
- full name, `Man`/`Woman`, country/calling code, phone, optional date of birth, optional shared Patient note;
- Iran `+98` default;
- automatic search by name, phone, or date of birth;
- Doctor may edit Patient fields;
- Patient creation/deletion remains Assistant-workspace administration;
- current/future Appointments block Patient deletion;
- five-second Patient deletion Undo.

### Appointments

Every clinic attendance is one Appointment with Patient, date, scheduled time, and optional reason.

A Patient may have only one active Appointment per clinic date. For an unplanned same-day arrival, the Assistant creates a normal same-day Appointment (frontend time defaults to current time), then checks the Patient in.

Appointment create/edit/delete controls exist in Assistant workspace, including Doctor administrator access there. Doctor workspace intentionally omits Appointment administration controls.

### Check-in, queue, room call, and completion

```text
PLANNED → CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

- only today's Appointments can check in;
- queue order is persisted original check-in sequence;
- Doctor uses **Room ready** as a one-time call;
- Room ready has five-second Undo before Assistant notification;
- Assistant sends any checked-in Patient **With doctor**;
- With doctor has five-second Undo;
- `DOCTOR_FINISHED` is final and displayed as **Completed**;
- no separate Checkout state/action exists.

### Shared tasks

```text
OPEN → DONE
```

- Doctor membership creates tasks for Assistant;
- title, description, optional due date, optional Patient link;
- Doctor/Assistant comments with own-comment edit/delete rules;
- Done/task-delete/comment-delete have five-second Undo;
- task attention state is membership-scoped so one clinic does not clear another clinic's activity indicator.

### Private sticky

One global plain-text private scratchpad belongs to each personal account. It autosaves, persists across clinics/sign-ins, and appears only in the person's own active workspace role.

## Browser demo

The GitHub Pages demo uses the same React interface through the browser adapter. It does not simulate real production security and must not be treated as medical-data storage.

The demo does not pretend to provide real:

- trusted-device security;
- email/SMS delivery;
- WebAuthn/passkey verification;
- offline recovery-code security.

Do not enter real Patient information into the demo.

## Repository structure

```text
backend/accounts/        global staff accounts, memberships, sessions, devices, verification, passkeys, recovery
backend/patients/        Patient records and deletion Undo
backend/visits/          Appointments, queue, room calls, consultation handoff
backend/tasks/           clinic-scoped shared tasks/comments
backend/health_hub/      Django project configuration and test runner
frontend/                React/Vite app and browser adapter
docs/                    product specifications and handoff
docker-compose.yml       local PostgreSQL service
```

## Local setup

### PostgreSQL

```bash
cp .env.example .env
docker compose up -d db
```

Export the `.env` values before starting Django.

### Backend

Django 6 requires Python 3.12 or newer.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Verification:

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate --noinput
python manage.py test
```

An explicit SQLite fallback is available for isolated tests:

```bash
USE_SQLITE=true python manage.py test
```

### Frontend

Use Node.js 22.

```bash
cd frontend
npm install
npm run dev
```

Verification:

```bash
npm test
npm run build
npm run build:demo
```

## Important configuration

Phase 8 adds configuration for:

- session absolute/inactivity limits;
- verification code expiry/resend/attempt limits;
- recovery grant expiry;
- Assistant setup-code expiry;
- WebAuthn RP ID/name/origin;
- email backend/from address;
- pluggable SMS sender.

See `.env.example` and `backend/health_hub/settings.py`.

The default development email backend is local-memory and the debug SMS fallback logs codes. A production deployment must configure real private email/SMS infrastructure; it must not rely on development delivery behavior.

## API surface

Account/security endpoints include:

```text
GET    /api/health/
POST   /api/clinics/
GET    /api/clinic/context/
POST   /api/clinics/<clinic-id>/claim-doctor/

POST   /api/staff/register/
POST   /api/staff/login/
GET    /api/staff/me/
GET/PATCH /api/staff/profile/
POST   /api/staff/select-clinic/
POST   /api/staff/leave-clinic/
POST   /api/staff/logout/
GET/PATCH /api/staff/private-note/

POST   /api/staff/verify/email/request/
POST   /api/staff/verify/email/confirm/
POST   /api/staff/verify/phone/request/
POST   /api/staff/verify/phone/confirm/
POST   /api/staff/email/change/request/
POST   /api/staff/email/change/confirm/
POST   /api/staff/phone/change/request/
POST   /api/staff/phone/change/confirm/
POST   /api/staff/password/change/request/
POST   /api/staff/password/change/confirm/
POST   /api/staff/reauthenticate/password/

POST   /api/recovery/request/
POST   /api/recovery/confirm/
POST   /api/recovery/code/confirm/
POST   /api/recovery/reset/
GET/POST /api/staff/recovery-codes/

GET    /api/passkeys/
POST   /api/passkeys/register/options/
POST   /api/passkeys/register/complete/
POST   /api/passkeys/auth/options/
POST   /api/passkeys/auth/complete/
POST   /api/passkeys/reauthenticate/
DELETE /api/passkeys/<passkey-id>/

GET    /api/devices/
DELETE /api/devices/<device-id>/
POST   /api/devices/contact/request/
POST   /api/devices/contact/confirm/
POST   /api/devices/pairing/
POST   /api/devices/pairing/status/
POST   /api/devices/pairing/approve/

GET    /api/clinic/assistant/
POST   /api/clinic/assistant/setup/
POST   /api/clinic/assistant/setup/info/
POST   /api/clinic/assistant/setup/claim/
POST   /api/clinic/assistant/recovery/
```

Patient, Appointment, queue/room, and task endpoints remain under `/api/patients/`, `/api/visits/`, `/api/tasks/`, and `/api/task-comments/` as documented in the phase specifications.

Global account endpoints require bearer authentication but cannot open clinic data until a verified active membership/device binding exists. Clinic operational endpoints require bearer authentication plus matching trusted-device proof.

## Migration behavior

Relevant account migrations:

- `accounts.0005_trusted_device_auth`: Phase 0 trusted-device architecture; explicitly approved pre-release reset of incompatible old auth/clinic data.
- `accounts.0006_phase8_global_accounts`: migrate old staff clinic/role into memberships; remove Clinic email/phone and StaffUser username/clinic/role fields; create Phase 8 security models.
- `accounts.0007_alter_staffuser_options`: align final Django user-model migration state.

The custom `HealthHubDiscoverRunner` adapts only legacy Phase 1–7 test setup syntax during `manage.py test`. It does not alter production API behavior.

## Production boundary

This repository is still not a production medical-data deployment.

Production use requires at minimum reviewed TLS/private hosting, secrets, real email/SMS delivery, database backups, logging/audit decisions, privacy/retention policy, security monitoring, recovery operations, jurisdiction-appropriate healthcare/privacy review, and the later Phase 9/10 decisions.

Phase 9 sensitive attachment architecture has not started. Do not add Patient-file storage before its security/storage/retention design is explicitly approved.
