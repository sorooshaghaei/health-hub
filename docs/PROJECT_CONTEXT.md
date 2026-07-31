# Health Hub project continuation context

This file is the handoff entry point for a new chat or development session.

## Repository and workflow

- Repository: `sorooshaghaei/health-hub`
- Working branch: `main`
- Work directly on `main`; do not create branches or pull requests unless the product owner explicitly changes this instruction.
- Implement one approved phase at a time.
- Ask before choosing an unapproved field, state, screen, action, permission, algorithm, dependency, or workflow.
- After implementing and validating a phase, update documentation, commit, report exact changes, and stop.
- Continue only after the product owner explicitly says **continue**.

## Product baseline

Health Hub is a deliberately simple clinic workflow application for one clinic with one Doctor account and one Assistant account. It uses React/Vite, Django REST Framework, and PostgreSQL. The public GitHub Pages build uses the same React frontend with a browser-only adapter and is not medical-data storage.

## Critical account and workspace rule

The Doctor is the clinic administrator, but the Doctor page must remain focused on Doctor work.

Account identity and active workspace are separate:

- Doctor username/password can open the Doctor workspace.
- Doctor username/password can also open the Assistant workspace for administrator intervention.
- Assistant username/password can open the Assistant workspace.
- Assistant credentials cannot open the Doctor workspace.

The session stores `workspace_role`.

### Doctor workspace

- view and search Patient profiles;
- view Patient details and Patient notes;
- view Patient Visit history;
- view appointment and walk-in lists;
- no Patient creation, editing, note editing, or deletion;
- no appointment/walk-in creation, editing, or removal.

### Assistant workspace

- create, view, search, edit, and delete Patients;
- create appointments and walk-ins;
- edit past and future Visits;
- remove future Visits;
- create a Patient and Visit together in one form.

This boundary is enforced in backend mutation endpoints and mirrored by the frontend and browser adapter.

## Implemented phases

### Phase 0 — Foundation

Implemented clinic access, staff accounts, Doctor administrator status, one account per role, session authentication, PostgreSQL setup, frontend builds, tests, workflows, and design assets.

### Phase 1 — Patient records

Implemented:

- reusable clinic-scoped Patient model;
- full name, `Man` / `Woman`, calling code, phone, optional date of birth, and optional Patient note;
- Iran `+98` default and country-aware phone validation;
- combined name/phone/date search;
- one **Possible duplicate patient** warning;
- internal soft deletion;
- Doctor-workspace read access;
- Assistant-workspace management access.

See [`PHASE_1_PATIENT_RECORDS.md`](PHASE_1_PATIENT_RECORDS.md).

### Phase 2 — Appointments and walk-ins

Implemented:

- scheduled appointments: Patient, date, scheduled time, optional reason;
- walk-ins: Patient and automatic current date;
- repeated same-day Visits;
- past and future Visit editing in Assistant workspace;
- future Visit removal only;
- Patient Visit history inside Patient profile;
- inline Patient + Visit creation;
- future-Visit deletion block for Patients;
- historical Patient identity snapshots;
- Doctor view-only appointment list;
- Assistant schedule management;
- Doctor administrator login to Assistant workspace.

Scheduled appointment time is informational and does not determine future live waiting order.

See [`PHASE_2_VISITS.md`](PHASE_2_VISITS.md).

## Current phase

**Phase 2 repository implementation and workspace-boundary correction are complete. Stop until the product owner explicitly says continue.**

External GitHub Actions and live Pages outcomes may require separate confirmation because they are deployment results rather than repository content.

## Next action

Do not begin Phase 3 automatically.

When the product owner says **continue**, first resolve the Phase 3 decisions in [`DEVELOPMENT_PLAN.md`](DEVELOPMENT_PLAN.md):

- exact queue-row information;
- early/late arrival presentation;
- accidental check-in reversal;
- equal check-in timestamps;
- planned versus walk-in presentation;
- temporary Patient unavailability;
- Patient departure before consultation;
- exact Assistant and Doctor workspace responsibilities for arrival and queue actions.

Already confirmed:

```text
PLANNED → ARRIVED
```

Waiting order is based on actual check-in order, not scheduled appointment time.
