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

Health Hub is a deliberately simple clinic workflow application for one clinic with:

- one Doctor;
- one Assistant;
- React and Vite frontend;
- Django REST Framework backend;
- PostgreSQL primary database;
- English-first, left-to-right interface;
- Doctor as clinic administrator;
- separate Doctor and Assistant accounts and workspaces.

The public GitHub Pages demo uses the actual React frontend with a browser-only adapter. It is a demonstration environment and must not be treated as medical-data storage.

## Current implementation

Phase 0 repository implementation is complete:

- clinic creation and clinic-level sign-in;
- Doctor and Assistant individual account creation and sign-in;
- Doctor administrator enforcement;
- one account per role per clinic;
- separate role workspaces;
- PostgreSQL configuration and initial migrations;
- authentication and authorization tests;
- frontend browser-demo tests;
- normal and demo frontend builds;
- GitHub Actions quality and Pages deployment workflows;
- visual identity assets and design tokens.

Current external Actions and live Pages results may need to be checked separately because they are deployment outcomes rather than repository code.

## Current phase

**Phase 1 — Patient specification and records**

Status: **Product specification approved; implementation not started.**

The complete approved specification is in:

- [`PHASE_1_PATIENT_RECORDS.md`](PHASE_1_PATIENT_RECORDS.md)

The full phased roadmap is in:

- [`DEVELOPMENT_PLAN.md`](DEVELOPMENT_PLAN.md)

Do not begin Phase 2 while Phase 1 is being implemented.

## Approved Phase 1 summary

A Patient is a permanent reusable person profile. A Visit is a separate attendance on a working day. Returning patients reuse the Patient profile and receive another Visit later.

Approved Patient fields:

- full name — required;
- gender — required, `Man` or `Woman`;
- country calling code — required, Iran `+98` default;
- phone number — required and validated using the selected country code;
- date of birth — optional;
- Patient note — optional, visible and editable by both Doctor and Assistant.

Both roles can create, view, search, edit, and delete patients subject to deletion rules.

Search combines name, phone, and date of birth. When a patient is later added to a working day, existing matching profiles must be suggested so the user can create a new Visit instead of a duplicate Patient.

Duplicate handling uses one non-blocking warning: **Possible duplicate patient**. It covers exact normalized identity matches and similar names with the same phone. The stored patient name must never receive generated suffixes.

Deletion is blocked while future Visits exist. Future Visits must be removed first. Past Visits remain as historical records after the active Patient profile is deleted, and the deleted profile cannot receive new Visits.

## Next action

When the product owner says **continue**, implement Phase 1 only according to `docs/PHASE_1_PATIENT_RECORDS.md`.

Do not ask again about decisions already recorded there. Ask only if implementation uncovers a genuinely unresolved product decision that materially affects Phase 1.

After implementation:

1. run backend and frontend validation;
2. update the browser demo;
3. update the relevant documentation and phase status;
4. commit directly on `main`;
5. report the exact changes and stop until the next **continue**.