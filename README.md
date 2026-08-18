# Health Hub

[![Verify foundation](https://github.com/sorooshaghaei/health-hub/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/sorooshaghaei/health-hub/actions/workflows/quality.yml)
[![Deploy frontend demo](https://github.com/sorooshaghaei/health-hub/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/sorooshaghaei/health-hub/actions/workflows/pages.yml)
[![Sponsor Health Hub](https://img.shields.io/badge/Sponsor-Health%20Hub-EA4AAA?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/sorooshaghaei)

Health Hub is a deliberately simple clinic workflow application for Doctor and Assistant roles. The frontend is React/Vite and the backend is Django REST Framework with PostgreSQL.

Public frontend demo: <https://sorooshaghaei.github.io/health-hub/>

## Current status

The Phase 0–8 implementation exists. Before Phase 9, the project is undergoing a line-by-line specification/implementation reconciliation to remove outdated pre-Phase-8 assumptions.

**Phase 0–7 reconciliation is complete. Phase 8 is next. Phase 9 has not started.**

Detailed source-of-truth documents:

- [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md)
- [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md)
- [`docs/PHASE_0_FOUNDATION.md`](docs/PHASE_0_FOUNDATION.md)
- [`docs/PHASE_1_PATIENT_RECORDS.md`](docs/PHASE_1_PATIENT_RECORDS.md)
- [`docs/PHASE_2_VISITS.md`](docs/PHASE_2_VISITS.md)
- [`docs/PHASE_3_QUEUE.md`](docs/PHASE_3_QUEUE.md)
- [`docs/PHASE_4_CONSULTATION.md`](docs/PHASE_4_CONSULTATION.md)
- [`docs/PHASE_5_COMPLETION.md`](docs/PHASE_5_COMPLETION.md)
- [`docs/PHASE_6_SHARED_TASKS.md`](docs/PHASE_6_SHARED_TASKS.md)
- [`docs/PHASE_7_PRIVATE_NOTES.md`](docs/PHASE_7_PRIVATE_NOTES.md)
- [`docs/PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](docs/PHASE_8_AUTHENTICATION_ADMINISTRATION.md)

## Account and clinic architecture

Personal identity is global. Clinic workflow data is tenant-scoped.

`StaffUser` owns personal/global identity and security data such as name, unique email/phone, password, verification state, passkeys, eligible Doctor recovery codes, and the private sticky.

`StaffMembership` owns clinic-specific role/state. Each clinic currently has at most one active Doctor and one active Assistant membership. Both roles may belong to multiple clinics.

Workspace rules:

- Doctor membership → Doctor workspace;
- Doctor membership → Assistant workspace as administrator;
- Assistant membership → Assistant workspace only.

There is no shared clinic password and no active username login. Sign-in uses email or phone + password, with optional passkeys where supported.

## Trusted devices

Device trust is per clinic. A browser can be authorized through verified email/SMS or six-digit pairing approved from another trusted browser for the clinic.

Clinic-bound APIs require bearer session + matching trusted-device proof.

Current rule:

- other trusted devices may be removed;
- **the current trusted device cannot be removed**;
- sign-out preserves device trust.

Default session policy is 12-hour absolute lifetime, 2-hour inactivity timeout, and no Remember Me.

## Clinic operational timezone

Each clinic stores one IANA operational timezone automatically captured from the browser when the clinic is created.

That stored timezone determines clinic **today**, today's Appointments, check-in eligibility, live queue membership, and consultation/Room-ready day boundaries. A travelling staff browser does not move the clinic into another operational day.

Migration: `accounts.0008_clinic_timezone`.

## Reconciled clinic workflow

### Patients

- clinic-scoped reusable Patient records;
- full name, `Man`/`Woman`, calling code + phone, optional DOB, optional shared Patient note;
- Iran `+98` default;
- automatic search + one duplicate warning;
- Doctor workspace may edit approved Patient data;
- Assistant workspace administers Patient creation/deletion;
- current/future Appointments block Patient deletion;
- deletion has five-second Undo;
- Patient records never merge across clinics.

### Appointments

- Patient, date, scheduled time, optional reason;
- one active Appointment maximum per Patient per clinic date;
- unplanned same-day arrival = normal same-day Appointment followed by check-in;
- Assistant workspace administers Appointments;
- Doctor workspace is read-only for Appointment administration;
- Patient/date lock after check-in; scheduled time/reason remain correctable;
- eligible deletion has five-second Undo.

### Check-in and queue

```text
PLANNED → CHECKED_IN
```

- check-in only for clinic-operational-today Appointments;
- persisted original check-in sequence controls queue order;
- Assistant queue shows Patient phone; Doctor queue omits it;
- check-in has five-second Undo;
- authenticated three-second polling.

### Room ready and consultation handoff

```text
CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

- **Room ready** requires Doctor membership + Doctor workspace;
- **With doctor** is an Assistant-workspace action, including Doctor administrator access;
- one pending Room-ready call maximum per clinic;
- Room ready has five-second Undo before Assistant notification;
- after expiry: one short sound + persistent visual indication;
- first waiting Patient is suggested, but any checked-in Patient may be selected;
- With doctor has five-second Undo and preserves queue sequence.

### Completed consultation

`DOCTOR_FINISHED` is final and displayed as **Completed**.

- no Checkout workflow exists;
- Doctor's next Room ready completes the current consultation;
- five-second Undo Room ready is the only reversal;
- Completed remains in date list + Patient history but leaves queue/current Doctor card;
- Completed cannot be deleted.

### Shared tasks

```text
OPEN → DONE
```

- clinic-scoped Doctor-to-Assistant work;
- Doctor membership can create tasks from Doctor or Assistant workspace;
- Assistant membership cannot create/edit/delete tasks;
- only the personal creator may edit a task;
- active Doctor membership may delete tasks in that clinic;
- Doctor or Assistant may mark Done;
- Done has five-second Undo and no permanent Reopen after expiry;
- optional date-only due date; no overdue state or reminders;
- optional Patient link must belong to the same clinic;
- comments are shared but only each personal author may edit/delete their own;
- former Assistant comments remain attached to the original person after replacement;
- task/comment deletion has five-second Undo;
- attention dots are stored per clinic membership;
- Assistant dot = new Doctor task; Doctor dot = Assistant completion;
- Doctor self-completion does not generate a Doctor dot;
- New Task uses a compact modal;
- no task sound/push/email/SMS/comment/due-date notification;
- authenticated three-second polling.

### Private sticky

- one global plain-text scratchpad per personal account;
- the same sticky follows the person across clinic memberships;
- visible only when the active workspace matches that person's active membership role;
- Doctor administrator access to Assistant workspace shows no sticky;
- the Doctor never gains access to the Assistant's sticky;
- Assistant replacement/deactivation does not transfer or delete the former Assistant's sticky;
- autosave while typing; empty text is valid;
- no multiple notes, title, Delete/Trash, Undo, history, rich text, Patient links, task conversion, reminders, attachments, or notifications;
- desktop minimized strip is movable and the expanded sticky is movable/resizable;
- mobile minimized strip is movable and the expanded editor is full-screen;
- no Close action;
- minimized strip always shows **Private note** and never previews private text;
- content persists globally, while sticky position/size/minimized state is not stored on the server.

## Browser demo

GitHub Pages uses the same production React product UI and substitutes only browser-local API/storage behavior.

It must not expose a separate legacy username/demo application. The public demo is demonstration storage only and must not contain real Patient information.

It does not claim real trusted-device authority, email/SMS delivery, WebAuthn security, or medical-data guarantees.

## Repository structure

```text
backend/accounts/        personal accounts, memberships, sessions, devices, verification, passkeys, recovery
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

Backend verification:

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

Frontend verification:

```bash
npm test
npm run build
npm run build:demo
```

## Production boundary

This repository is not yet a production medical-data deployment. Production use still requires the later security/privacy/deployment work, real communication providers, backups, logging/audit decisions, monitoring, retention policy, jurisdiction-appropriate healthcare/privacy review, and explicit Phase 9/10 decisions.

Phase 9 sensitive attachment architecture has not started.
