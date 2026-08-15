# Phase 0 — Foundation

## Status

**Implemented, with one authentication-architecture correction approved for Phase 8.**

Phase 0 established the application foundation, but its original shared clinic-password layer is no longer the intended final authentication model. The current repository still contains that implementation. Phase 8 will correct it; this document must not be read as claiming the correction is already implemented.

## Implemented foundation

Phase 0 established:

- React/Vite frontend;
- Django REST Framework backend;
- PostgreSQL primary database;
- clinic-scoped data;
- one Doctor account and one Assistant account per clinic;
- Doctor as clinic administrator;
- separate Doctor and Assistant workspaces;
- Doctor credentials may open Doctor workspace or Assistant workspace;
- Assistant credentials may open Assistant workspace only;
- individual staff usernames, emails, and passwords;
- persistent staff sessions;
- browser-only public demo adapter;
- repository verification and deployment workflows.

## Current authentication implementation

The repository currently has two authentication layers:

1. clinic email + shared clinic password, which establishes clinic access;
2. individual staff username + staff password, which establishes a Doctor or Assistant session and active workspace.

The current backend therefore has a clinic password hash and a clinic-access token in addition to individual staff credentials and staff sessions.

This remains the actual behavior until Phase 8 changes the implementation.

## Approved authentication correction

The product owner approved the following direction for the Phase 0 authentication correction:

- the clinic remains the tenant/container for clinic data and staff membership;
- the shared clinic password is removed from normal daily authentication;
- clinic access is instead gated by authorization of a trusted clinic device/browser;
- trusted-device authorization and an individual staff login are separate security layers;
- a trusted clinic device is not itself a logged-in Doctor or Assistant session;
- signing out a staff account ends that staff session without automatically removing the clinic device authorization;
- Doctor and Assistant continue to authenticate as separate individual accounts;
- Doctor and Assistant credentials and password recovery are independent, so changing or recovering one staff password does not force the other staff member to change or learn a shared clinic password;
- an unauthorized outside device must not gain patient-data access merely because somebody knows a staff password;
- email and SMS are both approved recovery channels in principle;
- recovery must not distribute an actual newly generated password to the other staff member; recovery is for the affected individual account.

## Not yet decided

Phase 0 does **not** predetermine the remaining Phase 8 behavior. In particular, the following remain unresolved until the product owner answers the Phase 8 clarification questions:

- first-device/bootstrap authorization;
- authorization of additional clinic devices;
- exact email/SMS verification flow for device authorization;
- device authorization lifetime, renewal, and revocation behavior;
- whether remote access is allowed for Doctor, Assistant, both, or neither;
- staff login identifiers and password/passkey behavior;
- staff recovery token/code details and session-revocation behavior;
- inaccessible-Doctor emergency recovery;
- Doctor administration of the Assistant account;
- account replacement/archive behavior;
- editable staff and clinic profile fields;
- browser-demo behavior for recovery and trusted devices;
- any other Phase 8 UI, permission, dependency, or security rule not explicitly approved.

## Phase relationship

Phase 0 remains the implemented foundation. Phase 8 is responsible for correcting the authentication boundary without changing unrelated Patient, Appointment, queue, consultation, task, or private-sticky behavior.

See [`PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](PHASE_8_AUTHENTICATION_ADMINISTRATION.md) for the Phase 8 decision record.