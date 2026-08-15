# Health Hub

[![Verify foundation](https://github.com/sorooshaghaei/health-hub/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/sorooshaghaei/health-hub/actions/workflows/quality.yml)
[![Deploy frontend demo](https://github.com/sorooshaghaei/health-hub/actions/workflows/pages.yml/badge.svg?branch=main)](https://github.com/sorooshaghaei/health-hub/actions/workflows/pages.yml)
[![Sponsor Health Hub](https://img.shields.io/badge/Sponsor-Health%20Hub-EA4AAA?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/sorooshaghaei)

Health Hub is a deliberately simple clinic workflow application for one Doctor and one Assistant. The frontend is React/Vite. The backend is Django REST Framework with PostgreSQL as the primary database.

Public frontend demo: <https://sorooshaghaei.github.io/health-hub/>

## Sources of truth

- Continuation handoff: [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md)
- Phased roadmap: [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md)
- Patient records: [`docs/PHASE_1_PATIENT_RECORDS.md`](docs/PHASE_1_PATIENT_RECORDS.md)
- Planned appointments: [`docs/PHASE_2_VISITS.md`](docs/PHASE_2_VISITS.md)
- Check-in and live queue: [`docs/PHASE_3_QUEUE.md`](docs/PHASE_3_QUEUE.md)
- Doctor room call and consultation handoff: [`docs/PHASE_4_CONSULTATION.md`](docs/PHASE_4_CONSULTATION.md)
- Completed consultation behavior: [`docs/PHASE_5_COMPLETION.md`](docs/PHASE_5_COMPLETION.md)
- Shared tasks: [`docs/PHASE_6_SHARED_TASKS.md`](docs/PHASE_6_SHARED_TASKS.md)
- Private sticky: [`docs/PHASE_7_PRIVATE_NOTES.md`](docs/PHASE_7_PRIVATE_NOTES.md)
- Visual direction: [`docs/design/README.md`](docs/design/README.md)

The project is developed directly on `main`, one approved phase at a time. Implementation stops after each phase until the product owner explicitly says **continue**.

## Current phase

**Phase 7 — Private sticky: repository implementation complete.**

Each staff account has one private, persistent plain-text scratchpad in its own workspace. It autosaves to the server, stays fixed to the viewport, minimizes to a movable strip, and opens as a draggable/resizable desktop sticky or full-screen mobile editor. Doctor administrator access to Assistant workspace shows no private sticky. The next phase is **Phase 8 — Password recovery and clinic administration**; it has not started.

## Access model

The clinic supports one Doctor account and one Assistant account. The Doctor is always the clinic administrator.

- Doctor credentials can open Doctor workspace.
- Doctor credentials can also open Assistant workspace.
- Assistant credentials can open Assistant workspace.
- Assistant credentials cannot open Doctor workspace.

Doctor workspace owns the Room ready signal, views Appointment administration read-only, and may edit every approved Patient field. Patient creation/deletion and Appointment administration remain in Assistant workspace. A Doctor account inside Assistant workspace receives the same full administrative controls as the Assistant.

Task authoring is based on account identity rather than active workspace: Doctor credentials may create/edit/delete Doctor-to-Assistant tasks from either workspace; Assistant credentials cannot author tasks.

Private sticky access is stricter and matches account ownership to the active workspace. The Doctor sees the Doctor sticky only in Doctor workspace; the Assistant sees the Assistant sticky only in Assistant workspace. Doctor administrator access to Assistant workspace exposes neither account's private sticky.

## Implemented workflow

### Patient records

- reusable clinic-scoped Patient profiles;
- full name, `Man`/`Woman`, country/calling code, phone, optional date of birth, optional shared Patient note;
- Iran `+98` default;
- compact flag-and-country selector with the selected calling code beside a large national-number field; the control stacks into the same two-part structure on mobile;
- one combined phone display in the Patient profile;
- automatic search while typing by name, phone, or date of birth;
- Doctor and Assistant workspaces may edit all approved Patient fields;
- Patient creation/deletion remains Assistant-workspace administration;
- one **Possible duplicate patient** warning;
- internal soft deletion with five-second Undo.

### Appointments

Every clinic attendance is an Appointment with:

- Patient;
- date;
- scheduled time;
- optional visit reason.

A Patient may have Appointments on different dates but may have only one active Appointment on a given clinic date. Creating or editing a duplicate returns the existing Appointment so the Assistant can open it instead. A deleted Appointment reserves that Patient/date during its five-second Undo period; after expiry, a replacement may be created.

Every clinic attendance uses a normal Appointment. When a Patient arrives without one for today, the Assistant creates a same-day Appointment; the frontend defaults its time to the current local time; then the Assistant checks the Patient in.

Appointment create/edit/delete controls are available in Assistant workspace, including when a Doctor administrator enters that workspace. Doctor workspace intentionally omits those administrative controls.

The Appointment create/edit form starts with Patient information. After two name characters, matching existing Patients appear in a floating suggestion list showing name, phone, gender, and date of birth when available. Selecting one collapses the Patient section into a compact card; otherwise the same fields continue as new-Patient creation. Date, scheduled time, and reason appear below the Patient section.

### Check-in and live queue

```text
PLANNED → CHECKED_IN
```

- only today's Appointments can be checked in;
- the check-in timestamp records the Assistant's check-in action;
- queue order is persisted check-in order, not scheduled time;
- equal check-in timestamps retain first-saved order through an internal sequence;
- the queue shows position, Patient name, gender, scheduled time, check-in time, and optional reason;
- Assistant Appointment list and queue show phone;
- Doctor queue omits phone;
- there are no early/late, unavailable, Left, Cancelled, or no-show states;
- checked-in Patient and date are locked; scheduled time and reason remain editable;
- live operational state refreshes every three seconds.

### Room call, consultation handoff, and completion

```text
CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

- Doctor taps **Room ready** as a one-time call;
- any current `WITH_DOCTOR` Patient becomes `DOCTOR_FINISHED`;
- `DOCTOR_FINISHED` is final and appears as **Completed** in user-facing status text;
- there is no separate Checkout action, checkout queue, checkout form, `CHECKED_OUT` state, or checkout timestamp;
- `doctor_finished_at` remains the completion timestamp;
- Assistant receives the room-ready call only after the Doctor's five-second Undo period;
- Undo **Room ready** within that window restores the completed Patient to `WITH_DOCTOR`;
- the call persists even when the queue is empty;
- first waiting Patient is suggested, but Assistant may select any checked-in Patient;
- Assistant taps **With doctor** to consume the call;
- the selected Patient leaves the waiting queue without changing any original check-in sequence;
- the Assistant can Undo **With doctor** for five seconds, restoring both Patient and pending call;
- Doctor sees the current Patient in a compact, expandable consultation card with the shared Patient note;
- completed Appointments remain visible in the daily Appointment list and Patient history;
- there is no Doctor Finished, Checkout, Pause, Return, or automatic-next-patient action;
- clinic-scoped transactional locking protects use from separate Doctor and Assistant computers.

### Shared tasks

```text
OPEN → DONE
```

- only the Doctor account creates tasks and every task is for the Assistant;
- task fields are title, description, optional date-only due date, and optional single Patient association;
- clicking **New task** opens a compact modal so the Open task list stays visually stable instead of moving under an inline create form;
- both workspaces see the same shared task data;
- Open tasks sort oldest first;
- the Assistant normally taps **Done** after performing a task; the Doctor can also mark Done if needed;
- Done has a server-enforced five-second Undo back to Open;
- after Undo expires there is no permanent Reopen action;
- completed tasks leave Open and remain available in History;
- the Doctor creator may edit tasks;
- only the Doctor may delete tasks, including completed tasks, with five-second Undo;
- Doctor and Assistant can comment, but each may edit/delete only their own comments;
- edited comments show **Edited** and comment deletion has five-second Undo;
- optional Patient links open the Patient profile without adding tasks to Patient profiles;
- there are no task attachments;
- a new Doctor-created task shows a small red dot beside **Tasks** only for the Assistant account;
- a task completed by the Assistant shows a small red dot beside **Tasks** for the Doctor account;
- opening Tasks clears the current account's dot, and the active Tasks view keeps seen state current while it remains open;
- tasks that existed before the attention feature was introduced are initialized as already seen;
- the red dot is only an in-app attention marker: no task sound, push/OS notification, popup alert, email, badge count, comment alert, or due-date alert is added;
- shared task and attention state use lightweight authenticated polling so separate Doctor and Assistant computers stay current.

### Private sticky

- one plain-text scratchpad per staff account, not a collection of notes;
- no title, ordering, history, Edited label, delete action, or separate Notes page;
- text and line breaks autosave to the server while typing and persist across days and sign-ins;
- erasing all text saves the same scratchpad as a blank page;
- the sticky is fixed to the viewport on every page of the account's own workspace;
- it minimizes to a movable yellow strip at the lower-right without a Close action;
- on desktop, the opened sticky is draggable and resizable;
- on mobile, the minimized strip remains movable and the opened editor fills the screen;
- no formatting, colors, Patient links, reminders, attachments, search, notifications, or routine Saving/Saved indicator;
- Doctor administrator access to Assistant workspace shows neither the Doctor nor Assistant sticky;
- backend authorization and browser-demo behavior enforce the same workspace privacy rule.

### Five-second Undo

Server-enforced Undo applies to:

- Check in;
- Room ready;
- With doctor;
- Appointment deletion;
- Patient deletion;
- task Done;
- task deletion;
- task comment deletion.

Normal form edits use the regular Edit flow.

## Repository structure

```text
backend/accounts/                Clinic, staff, sessions, workspace access
backend/patients/                Patient records and deletion Undo
backend/visits/                  Appointments, queue, room calls, consultation handoff
backend/tasks/                   Shared Doctor-to-Assistant tasks and comments
backend/health_hub/              Django project configuration
frontend/                        React/Vite app and browser adapter
docs/                            Product specifications and handoff
docker-compose.yml               Local PostgreSQL service
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

## API surface

```text
GET    /api/health/
POST   /api/clinics/
POST   /api/clinics/enter/
GET    /api/clinic/context/
POST   /api/staff/register/
POST   /api/staff/login/
GET    /api/staff/me/
GET    /api/staff/private-note/
PATCH  /api/staff/private-note/
POST   /api/staff/logout/

GET    /api/patients/?search=<name|phone|date>
POST   /api/patients/
GET    /api/patients/<patient-id>/
PATCH  /api/patients/<patient-id>/
DELETE /api/patients/<patient-id>/
POST   /api/patients/<patient-id>/undo-delete/

GET    /api/visits/?date=YYYY-MM-DD
GET    /api/visits/?patient=<patient-id>
POST   /api/visits/
GET    /api/visits/<visit-id>/
PATCH  /api/visits/<visit-id>/
DELETE /api/visits/<visit-id>/
GET    /api/visits/queue/
GET    /api/visits/room-state/
POST   /api/visits/<visit-id>/check-in/
POST   /api/visits/<visit-id>/undo-check-in/
POST   /api/visits/room-ready/
POST   /api/visits/room-ready/undo/
POST   /api/visits/<visit-id>/with-doctor/
POST   /api/visits/<visit-id>/undo-with-doctor/
POST   /api/visits/<visit-id>/undo-delete/

GET    /api/tasks/
POST   /api/tasks/
GET    /api/tasks/attention/
POST   /api/tasks/attention/
GET    /api/tasks/<task-id>/
PATCH  /api/tasks/<task-id>/
DELETE /api/tasks/<task-id>/
POST   /api/tasks/<task-id>/done/
POST   /api/tasks/<task-id>/undo-done/
POST   /api/tasks/<task-id>/undo-delete/
POST   /api/tasks/<task-id>/comments/
PATCH  /api/task-comments/<comment-id>/
DELETE /api/task-comments/<comment-id>/
POST   /api/task-comments/<comment-id>/undo-delete/
```

`GET /api/health/`, `POST /api/clinics/`, and `POST /api/clinics/enter/` are public. `GET /api/clinic/context/`, `POST /api/staff/register/`, and `POST /api/staff/login/` expect `X-Clinic-Token`. All other listed staff, Patient, Appointment, and task endpoints expect `Authorization: Bearer <session-token>`.

## Migration behavior

The Phase 3 migration fills scheduled times for legacy rows and removes the obsolete `visit_type` field. Phase 4 adds consultation timestamps and one clinic-scoped room-call record. The one-Appointment-per-date migration adds an active uniqueness constraint and deliberately stops if existing active duplicates require manual resolution. Phase 5 adds no database migration. Phase 6 adds new clinic-scoped task and task-comment tables. The attention-dot correction adds a per-staff task-seen timestamp initialized at migration time so existing tasks are treated as already seen. Phase 7 adds one blank-by-default private-note text field to each staff account; it does not alter Patient, Appointment, task, or existing account data. The browser demo performs equivalent local-storage migration and validation for existing demo data.

## Production boundary

This repository is not a production medical-data deployment. Do not store real Patient information in the GitHub Pages demo or treat browser storage as a medical backend.

Production use requires TLS, production secret management, private infrastructure, database backups, reviewed audit requirements, confirmed password recovery, operational access controls, and a jurisdiction-appropriate privacy and security review.
