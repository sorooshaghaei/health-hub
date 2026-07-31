# Phase 2 — Planned appointments and walk-ins

Status: **Repository implementation complete, with the corrected workspace permission boundary.**

This document records the approved Phase 2 behavior. Phase 3 arrival and live-queue behavior is not included.

## 1. Patient and Visit relationship

A Patient is the permanent reusable profile. A Visit is one separate clinic attendance. Every Visit belongs to one Patient and one clinic. Multiple Visits for the same Patient on the same date are allowed.

## 2. Visit types

### Scheduled appointment

Required:

- Patient;
- date;
- scheduled time.

Optional:

- visit reason.

Scheduled time is informational and will not determine live waiting order.

### Walk-in

Required:

- Patient.

The date is assigned automatically as the clinic's current local date. Walk-ins have no scheduled time or reason in Phase 2.

## 3. Workspace permissions

### Doctor workspace

The Doctor can:

- view appointment and walk-in lists by date;
- view Visit details;
- view Patient Visit history.

The Doctor workspace cannot:

- create appointments or walk-ins;
- edit past or future Visits;
- remove future Visits;
- create or modify Patients.

### Assistant workspace

The Assistant workspace can:

- create appointments and walk-ins;
- edit past and future Visits;
- remove future Visits;
- create a new Patient inside the Visit form;
- manage Patient records.

The Doctor administrator can select the Assistant workspace and sign in with the Doctor username and password. This grants the same management capabilities as an Assistant-workspace session without placing management controls on the Doctor page.

The backend session stores `workspace_role`, so the permission boundary is enforced at API level.

## 4. Existing-Patient suggestions

Suggestions show:

- full name;
- phone;
- date of birth;
- gender.

Selecting a suggestion attaches the Visit to the existing Patient.

## 5. Inline Patient creation

A new Patient and Visit may be created in one uninterrupted form and one database transaction. The appointment date, time, and optional reason remain attached while Patient information is entered.

The Phase 1 duplicate warning remains active. The user may choose an existing match or explicitly create a separate Patient.

## 6. Editing and removal

The Assistant workspace may edit past and future Visits.

Only future Visits may be removed. Removal is permanent; there is no Cancelled state.

- Later-date Visits are future.
- Appointments later on the current date are future.
- Past appointments cannot be removed.
- Walk-ins cannot be removed through this Phase 2 action.

## 7. Patient history and deletion

Past and future Visits appear inside the Patient profile for both workspaces.

Patient deletion is an Assistant-workspace action and follows these rules:

1. future Visits block deletion;
2. future Visits must be removed first;
3. past Visits remain historical;
4. Patient identity snapshots remain on historical Visits;
5. deleted Patients disappear from active search and cannot receive new Visits.

## 8. Authentication and API contract

The authenticated account and active workspace are separate session properties.

- Doctor account + Doctor workspace: read-only Patient and Visit access.
- Assistant account + Assistant workspace: management access.
- Doctor account + Assistant workspace: administrator management access.
- Assistant account + Doctor workspace: rejected.

Read endpoints are available in both workspaces:

```text
GET /api/patients/
GET /api/patients/<patient-id>/
GET /api/visits/?date=YYYY-MM-DD
GET /api/visits/?patient=<patient-id>
GET /api/visits/<visit-id>/
```

Mutation endpoints require an Assistant-workspace session:

```text
POST   /api/patients/
PATCH  /api/patients/<patient-id>/
DELETE /api/patients/<patient-id>/
POST   /api/visits/
PATCH  /api/visits/<visit-id>/
DELETE /api/visits/<visit-id>/
```

Doctor-workspace mutations return HTTP `403`.

## 9. Implementation record

Implemented:

- Visit model, migration, indexes, and Patient identity snapshots;
- appointment and walk-in validation;
- clinic-scoped read APIs for both workspaces;
- Assistant-workspace mutation authorization;
- Doctor administrator access to the Assistant workspace;
- atomic inline Patient plus Visit creation;
- Patient deletion blocking against future Visits;
- Patient profile Visit history;
- view-only Doctor appointment list;
- Assistant schedule-management UI;
- equivalent browser-demo authorization and tests.

Not implemented: arrival, check-in, live waiting order, consultation flow, checkout, notifications, or queue states.
