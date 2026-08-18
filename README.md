# Health Hub

[![Verify foundation](https://github.com/sorooshaghaei/health-hub/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/sorooshaghaei/health-hub/actions/workflows/quality.yml)
[![Deploy frontend demo](https://github.com/sorooshaghaei/health-hub/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/sorooshaghaei/health-hub/actions/workflows/pages.yml)
[![Sponsor Health Hub](https://img.shields.io/badge/Sponsor-Health%20Hub-EA4AAA?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/sorooshaghaei)

Health Hub is a deliberately simple clinic workflow application for Doctor and Assistant roles. The frontend is React/Vite. The backend is Django REST Framework with PostgreSQL as the primary database.

Public frontend demo: <https://sorooshaghaei.github.io/health-hub/>

## Sources of truth

- Continuation handoff: [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md)
- Development plan: [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md)
- Foundation: [`docs/PHASE_0_FOUNDATION.md`](docs/PHASE_0_FOUNDATION.md)
- Patient records: [`docs/PHASE_1_PATIENT_RECORDS.md`](docs/PHASE_1_PATIENT_RECORDS.md)
- Appointments: [`docs/PHASE_2_VISITS.md`](docs/PHASE_2_VISITS.md)
- Check-in/live queue: [`docs/PHASE_3_QUEUE.md`](docs/PHASE_3_QUEUE.md)
- Consultation handoff: [`docs/PHASE_4_CONSULTATION.md`](docs/PHASE_4_CONSULTATION.md)
- Completion: [`docs/PHASE_5_COMPLETION.md`](docs/PHASE_5_COMPLETION.md)
- Shared tasks: [`docs/PHASE_6_SHARED_TASKS.md`](docs/PHASE_6_SHARED_TASKS.md)
- Private sticky: [`docs/PHASE_7_PRIVATE_NOTES.md`](docs/PHASE_7_PRIVATE_NOTES.md)
- Account/recovery/security: [`docs/PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](docs/PHASE_8_AUTHENTICATION_ADMINISTRATION.md)

The Phase 0–8 implementation exists. Before Phase 9, the project is undergoing a line-by-line documentation and implementation reconciliation. **Phase 0–5 have been reconciled; Phase 6 is next.**

## Account and clinic model

Personal identity is global; clinic workflow data is tenant-scoped.

`StaffUser` owns global personal identity/security data such as name, unique email, unique phone, password, verification state, passkeys, eligible Doctor recovery codes, and the private sticky.

`StaffMembership` owns clinic-specific membership data: clinic, Doctor/Assistant role, active state, and membership-scoped task-attention state.

Each clinic has at most one active Doctor and one active Assistant membership. Both Doctors and Assistants may belong to multiple clinics.

There is no shared clinic password and no active username login. Personal sign-in uses email or phone + password, with optional passkeys where supported.

Before clinic operational data opens, both personal email and phone must be verified.

## Workspace access

- Doctor membership can open Doctor workspace.
- Doctor membership can open Assistant workspace as administrator.
- Assistant membership can open Assistant workspace.
- Assistant membership cannot open Doctor workspace.

Doctor workspace is clinically focused. It can edit approved Patient information but does not create/delete Patients or administer Appointments.

Assistant workspace owns Patient/Appointment administration, check-in, queue, and consultation handoff. A Doctor membership opened in Assistant workspace receives the same Assistant-side administrative controls.

For consultation handoff specifically, **Room ready** exists only in Doctor workspace. **With doctor** is an Assistant-workspace action, including when that workspace is opened by the Doctor membership as administrator.

## Trusted devices

Device trust is per clinic.

A browser may be authorized through either:

- a code sent to the signed-in person's verified email or verified phone/SMS; or
- a six-digit pairing code approved from another already trusted device for that clinic.

Clinic-bound API requests require the bearer session plus proof of the matching trusted device. A copied bearer token alone cannot open clinic operational data.

Trusted devices remain trusted until removed. Current rule:

- other trusted devices may be removed;
- **the current trusted device cannot be removed**;
- signing out does not untrust the browser.

Default staff-session policy is 12-hour absolute lifetime, 2-hour inactivity timeout, and no Remember Me.

## Clinic operational timezone

Every clinic stores one operational IANA timezone such as `Europe/Paris`.

When a clinic is created, the frontend automatically captures the creating browser's timezone. The normal creation UI does not require a manual timezone field.

The stored clinic timezone determines clinic-day behavior including:

- operational **today**;
- today's Appointment list;
- check-in eligibility;
- live queue membership;
- consultation/Room-ready day boundaries.

Travelling with a laptop does not move the clinic into another operational day simply because that browser changes timezone.

## Clinic workflow reconciled through Phase 5

### Patients

- reusable clinic-scoped Patient profiles;
- full name, `Man`/`Woman`, country/calling code, phone, optional DOB, optional shared Patient note;
- Iran `+98` default;
- automatic search;
- one duplicate warning;
- Doctor workspace may edit approved Patient information;
- Assistant workspace may create/edit/delete Patients;
- the same physical Patient in two clinics remains two independent clinic Patient records;
- current/future Appointments block Patient deletion;
- Patient deletion has five-second Undo.

### Appointments

Every clinic attendance is one Appointment with Patient, date, scheduled time, and optional reason.

- one active Appointment maximum per Patient per clinic date;
- Appointment data/history are isolated by clinic;
- unplanned same-day arrival is a normal same-day Appointment followed by check-in;
- Assistant workspace administers Appointments;
- Doctor workspace is read-only for Appointment administration;
- approved edit locks apply after check-in;
- Appointment deletion has five-second Undo.

### Check-in and live queue

```text
PLANNED → CHECKED_IN
```

- only an Appointment dated to the clinic's operational today can check in;
- queue order is the persisted original check-in sequence;
- queue state is independent per clinic;
- Assistant queue shows Patient phone; Doctor queue omits phone;
- after check-in, Patient and Appointment date are locked;
- scheduled time, reason, and Patient profile information remain correctable;
- corrections do not change queue order;
- check-in has five-second Undo;
- live queue uses authenticated three-second polling.

### Room ready and consultation handoff

```text
CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

- Room ready requires a Doctor membership in Doctor workspace;
- Doctor administrator access to Assistant workspace cannot use Room ready;
- Assistant workspace may use With doctor, including Doctor administrator access there;
- consultation state and Room-ready state are independent per clinic;
- the clinic operational timezone determines the active consultation day;
- one pending Room-ready call maximum per clinic;
- Room ready may remain pending even when the queue is empty;
- Room ready has five-second Undo before Assistant notification;
- after the Undo period, Assistant workspace receives one short sound plus persistent visual indication;
- first waiting Patient is suggested, but any checked-in Patient may be selected;
- With doctor preserves the original queue order and has five-second Undo;
- synchronization uses authenticated three-second polling.

### Completed consultation

`DOCTOR_FINISHED` is final and displayed as **Completed**.

- the Doctor's next Room ready completes the current `WITH_DOCTOR` Appointment;
- no Checkout state/action/form/queue exists;
- `doctor_finished_at` is the completion timestamp;
- five-second Undo Room ready is the only reversal;
- after that window expires, the Appointment cannot return to `WITH_DOCTOR`;
- Completed Appointments disappear from the live queue and current Doctor card but remain in the selected-date list and Patient history;
- Patient and Appointment date stay locked;
- scheduled time, reason, and Patient profile details remain correctable;
- Completed Appointments cannot be deleted;
- completion/history are clinic-scoped and follow the clinic operational timezone.

## Existing Phase 6–8 implementation

Shared tasks, private sticky, and Phase 8 recovery/security/multi-clinic functionality are already implemented.

Their specifications are being reconciled sequentially with the final account/membership/device/timezone architecture. The next clarification target is Phase 6. Do not infer unresolved Phase 6–8 behavior from older wording when it conflicts with the corrected Phase 0–5 documents.

The Pages parity rule remains fixed: GitHub Pages renders the same production React product UI and substitutes only the browser-local API/storage layer. It must not expose a separate username/demo application.

## Browser demo

The GitHub Pages demo is demonstration storage only. It does not provide or claim real production:

- trusted-device security;
- email/SMS delivery;
- WebAuthn/passkey verification;
- medical-data storage guarantees.

Do not enter real Patient information into the public demo.

## Repository structure

```text
backend/accounts/        staff accounts, memberships, sessions, devices, verification, passkeys, recovery
backend/patients/        Patient records and deletion Undo
backend/visits/          Appointments, queue, room calls, consultation handoff
backend/tasks/           clinic-scoped shared tasks/comments
backend/health_hub/      Django project configuration and test runner
frontend/                React/Vite app and browser adapters
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

## Important current migration

`accounts.0008_clinic_timezone` adds the persisted clinic operational timezone used by Phase 3–5 clinic-day logic.

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

Patient, Appointment, queue/room, and task endpoints remain under `/api/patients/`, `/api/visits/`, `/api/tasks/`, and `/api/task-comments/`.

## Production boundary

This repository is not yet a production medical-data deployment. Production use still requires the later security/privacy/deployment work, real communication providers, backups, logging/audit decisions, retention policy, monitoring, jurisdiction-appropriate healthcare/privacy review, and explicit Phase 9/10 decisions.

Phase 9 sensitive attachment architecture has not started.
