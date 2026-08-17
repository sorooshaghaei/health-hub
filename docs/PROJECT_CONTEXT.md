# Health Hub project continuation context

This is the handoff entry point for a new chat or development session.

## Repository and workflow

- Repository: `sorooshaghaei/health-hub`
- Working branch: `main`
- Work directly on `main`; do not create branches or pull requests unless explicitly instructed.
- Implement one approved phase or corrective pass at a time.
- Ask before choosing an unapproved field, state, screen, action, permission, algorithm, dependency, or workflow.
- Update documentation, validate, commit, report, and stop after each approved unit.
- Continue only after the product owner explicitly says **continue**.

## Current phase status

- Phase 0 — Foundation/trusted-device authentication: complete.
- Phase 1 — Patient records: complete.
- Phase 2 — Appointments: complete.
- Phase 3 — Check-in/live queue: complete.
- Phase 4 — Room ready/consultation handoff: complete.
- Phase 5 — Completed consultation behavior: complete.
- Phase 6 — Shared tasks: complete.
- Phase 7 — Private sticky: complete.
- Phase 8 — Account recovery, administration, multi-clinic identity, and security: **complete, including the GitHub Pages demo-parity corrective pass**.
- Phase 9 — Sensitive attachment architecture: not started.
- Phase 10 — Production hardening: not started.
- Phase 11 — First stable release: not started.

The initial Phase 8 implementation validation passed on code commit `78bd2753c7b8b2c049576be8454ae512e311e6a0`. A later corrective pass fixed the Pages build so it no longer opens the legacy separate `DemoApp` authentication flow. The Pages build now renders the same production Phase 8 React UI and uses only a browser-local API adapter underneath it. A regression test explicitly requires **Email or phone** login and rejects the old username contract.

## Product baseline

Health Hub is a deliberately simple clinic workflow application for Doctor and Assistant roles using React/Vite, Django REST Framework, and PostgreSQL. The GitHub Pages build uses the same production frontend through a browser-only API adapter and is not a medical-data backend.

Clinic operational data is tenant-scoped. Personal staff identity is global.

## Final account/security architecture after Phase 8

### Global personal accounts

`StaffUser` is the person's global account. The following follow the person across clinics:

- first/last name;
- unique email;
- unique phone;
- password;
- verified-contact state;
- passkeys;
- Doctor offline recovery codes;
- private sticky.

There is no production or active-demo username login. Staff sign in with email or phone + password, or a registered passkey in production.

### Clinic memberships

`StaffMembership` contains clinic-specific identity:

- clinic;
- Doctor or Assistant role;
- active/inactive membership state;
- task-attention seen state.

Each clinic has at most one active Doctor and one active Assistant. Both Doctors and Assistants may belong to multiple clinics. A Doctor can be Doctor in multiple clinics simultaneously.

Clinic Patient/Appointment/queue/room-call/task/trusted-device data never becomes global.

### Workspace rule

Account identity, clinic membership, and active workspace are separate:

- Doctor membership → Doctor workspace;
- Doctor membership → Assistant workspace for administrator intervention;
- Assistant membership → Assistant workspace;
- Assistant membership cannot open Doctor workspace.

Doctor workspace remains clinically focused. Doctor may edit approved Patient information but does not create/delete Patients or administer Appointments there. Assistant workspace owns Patient/Appointment administration, check-in, queue, and handoff operations. Doctor inside Assistant workspace receives those administrative controls.

Task authoring is based on the active clinic membership's Doctor role, not on workspace. Private sticky is stricter: it appears only when the active workspace equals that membership's own role. Doctor administrator access to Assistant workspace shows no private sticky.

### Verified contacts

Phone is required for new accounts. Both personal email and phone must be verified before clinic operational data opens. This is enforced server-side at the active-membership permission boundary.

Default verification rules:

- six-digit codes;
- 10-minute expiry;
- 60-second resend minimum;
- five failed attempts maximum.

Clinic-level email and phone were removed. Individual contacts own authentication/recovery.

### Trusted devices

Device trust is per clinic.

A browser becomes trusted for a clinic through either:

- the signed-in person's verified email/SMS; or
- the existing six-digit pairing code approved from a trusted clinic device.

Trusted devices stay trusted until removed. Both roles can review/remove them. Phase 8 permits deleting the last trusted device because verified-contact authorization can create a new one later.

A clinic-bound API session requires bearer token + proof of the matching trusted device. A copied bearer alone cannot open clinic data.

A global personal session before clinic selection has no clinic/device binding and cannot open clinic operational APIs.

### Session policy

- 12-hour absolute lifetime;
- 2-hour inactivity timeout;
- no Remember Me;
- sign-out deletes session only, not device trust.

Selecting a clinic binds the session to membership + device + workspace. Switching clinic first clears the active clinic binding.

### Recovery and security changes

Forgot-password recovery uses verified email or SMS. A successful recovery grant lasts up to 30 minutes; a newer grant supersedes older outstanding grants. Successful reset revokes all sessions for that person only and leaves trusted devices intact.

Normal password change uses a verified email/SMS code, preserves the current session, revokes the person's other sessions, and keeps device trust.

Email/phone changes require recent password or passkey reauthentication, verify the new contact, and send a best-effort notice to the old contact.

Security/account actions do not use the five-second Undo rule.

### Passkeys

Passkeys are optional; password login remains available. Up to five passkeys may be registered. Server-side WebAuthn challenge/credential verification is implemented using the Python `webauthn` dependency. Passkeys may sign in or reauthenticate sensitive operations.

### Doctor offline recovery codes

Doctors can generate 10 one-time offline recovery codes. Generating a new set invalidates all unused old codes. Codes recover only that Doctor's global account; they are not Assistant credentials.

### Assistant replacement

Doctor manages the Assistant slot for the active clinic.

Replacement deactivates only the old Assistant's membership for that clinic and ends sessions tied to it. It does not erase the person's global account, sticky, contacts, passkeys, or other clinic memberships, and it does not change Patient/Appointment/queue/task data.

Historical task/comment authorship stays attached to the original person. The Doctor receives a one-time setup code for the replacement. The replacement may create or attach a personal account, then must verify both contacts and authorize a trusted browser before clinic data opens.

There is no Doctor replacement/ownership transfer in Phase 8.

### Browser demo

The GitHub Pages demo must use the same production React product UI; it must not expose a separate demo sign-in/application flow.

The Pages environment sets production UI mode and routes only the API layer to the browser adapter. Therefore the visible account flow, clinic picker, workspace selection, account settings, device/team controls, and login form are the same components used by the real web app. Login is **Email or phone**; username is not an active demo credential.

The browser adapter locally simulates account/membership/device state and reuses the existing Patient/Appointment/queue/task demo engine. It does not fake production security infrastructure: no real email/SMS delivery, no real trusted-device authority, and no fake WebAuthn/passkey security. Browser storage is demonstration state only and must never contain real Patient information.

See [`PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](PHASE_8_AUTHENTICATION_ADMINISTRATION.md) for the detailed implemented contract and demo-parity invariant.

## Implemented clinic workflow

### Patients

- reusable clinic-scoped Patient profile;
- full name, `Man`/`Woman`, country/calling code, phone, optional date of birth, optional shared Patient note;
- Iran `+98` default;
- automatic search by name, phone, or DOB;
- one duplicate warning;
- Doctor may edit; Assistant workspace creates/deletes;
- current/future Appointments block Patient deletion;
- Patient deletion has five-second Undo.

### Appointments

- Patient, date, scheduled time, optional reason;
- one active Appointment maximum per Patient per clinic date;
- same-day unplanned arrival is a normal same-day Appointment with frontend time defaulting to current time, then check-in;
- Assistant workspace creates/edits/deletes; Doctor workspace is read-only for Appointment administration;
- deletion has five-second Undo.

### Queue and consultation

```text
PLANNED → CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

- only today's Appointments check in;
- queue order is original persisted check-in sequence;
- Doctor **Room ready** is a one-time call with five-second Undo before Assistant notification;
- Assistant sends any checked-in Patient **With doctor**, also with five-second Undo;
- `DOCTOR_FINISHED` is final and displayed as **Completed**;
- no Checkout state/action exists.

### Shared tasks

```text
OPEN → DONE
```

- Doctor membership creates tasks for Assistant;
- optional due date and Patient link;
- both staff may comment on their own comments;
- Done/delete/comment-delete actions have five-second Undo;
- task attention dots are clinic-membership scoped after Phase 8.

### Private sticky

- one global plain-text scratchpad per personal account;
- autosaves and persists;
- minimized strip / draggable-resizable desktop / full-screen mobile editor;
- shown only when active workspace equals the person's own active membership role.

## Important implementation notes

- `accounts.0005_trusted_device_auth` is the earlier Phase 0 trusted-device migration and deliberately reset incompatible pre-release auth data under explicit pre-release approval.
- `accounts.0006_phase8_global_accounts` migrates old per-clinic staff identity to global account + membership architecture and adds verification/passkey/recovery/setup models.
- `accounts.0007_alter_staffuser_options` aligns final Django user-model migration state.
- `backend/health_hub/test_runner.py` adapts only historical Phase 1–7 test-fixture syntax during `manage.py test`; it does not alter production API semantics.
- `frontend/src/demoPhase8Api.js` is the browser-only Phase 8 API adapter used by GitHub Pages while the Pages UI remains the production React application.
- Production account APIs require the new Phase 8 fields and flows.

## Phase specifications

- [`PHASE_0_FOUNDATION.md`](PHASE_0_FOUNDATION.md)
- [`PHASE_1_PATIENT_RECORDS.md`](PHASE_1_PATIENT_RECORDS.md)
- [`PHASE_2_VISITS.md`](PHASE_2_VISITS.md)
- [`PHASE_3_QUEUE.md`](PHASE_3_QUEUE.md)
- [`PHASE_4_CONSULTATION.md`](PHASE_4_CONSULTATION.md)
- [`PHASE_5_COMPLETION.md`](PHASE_5_COMPLETION.md)
- [`PHASE_6_SHARED_TASKS.md`](PHASE_6_SHARED_TASKS.md)
- [`PHASE_7_PRIVATE_NOTES.md`](PHASE_7_PRIVATE_NOTES.md)
- [`PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](PHASE_8_AUTHENTICATION_ADMINISTRATION.md)

## Current work

**Phases 0–8 are complete, including the Phase 8 browser-demo parity correction. Phase 9 has not started.**

## Next action

Stop before Phase 9. Wait for the product owner to explicitly say **continue**.

When Phase 9 starts, clarify the sensitive-attachment architecture before implementation, including storage, access controls, encryption, limits, file types, malware scanning, retention/deletion, backups, audit requirements, Patient-information boundaries, and deployment/privacy implications.
