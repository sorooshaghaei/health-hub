# Health Hub project continuation context

This file is the handoff entry point for a new chat or development session.

## Repository and workflow

- Repository: `sorooshaghaei/health-hub`
- Working branch: `main`
- Work directly on `main`; do not create branches or pull requests unless the product owner explicitly changes this instruction.
- Implement one approved phase at a time.
- Before choosing an unapproved field, screen, action, state, permission, algorithm, library, or workflow behavior, ask the product owner.
- After implementing a phase, validate it, report the exact changes, and stop.
- Continue only after the product owner explicitly says **continue**.

## Product baseline

Health Hub is a deliberately simple clinic workflow application for one clinic with one Doctor and one Assistant.

- React and Vite frontend;
- Django REST Framework backend;
- PostgreSQL primary database;
- English-first left-to-right interface;
- Doctor as clinic administrator;
- separate Doctor and Assistant accounts and workspaces.

The GitHub Pages build uses the real React frontend with a browser-only adapter. It is a demonstration environment and must not be treated as medical-data storage.

## Current implementation

### Phase 0 — Foundation

Complete:

- clinic creation and clinic-level sign-in;
- Doctor and Assistant individual accounts;
- Doctor administrator enforcement;
- one account per role per clinic;
- separate role workspaces;
- PostgreSQL configuration and migrations;
- authentication and authorization tests;
- normal and demo frontend builds;
- GitHub Actions quality and Pages workflows;
- visual identity assets and tokens.

### Phase 1 — Patient records

Complete:

- reusable clinic-scoped Patient profiles;
- required full name and `Man` / `Woman` gender;
- country calling code and normalized phone with Iran `+98` default;
- optional date of birth and shared Patient note;
- Doctor and Assistant create, view, search, edit, and soft-delete access;
- combined name, phone, and date-of-birth search;
- one **Possible duplicate patient** warning;
- patient list, form, detail, note, and deletion interface;
- equivalent browser-demo behavior and tests.

### Phase 2 — Planned appointments and walk-ins

Complete:

- separate clinic-scoped Visit model;
- scheduled appointments with Patient, date, scheduled time, and optional reason;
- walk-ins with Patient and automatic current date;
- repeated same-day Visits;
- past and future Visit editing;
- permanent removal of future Visits only;
- Patient Visit history inside the Patient profile;
- existing-Patient suggestions showing full name, phone, date of birth, and gender;
- atomic inline Patient and Visit creation;
- Patient deletion blocked while future Visits exist;
- historical Patient identity snapshots retained by past Visits;
- Assistant-first Schedule section and Doctor-secondary Appointments tab;
- equivalent browser-demo behavior and tests.

The complete Phase 2 contract is in [`PHASE_2_VISITS.md`](PHASE_2_VISITS.md).

## Current phase

**Phase 2 — Planned appointments and walk-ins: repository implementation complete. Stop until the product owner explicitly says continue.**

Current external Actions and live Pages results may need separate confirmation because they are deployment outcomes rather than repository code.

## Key Phase 2 contract

A Patient is permanent and reusable. A Visit is one separate attendance.

Appointment fields:

- Patient;
- date;
- scheduled time;
- optional reason.

Walk-in fields:

- Patient;
- automatic current date.

Both roles have full Visit permissions, but the UI remains assistant-first. The Assistant opens Schedule. The Doctor opens Patient records and can enter Appointments through a secondary tab.

Past and future Visits may be edited. Only future Visits may be removed. There is no Cancelled state. Multiple same-day Visits are allowed.

Inline Patient creation and Visit creation are atomic. Duplicate matching uses the existing Phase 1 warning and preserves the Visit draft.

## Next action

Do not begin Phase 3 automatically.

When the product owner says **continue**, first resolve the Phase 3 decisions recorded in `docs/DEVELOPMENT_PLAN.md`:

- exact queue-row information;
- early and late arrival presentation;
- accidental check-in reversal;
- equal check-in timestamps;
- planned versus walk-in presentation;
- temporary Patient unavailability;
- Patient departure before consultation.

Already confirmed for Phase 3:

```text
PLANNED → ARRIVED
```

Waiting order is based on actual check-in order, not scheduled appointment time.

After each approved phase:

1. run backend and frontend validation;
2. update the browser demo;
3. update documentation and phase status;
4. commit directly on `main`;
5. report exact changes and stop.
