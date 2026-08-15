# Phase 0 — Foundation

## Status

**Implemented through Phase 7, with the base authentication boundary reopened for a small corrective pass before Phase 8.**

Phase 0 originally established the application foundation. Its shared clinic-password layer is no longer the intended authentication boundary, so the project is returning to Phase 0 only to correct that foundation before adding the more complicated recovery and account-administration work planned for Phase 8.

This is not a rollback of Phases 1–7. Patient, Appointment, queue, consultation, task, and private-sticky behavior remain implemented and out of scope for the Phase 0 correction.

## Existing foundation

The repository currently has:

- React/Vite frontend;
- Django REST Framework backend;
- PostgreSQL primary database;
- clinic-scoped operational and Patient data;
- Doctor and Assistant workspaces;
- Doctor administrator access to Assistant workspace;
- individual staff accounts and staff sessions;
- browser-only public demo adapter;
- the completed Phase 1–7 workflows.

## Current authentication implementation

The current code still uses two authentication layers:

1. clinic email + shared clinic password, which establishes clinic access;
2. individual staff username + staff password, which establishes a Doctor or Assistant session and workspace.

The backend therefore still contains `Clinic.password_hash`, clinic-password entry, clinic-access tokens, and individual `StaffSession` records. A `StaffUser` is currently linked to one clinic.

## Problem with the current base authentication

The shared clinic password is both inconvenient and the wrong privacy boundary:

- Doctor and Assistant must share and coordinate one credential;
- resetting that credential affects both people;
- knowing the shared clinic password does not meaningfully represent being physically or operationally inside the clinic;
- individual staff recovery should never require distributing a clinic-wide password.

## Approved target direction

The following architectural direction is already approved:

- the clinic remains the tenant/container for clinic data;
- the shared clinic password is removed from normal daily authentication;
- clinic access is gated by a trusted clinic device/browser;
- trusted-device authorization is separate from an individual staff session;
- signing a staff member out does not automatically untrust the clinic device;
- an untrusted device must not gain clinic or Patient-data access merely because somebody knows a staff credential;
- remote access from an untrusted device is blocked;
- the Doctor/Assistant role-selection step remains;
- Doctor and Assistant remain individually authenticated people rather than sharing a clinic credential.

## Phase 0 corrective scope

The Phase 0 corrective pass is deliberately limited to the minimum base-authentication architecture needed to remove the shared clinic-password boundary safely.

It must determine and then implement only:

- how the first clinic device becomes trusted;
- the minimum mechanism needed for another legitimate clinic device to become trusted;
- how trusted-device state is represented and checked by the backend/frontend;
- how normal Doctor/Assistant sign-in sits behind that trusted-device boundary;
- how existing clinic data and existing staff accounts migrate without loss;
- the minimum browser-demo behavior needed to keep the same frontend/codebase while real device trust is unavailable there.

Do **not** pull the rest of Phase 8 into this correction merely because it touches authentication.

## Explicitly deferred to Phase 8

The following approved ideas and unanswered questions are preserved in [`PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](PHASE_8_AUTHENTICATION_ADMINISTRATION.md) and are not part of the initial Phase 0 corrective implementation unless the product owner explicitly moves one of them forward:

- forgotten-password recovery;
- email/SMS recovery protocols and throttling;
- offline Doctor recovery codes;
- contact verification and contact editing;
- passkeys/device-biometric account management;
- detailed session-management policy;
- Doctor administration/reset of the Assistant account;
- replacement-Assistant onboarding and historical-account treatment;
- multi-clinic Doctor identity and membership;
- clinic/Doctor ownership changes;
- broader account/security settings;
- security event history;
- other production-hardening rules.

## Current clarification boundary

Before changing Phase 0 code, ask only questions required to implement the small base-authentication correction. Do not require the product owner to finish every Phase 8 account-management/recovery decision first.

Once the Phase 0 correction is implemented and validated, stop. Phase 8 remains a later separate phase with its existing decisions and unanswered questions preserved.