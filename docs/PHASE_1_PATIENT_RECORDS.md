# Phase 1 — Patient records specification

Status: **Implemented in the repository, with the corrected workspace permission boundary.**

## 1. Patient and Visit separation

A **Patient** is the permanent reusable person profile. A **Visit** is one clinic attendance. Returning Patients reuse the existing profile and receive a new Visit.

## 2. Approved Patient fields

| Field | Required | Behavior |
| --- | --- | --- |
| Full name | Yes | Real Patient name; no generated suffixes. |
| Gender | Yes | `Man` or `Woman`. |
| Country calling code | Yes | Separate from national number; Iran `+98` default. |
| Phone number | Yes | Country-aware validation; normalized national and E.164 storage. |
| Date of birth | No | May be empty. |
| Patient note | No | Shared plain text attached to the Patient. |

No address, email, reminder, or additional Patient field belongs to this phase.

## 3. Workspace permissions

### Doctor workspace

The Doctor can:

- list and search active Patients;
- open Patient profiles;
- view Patient fields and the shared Patient note;
- view past and future Visit history.

The Doctor workspace cannot:

- create Patients;
- edit Patient fields or notes;
- delete Patients;
- edit or remove Visits.

### Assistant workspace

The Assistant workspace can:

- create, view, search, edit, and soft-delete Patients;
- edit the shared Patient note;
- perform duplicate confirmation;
- manage linked Visits according to Phase 2.

The Doctor administrator may open the Assistant workspace using the Doctor username and password. In that session the authenticated account remains Doctor, while the active workspace is Assistant and management permission is available.

Assistant credentials cannot open the Doctor workspace.

All authorization is enforced by the backend using the session's active workspace, not only by hiding frontend controls.

## 4. Search, duplicate handling, and reuse

Search combines normalized name, phone digits, and date of birth.

The single warning is **Possible duplicate patient**. Matching profiles are offered first. An explicit **Create separate patient** action remains available, and stored names are never modified with generated suffixes.

## 5. Editing and deletion

Patient profiles use internal soft deletion. Deleted profiles disappear from active APIs, search, and Visit selection.

After Phase 2:

- future Visits block Patient deletion;
- future Visits must be removed first;
- past Visits remain historical;
- Visit snapshots preserve Patient identity after active-profile deletion.

## 6. Implementation record

Implemented:

- clinic-scoped Patient model and migration;
- approved validation and phone normalization;
- search, duplicate matching, and soft deletion;
- Doctor-workspace read APIs;
- Assistant-workspace mutation APIs;
- Doctor administrator entry into Assistant workspace;
- Patient list/detail/history UI for Doctor;
- full Patient-management UI for Assistant;
- equivalent browser-demo behavior and tests.

Phase 3 queue behavior is not part of this specification.
