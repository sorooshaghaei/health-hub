# Health Hub project continuation context

This file is the handoff entry point for a new chat or a new development session.

## Repository and workflow

- Repository: `sorooshaghaei/health-hub`
- Working branch: `main`
- Work directly on `main`; do not create branches or pull requests unless the product owner explicitly changes this instruction.
- Implement one approved phase at a time.
- Before choosing an unapproved field, screen, action, state, permission, algorithm, library, or workflow behavior, ask the product owner.
- After implementing a phase, validate it, report the exact changes, and stop.
- Continue only after the product owner explicitly says **continue**.

## Product baseline

Health Hub is a deliberately simple clinic workflow application for one clinic with one Doctor and one Assistant, a React/Vite frontend, a Django REST Framework backend, PostgreSQL as the primary database, English-first left-to-right UI, Doctor administration, and separate role workspaces.

The public GitHub Pages demo uses the actual React frontend with a browser-only adapter. It is a demonstration environment and must not be treated as medical-data storage.

## Current implementation

Phase 0 foundation is complete:

- clinic creation and clinic-level sign-in;
- Doctor and Assistant individual account creation and sign-in;
- Doctor administrator enforcement and one account per role per clinic;
- separate role workspaces;
- PostgreSQL configuration and initial migrations;
- authentication and authorization tests;
- frontend browser-demo tests and normal/demo builds;
- GitHub Actions quality and Pages deployment workflows;
- visual identity assets and design tokens.

Phase 1 patient records are implemented:

- reusable clinic-scoped Patient model and migration;
- full name, `Man`/`Woman`, country calling code, normalized phone, optional date of birth, and shared Patient note;
- Iran `+98` default and country-code-aware phone validation;
- Doctor and Assistant patient create, view, search, edit, and soft-delete APIs;
- combined name, phone, and date-of-birth search;
- one **Possible duplicate patient** warning with matching-profile preference and explicit separate creation;
- patient list, search, create, detail, edit, note, duplicate, and deletion UI in both role workspaces;
- equivalent browser-demo behavior and tests.

Current external Actions and live Pages results may need to be checked separately because they are deployment outcomes rather than repository code.

## Current phase

**Phase 1 — Patient records: repository implementation complete. Stop until the product owner explicitly says continue.**

The complete implemented specification is in [`PHASE_1_PATIENT_RECORDS.md`](PHASE_1_PATIENT_RECORDS.md). The full roadmap is in [`DEVELOPMENT_PLAN.md`](DEVELOPMENT_PLAN.md).

## Phase 1 technical contract

A Patient is the permanent reusable profile. A Visit is a separate clinic attendance and is not implemented yet.

Patient fields:

- full name — required;
- gender — required, `Man` or `Woman`;
- country calling code — required, Iran `+98` default;
- phone number — required, stored as normalized national and E.164 values;
- date of birth — optional;
- Patient note — optional, shared by Doctor and Assistant.

All patient access is authenticated and clinic-scoped. Deleted profiles use an internal deletion timestamp and are excluded from active APIs. No user-visible archive state exists.

Duplicate handling uses one `409` API warning payload with code `possible_duplicate`, message **Possible duplicate patient**, matching profiles, and an explicit `confirm_duplicate` override. Stored names are never altered.

## Next action

Do not begin Phase 2 automatically.

When the product owner says **continue**, first resolve and approve the Phase 2 decisions recorded in `docs/DEVELOPMENT_PLAN.md`, including appointment fields, Visit cancellation/removal rules, past visibility, repeated same-day Visits, walk-in data, visit reason, and exact existing-patient suggestion-row context.

After each approved phase:

1. run backend and frontend validation;
2. update the browser demo;
3. update relevant documentation and phase status;
4. commit directly on `main`;
5. report exact changes and stop until the next **continue**.
