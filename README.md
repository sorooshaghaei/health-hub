# Health Hub

[![Verify foundation](https://github.com/sorooshaghaei/health-hub/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/sorooshaghaei/health-hub/actions/workflows/quality.yml)
[![Deploy frontend demo](https://github.com/sorooshaghaei/health-hub/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/sorooshaghaei/health-hub/actions/workflows/pages.yml)
[![Sponsor Health Hub](https://img.shields.io/badge/Sponsor-Health%20Hub-EA4AAA?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/sorooshaghaei)

Health Hub is a deliberately simple clinic workflow application for one Doctor and one Assistant. The frontend is React with Vite. The backend is Django REST Framework with PostgreSQL as the primary database.

Public frontend demo: <https://sorooshaghaei.github.io/health-hub/>

The approved phased roadmap and the mandatory ask-before-implementation workflow are documented in [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md).

## Current phase

**Phase 0 — Foundation verification**

The current foundation implements the approved two-level access flow:

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

The patient workflow, tasks, private notes, checkout indication, password recovery, and day-end estimate are intentionally not implemented in this foundation. Their unresolved behavior will not be invented.

## Repository structure

```text
backend/                 Django REST Framework API
frontend/                React/Vite application
docs/DEVELOPMENT_PLAN.md Approved phased development plan
docker-compose.yml       Local PostgreSQL service
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

Run the backend tests with PostgreSQL using the environment values from `.env`:

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

Verify both frontend build modes:

```bash
npm run build
npm run build:demo
```

`npm run build` creates the backend-connected application build. `npm run build:demo` creates the same frontend with the browser-only data adapter and the `/health-hub/` GitHub Pages base path.

## Automated verification

`.github/workflows/quality.yml` verifies:

- the normal frontend build;
- the GitHub Pages demo build;
- Django system checks;
- committed migration consistency;
- migrations against PostgreSQL 17;
- backend tests against PostgreSQL 17.

`.github/workflows/pages.yml` builds and publishes the browser demo from `main`.

GitHub Pages must use **GitHub Actions** as its deployment source in the repository settings.

## API surface

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

## Production boundary

This repository is not yet a production medical-data deployment. Do not store real patient information in the GitHub Pages demo or treat its browser storage as a medical-data backend.

Before production use with medical information, deployment must include TLS, production secret management, private infrastructure, database backups, reviewed audit requirements, a confirmed password-recovery design, operational access controls, and a jurisdiction-appropriate privacy and security review.
