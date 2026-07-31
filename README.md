# Health Hub

[![Verify foundation](https://github.com/sorooshaghaei/health-hub/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/sorooshaghaei/health-hub/actions/workflows/quality.yml)
[![Deploy frontend demo](https://github.com/sorooshaghaei/health-hub/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/sorooshaghaei/health-hub/actions/workflows/pages.yml)
[![Sponsor Health Hub](https://img.shields.io/badge/Sponsor-Health%20Hub-EA4AAA?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/sorooshaghaei)

Health Hub is a deliberately simple clinic workflow application for one Doctor and one Assistant. The frontend is React with Vite. The backend is Django REST Framework with PostgreSQL as the primary database.

Public frontend demo: <https://sorooshaghaei.github.io/health-hub/>

## Development sources of truth

- New chat/session handoff: [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md)
- Approved phased roadmap: [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md)
- Implemented Phase 1 specification: [`docs/PHASE_1_PATIENT_RECORDS.md`](docs/PHASE_1_PATIENT_RECORDS.md)
- Visual direction and assets: [`docs/design/README.md`](docs/design/README.md)

The project is developed directly on `main`, one approved phase at a time. After each phase, stop until the product owner explicitly says **continue**.

## Current phase

**Phase 1 — Patient records: repository implementation complete.**

Phase 2 has not been approved for implementation. Visits, appointments, working-day scheduling, queue behavior, consultation flow, checkout, tasks, personal notes, notifications, and estimates remain out of scope.

## Implemented product foundation

The two-level access flow is:

1. Create a clinic or enter an existing clinic with its clinic email and shared clinic password.
2. Choose Doctor or Assistant.
3. Create the role account if empty, or sign in to the existing role account.
4. Open the dedicated role workspace.

The clinic supports one Doctor and one Assistant. The Doctor is always the clinic administrator.

Implemented patient records:

- permanent reusable Patient profiles;
- required full name;
- required gender with `Man` and `Woman` values;
- required country calling code and national phone number, with Iran `+98` default;
- normalized E.164 phone storage;
- optional date of birth;
- optional shared Patient note visible and editable by both roles;
- combined name, phone, and date-of-birth search;
- one non-blocking **Possible duplicate patient** warning;
- matching-profile preference and explicit separate-profile creation;
- clinic-scoped list, create, detail, edit, and soft deletion;
- matching behavior in the browser-only Pages demo.

## Repository structure

```text
backend/accounts/                Clinic and staff authentication
backend/patients/                Phase 1 patient model, APIs, and tests
backend/health_hub/              Django project configuration
frontend/                        React/Vite application and demo adapter
docs/PROJECT_CONTEXT.md          New-session continuation context
docs/DEVELOPMENT_PLAN.md         Approved phased development plan
docs/PHASE_1_PATIENT_RECORDS.md  Implemented Phase 1 source of truth
docs/design/                     Visual direction and design assets
docker-compose.yml               Local PostgreSQL service
```

## Local setup

### Environment and PostgreSQL

```bash
cp .env.example .env
docker compose up -d db
```

Export the `.env` values in the shell before starting Django. No environment-loading library is included.

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

An explicit SQLite fallback remains available for isolated tests:

```bash
USE_SQLITE=true python manage.py test
```

SQLite is not the intended application database.

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

`npm test` validates clinic/staff authentication and the Phase 1 patient contract in the static demo. `npm run build` creates the backend-connected build. `npm run build:demo` creates the Pages build with browser-only storage and the `/health-hub/` base path.

## Current API surface

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
```

Clinic-scoped authentication endpoints expect `X-Clinic-Token`. Staff and patient endpoints expect `Authorization: Bearer <session-token>`.

A possible duplicate create or identity edit returns HTTP `409` with:

```json
{
  "code": "possible_duplicate",
  "detail": "Possible duplicate patient",
  "matches": []
}
```

Resubmit with `confirm_duplicate: true` only after the user explicitly chooses to create a separate profile.

## Production boundary

This repository is not a production medical-data deployment. Do not store real patient information in the GitHub Pages demo or treat browser storage as a medical-data backend.

Before production use, deployment requires TLS, production secret management, private infrastructure, database backups, reviewed audit requirements, confirmed password recovery, operational access controls, and a jurisdiction-appropriate privacy and security review.
