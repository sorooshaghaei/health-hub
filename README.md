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

**Phase 2 — Planned appointments and walk-ins: repository implementation complete, including the corrected workspace boundary.**

Phase 3 has not been approved for implementation. Arrival, check-in, live waiting order, consultation flow, checkout, tasks, personal notes, notifications, and estimates remain outside the current implementation.

## Access and workspace model

The clinic supports one Doctor account and one Assistant account. The Doctor is always the clinic administrator.

Account identity and active workspace are separate:

- Doctor credentials can open the Doctor workspace.
- Assistant credentials can open the Assistant workspace.
- Doctor administrator credentials can also open the Assistant workspace.
- Assistant credentials cannot open the Doctor workspace.

The active workspace determines management permission:

| Workspace | Patient records | Appointments and walk-ins |
| --- | --- | --- |
| Doctor | View and search | View lists and history |
| Assistant | Create, view, search, edit, delete | Create, view, edit, remove future Visits |

This keeps administrative scheduling and Patient maintenance out of the Doctor page. Backend authorization enforces the same boundary; it is not only a hidden-button rule.

## Implemented Patient records

Patient profiles include:

- required full name;
- required gender: `Man` or `Woman`;
- required calling code and national phone, with Iran `+98` default;
- normalized E.164 phone storage;
- optional date of birth;
- optional shared Patient note;
- combined name, phone, and date-of-birth search;
- one **Possible duplicate patient** warning;
- internal soft deletion without a visible archive state.

The Doctor workspace can view Patient profiles and Visit history. Patient creation, editing, notes changes, and deletion occur only in the Assistant workspace.

## Implemented appointments and walk-ins

The Assistant workspace can:

- create scheduled appointments with Patient, date, time, and optional reason;
- add walk-ins with Patient and automatic current date;
- create a new Patient inside the Visit form;
- edit past and future Visits;
- remove future Visits;
- record multiple Visits for the same Patient on the same date;
- view Visit history inside the Patient profile.

The Doctor workspace can view appointment and walk-in lists and Patient Visit history without management controls.

Scheduled appointment time is informational and does not determine future live waiting order.

## Repository structure

```text
backend/accounts/                Clinic, staff, session, and workspace access
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

## API authorization

Clinic-entry endpoints expect `X-Clinic-Token`. Staff, Patient, and Visit endpoints expect `Authorization: Bearer <session-token>`.

The staff session stores both the authenticated account and the active `workspace_role`. Doctor-workspace sessions may use read endpoints but receive HTTP `403` for Patient or Visit mutations. Assistant-workspace sessions may manage those resources, including when the authenticated account is the Doctor administrator.

## Removal and history rules

- Future Visits must be removed before deleting a Patient.
- Only future Visits can be removed.
- Past Visits remain historical.
- Patient identity snapshots remain attached to historical Visits.
- Deleted Patients are excluded from active search and cannot receive new Visits.
- There is no visible Patient archive state or Visit Cancelled state.

## Automated verification

`.github/workflows/quality.yml` runs browser-adapter tests, frontend builds, Django checks, migration verification, PostgreSQL migrations, and backend tests.

`.github/workflows/pages.yml` builds and deploys the browser demo from `main`.

## Production boundary

This repository is not a production medical-data deployment. Do not store real Patient information in the GitHub Pages demo or treat browser storage as a medical backend.

Production use requires TLS, production secret management, private infrastructure, database backups, reviewed audit requirements, confirmed password recovery, operational access controls, and a jurisdiction-appropriate privacy and security review.
