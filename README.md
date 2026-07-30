# Health Hub

Health Hub is a deliberately simple clinic workflow application for one Doctor and one Assistant. The frontend is React with Vite. The backend is Django REST Framework with PostgreSQL as the primary database.

## Current implementation

This first foundation implements the approved two-level access flow:

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

The patient workflow, tasks, private notes, checkout notification, password recovery, and day-end estimate are intentionally not implemented in this foundation. Their unresolved behavior will not be invented.

## Repository structure

```text
backend/   Django REST Framework API
frontend/  React/Vite application
docker-compose.yml  Local PostgreSQL service
```

## Local setup

### 1. Environment and PostgreSQL

```bash
cp .env.example .env
docker compose up -d db
```

Export the values from `.env` in your shell or use an environment loader of your choice before starting Django.

### 2. Backend

Django 6 requires Python 3.12 or newer.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Run the backend tests with an isolated SQLite database:

```bash
USE_SQLITE=true python manage.py test
```

SQLite exists only as an explicit test/development fallback. PostgreSQL remains the intended application database.

### 3. Frontend

Vite 8 requires a current Node.js release.

```bash
cd frontend
npm install
npm run dev
```

The Vite development server proxies `/api` to `http://127.0.0.1:8000`, so no additional CORS package is required.

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

## Production note

This repository is not yet a production medical-data deployment. Before real patient information is stored, deployment must include TLS, production secret management, database backups, audit requirements, a reviewed password-recovery design, operational access controls, and a jurisdiction-appropriate privacy/security review.
