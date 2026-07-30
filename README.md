# Health Hub

[![Verify foundation](https://github.com/sorooshaghaei/health-hub/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/sorooshaghaei/health-hub/actions/workflows/quality.yml)
[![Deploy frontend demo](https://github.com/sorooshaghaei/health-hub/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/sorooshaghaei/health-hub/actions/workflows/pages.yml)
[![Sponsor Health Hub](https://img.shields.io/badge/Sponsor-Health%20Hub-EA4AAA?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/sorooshaghaei)

Health Hub is a deliberately simple clinic workflow application for one Doctor and one Assistant. The frontend is React with Vite. The backend is Django REST Framework with PostgreSQL as the primary database.

Public frontend demo: <https://sorooshaghaei.github.io/health-hub/>

## Development sources of truth

- New chat/session handoff: [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md)
- Approved phased roadmap: [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md)
- Approved Phase 1 patient specification: [`docs/PHASE_1_PATIENT_RECORDS.md`](docs/PHASE_1_PATIENT_RECORDS.md)
- Visual direction and assets: [`docs/design/README.md`](docs/design/README.md)

The project is developed directly on `main`, one approved phase at a time. Unresolved fields, actions, states, permissions, algorithms, libraries, and workflow behavior must be confirmed with the product owner before implementation. After each phase, stop until the product owner explicitly says **continue**.

## Current phase

**Phase 1 — Patient specification and records: product specification approved; implementation not started.**

Phase 0 repository implementation is complete. Current external Actions and live Pages results may still require separate confirmation.

The next approved implementation is limited to the reusable Patient profile described in `docs/PHASE_1_PATIENT_RECORDS.md`. It includes:

- required full name;
- required gender with `Man` and `Woman` values;
- required country calling code and phone number, with Iran `+98` selected by default;
- optional date of birth;
- optional shared Patient note visible and editable by both Doctor and Assistant;
- combined name, phone, and date-of-birth search;
- one non-blocking **Possible duplicate patient** warning;
- patient create, view, edit, search, and controlled deletion behavior.

A Patient is the permanent reusable person profile. A Visit is a separate clinic attendance. Visits, appointments, working-day scheduling, and queue behavior are not part of Phase 1 and must not be implemented yet.

## Current foundation

The implemented two-level access flow is:

1. Create a clinic or enter an existing clinic with its clinic email and shared clinic password.
2. Choose Doctor or Assistant.
3. Create the role account if that role is empty, or sign in to the existing role account.
4. Open the dedicated Doctor or Assistant workspace.

The clinic supports one Doctor account and one Assistant account. The Doctor is always the clinic administrator. The Assistant remains a distinct workflow role and does not receive Doctor actions.

Implemented security boundaries:

- clinic passwords are stored with Django password hashing;
- individual staff passwords use Django's user authentication system;
- short-lived signed clinic-access tokens protect role discovery and staff account creation/login;
- expiring opaque staff sessions are stored as SHA-256 hashes, not as raw tokens;
- role uniqueness is enforced in PostgreSQL and in the API;
- role and clinic membership are checked again during staff login.

## Repository structure

```text
backend/                         Django REST Framework API
frontend/                        React/Vite application
docs/PROJECT_CONTEXT.md          New-session continuation context
docs/DEVELOPMENT_PLAN.md         Approved phased development plan
docs/PHASE_1_PATIENT_RECORDS.md  Approved Phase 1 source of truth
docs/design/                     Visual direction and design assets
docker-compose.yml               Local PostgreSQL service
```

## Local setup

### 1. Environment and PostgreSQL

```bash
cp .env.example .env
docker compose up -d db
```

Export the values from `.env` in your shell before starting Django. No environment-loading library is included because external libraries require explicit approval.

### 2. Backend

Django 6 requires Python 3.12 or newer.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Run backend verification with PostgreSQL using the environment values from `.env`:

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py migrate --noinput
python manage.py test
```

An explicit SQLite fallback remains available for isolated local tests:

```bash
USE_SQLITE=true python manage.py test
```

SQLite is not the intended application database.

### 3. Frontend

Use Node.js 22.

```bash
cd frontend
npm install
npm run dev
```

The Vite development server proxies `/api` to `http://127.0.0.1:8000`, so no additional CORS package is required.

Verify the browser adapter and both frontend build modes:

```bash
npm test
npm run build
npm run build:demo
```

`npm test` validates the clinic and staff authentication flow used by the static demo. `npm run build` creates the backend-connected application build. `npm run build:demo` creates the same frontend with the browser-only data adapter and the `/health-hub/` GitHub Pages base path.

## Automated verification

`.github/workflows/quality.yml` verifies:

- the browser demo authentication flow;
- the normal frontend build;
- the GitHub Pages demo build;
- Django system checks;
- committed migration consistency;
- migrations against PostgreSQL 17;
- backend authentication and authorization tests against PostgreSQL 17.

`.github/workflows/pages.yml` builds and publishes the browser demo from `main`.

GitHub Pages must use **GitHub Actions** as its deployment source in the repository settings.

## Current API surface

```text
GET  /api/health/
POST /api/clinics/
POST /api/clinics/enter/
GET  /api/clinic/context/
POST /api/staff/register/
POST /api/staff/login/
GET  /api/staff/me/
POST /api/staff/logout/
```

Clinic-scoped endpoints expect `X-Clinic-Token`. Staff-scoped endpoints expect `Authorization: Bearer <session-token>`.

Patient APIs are not implemented yet.

## Production boundary

This repository is not yet a production medical-data deployment. Do not store real patient information in the GitHub Pages demo or treat its browser storage as a medical-data backend.

Before production use with medical information, deployment must include TLS, production secret management, private infrastructure, database backups, reviewed audit requirements, a confirmed password-recovery design, operational access controls, and a jurisdiction-appropriate privacy and security review.