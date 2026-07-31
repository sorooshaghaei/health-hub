# Health Hub

[![Verify foundation](https://github.com/sorooshaghaei/health-hub/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/sorooshaghaei/health-hub/actions/workflows/quality.yml)
[![Deploy frontend demo](https://github.com/sorooshaghaei/health-hub/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/sorooshaghaei/health-hub/actions/workflows/pages.yml)
[![Sponsor Health Hub](https://img.shields.io/badge/Sponsor-Health%20Hub-EA4AAA?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/sorooshaghaei)

Health Hub is a deliberately simple clinic workflow application for one Doctor and one Assistant. The frontend is React with Vite. The backend is Django REST Framework with PostgreSQL as the primary database.

Public frontend demo: <https://sorooshaghaei.github.io/health-hub/>

## Development sources of truth

- New-session handoff: [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md)
- Phased roadmap: [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md)
- Patient records: [`docs/PHASE_1_PATIENT_RECORDS.md`](docs/PHASE_1_PATIENT_RECORDS.md)
- Appointments and walk-ins: [`docs/PHASE_2_VISITS.md`](docs/PHASE_2_VISITS.md)
- Visual direction: [`docs/design/README.md`](docs/design/README.md)

The project is developed directly on `main`, one approved phase at a time. After each phase, implementation stops until the product owner explicitly says **continue**.

## Current phase

**Phase 2 — Planned appointments and walk-ins: repository implementation complete.**

Phase 3 has not been approved for implementation. Arrival, check-in, live waiting order, consultation flow, checkout, tasks, personal notes, notifications, and estimates remain outside the current implementation.

## Implemented workflow

### Access

1. Create or enter the clinic with the shared clinic credentials.
2. Choose Doctor or Assistant.
3. Create the role account if empty, or sign in.
4. Open the dedicated role workspace.

The Doctor is always the clinic administrator. The clinic supports one Doctor and one Assistant.

### Patient records

Both roles can:

- create, view, search, edit, and soft-delete active Patient profiles;
- use full name, `Man` / `Woman`, calling code, phone, optional date of birth, and optional Patient note;
- search by name, phone, or date of birth;
- use one **Possible duplicate patient** warning;
- select an existing matching profile or explicitly create a separate Patient.

Iran `+98` is the default calling code. Phone numbers are stored as normalized national and E.164 values.

### Appointments and walk-ins

Both roles can:

- create scheduled appointments with Patient, date, time, and optional reason;
- add walk-ins with Patient and automatic current date;
- create a new Patient inside the Visit form;
- edit past and future Visits;
- remove future Visits;
- record multiple Visits for the same Patient on the same date;
- view Visit history inside the Patient profile.

Appointment management is assistant-first in the interface. The Assistant opens on Schedule. The Doctor opens on Patient records and has a secondary Appointments tab with the same permissions.

Scheduled appointment time is informational and does not determine future live waiting order.

## Repository structure

```text
backend/accounts/                Clinic and staff authentication
backend/patients/                Patient records
backend/visits/                  Appointments, walk-ins, and Visit history
backend/health_hub/              Django project configuration
frontend/                        React/Vite application and browser adapter
docs/PROJECT_CONTEXT.md          Continuation handoff
docs/DEVELOPMENT_PLAN.md         Approved roadmap and pending decisions
docs/PHASE_1_PATIENT_RECORDS.md  Patient contract
docs/PHASE_2_VISITS.md           Appointment and walk-in contract
docs/design/                     Visual direction and assets
docker-compose.yml               Local PostgreSQL service
```

## Local setup

### PostgreSQL

```bash
cp .env.example .env
docker compose up -d db
```

Export the `.env` values in the shell before starting Django.

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

PostgreSQL remains the intended application database.

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

The normal Vite development server proxies `/api` to Django. The demo build uses the same React interface with browser-only storage and the `/health-hub/` Pages base path.

## API surface

```text
GET    /api/health/
POST   /api/clinics/
POST   /api/clinics/enter/
GET    /api/clinic/context/
POST   /api/staff/register/
POST   /api/staff/login/
GET    /api/staff/me/
POST   /api/staff/logout/

GET    /api/patients/?search=<name|phone|date>
POST   /api/patients/
GET    /api/patients/<patient-id>/
PATCH  /api/patients/<patient-id>/
DELETE /api/patients/<patient-id>/

GET    /api/visits/?date=YYYY-MM-DD
GET    /api/visits/?patient=<patient-id>
POST   /api/visits/
GET    /api/visits/<visit-id>/
PATCH  /api/visits/<visit-id>/
DELETE /api/visits/<visit-id>/
```

Clinic-entry endpoints expect `X-Clinic-Token`. Staff, Patient, and Visit endpoints expect `Authorization: Bearer <session-token>`.

Visit creation accepts either an active `patient_id` or a nested `new_patient`. Nested Patient and Visit creation is atomic.

## Removal and history rules

- Future Visits must be removed before deleting a Patient.
- Only future Visits can be removed.
- Past Visits remain historical.
- Patient identity snapshots remain attached to historical Visits.
- Deleted Patients are excluded from active search and cannot receive new Visits.
- There is no visible Patient archive state or Visit Cancelled state.

## Automated verification

`.github/workflows/quality.yml` runs:

- browser-adapter tests;
- normal frontend build;
- GitHub Pages demo build;
- Django system checks;
- committed migration verification;
- PostgreSQL migrations;
- backend tests against PostgreSQL 17.

`.github/workflows/pages.yml` builds and deploys the browser demo from `main`.

## Production boundary

This repository is not a production medical-data deployment. Do not store real Patient information in the GitHub Pages demo or treat browser storage as a medical backend.

Production use requires TLS, production secret management, private infrastructure, database backups, reviewed audit requirements, confirmed password recovery, operational access controls, and a jurisdiction-appropriate privacy and security review.
