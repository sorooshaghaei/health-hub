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

The following architectural direction is approved:

- the clinic remains the tenant/container for clinic data;
- the shared clinic password is removed from normal daily authentication;
- clinic access is gated by a trusted clinic device/browser;
- trusted-device authorization is separate from an individual staff session;
- signing a staff member out does not automatically untrust the clinic device;
- an untrusted device must not gain clinic or Patient-data access merely because somebody knows a staff credential;
- remote access from an untrusted device is blocked;
- the Doctor/Assistant role-selection step remains;
- Doctor and Assistant remain individually authenticated people rather than sharing a clinic credential.

## Approved Phase 0 corrective behavior

### First clinic device

For a brand-new clinic:

1. create the clinic;
2. create the Doctor account using the existing Phase 0 account mechanism;
3. automatically register the current computer/browser as the clinic's first trusted device.

The first device is auto-trusted deliberately so the Doctor cannot accidentally create a clinic and immediately lose access to it. Do not ask an ambiguous **Trust and remember this computer?** question during first-clinic setup.

The UI should instead explain clearly that Health Hub only allows clinic access from trusted devices and that this first device has been registered as trusted.

Email/SMS verification is not added to this first-device flow in the Phase 0 corrective pass. Contact verification belongs to Phase 8.

### Normal daily staff sign-in

For this corrective pass, keep the existing individual staff authentication deliberately simple:

- the Doctor/Assistant role-selection step remains;
- after the device is trusted, Doctor or Assistant signs in using the existing username + password credentials;
- passkeys, email/phone sign-in, verified contact activation, and account recovery remain deferred to Phase 8.

### Additional clinic devices

Phase 0 does **not** introduce email/SMS infrastructure merely to authorize additional devices.

For this corrective pass:

- a new/untrusted browser displays a short one-time pairing code;
- on an already trusted clinic device, a signed-in Doctor or Assistant opens trusted-device management and enters that pairing code;
- successful approval registers the requesting browser as trusted for that clinic;
- the pairing code is single-use and short-lived;
- no clinic or Patient data is exposed on the requesting browser before approval;
- email/SMS authorization of new devices remains a Phase 8 enhancement, preserving the product owner's earlier decision that Doctor or Assistant should eventually be able to choose either verified email or SMS.

### Trusted-device lifetime and management

- A trusted browser remains trusted indefinitely until explicitly revoked.
- Both Doctor and Assistant may view a simple trusted-device list.
- Each device row shows only the minimum recognition information: browser + operating system, added date, and a **Current device** marker when applicable; example: `Chrome on macOS · Added 16 Aug 2026 · Current device`.
- Each device row has a **Remove** action.
- Both Doctor and Assistant may revoke a trusted browser/computer from that list.
- Signing out a staff account does not remove the device's trusted status.
- Clearing browser storage, changing browser, reinstalling the browser, or using another computer requires authorization again.
- Device removal and other security actions do not use the five-second Undo workflow.

### Existing development data

There is no requirement to preserve existing clinics/accounts created under the old shared-clinic-password architecture.

This is still pre-release development data, so the corrective implementation may discard/reset incompatible existing clinic/account data rather than carrying a legacy clinic-password migration path forward. Do not add one-time legacy clinic-password login or compatibility code solely to preserve current development clinics.

This permission is limited to the current pre-release Phase 0 correction; it is not a general permission to discard future production data.

### Browser demo

The GitHub Pages demo remains the same frontend/codebase through the browser adapter.

Because the static browser demo has no real backend trusted-device authority, it will bypass real trusted-device authorization and continue into the existing demo Doctor/Assistant role/sign-in flow. Do not create fake email/SMS delivery or a second separately maintained authentication application for the demo.

This is a demo adapter exception only. Production/backend behavior must enforce the trusted-device boundary.

## Phase 0 corrective scope

The Phase 0 corrective pass is deliberately limited to the minimum base-authentication architecture needed to remove the shared clinic-password boundary safely.

It must implement only:

- the trusted-device representation and backend authorization boundary;
- automatic first-device trust for a new clinic with clear explanatory UI;
- the approved one-time-code pairing flow for authorizing another clinic device from an already trusted device;
- the simple device list and revocation available to both Doctor and Assistant;
- existing role selection + username/password staff authentication behind the trusted-device boundary;
- removal of the shared clinic password from normal daily authentication;
- removal/reset of incompatible pre-release clinic/account data rather than a legacy migration flow;
- the minimal browser-demo bypass described above;
- tests and documentation proving Phases 1–7 still work behind the corrected boundary.

Do **not** pull the rest of Phase 8 into this correction merely because it touches authentication.

## Explicitly deferred to Phase 8

The following approved ideas and unanswered questions are preserved in [`PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](PHASE_8_AUTHENTICATION_ADMINISTRATION.md) and are not part of the Phase 0 corrective implementation unless the product owner explicitly moves one of them forward:

- forgotten-password recovery;
- email/SMS recovery protocols and throttling;
- email/SMS authorization of new devices;
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

## Clarification status

**Phase 0 base-authentication clarification is complete.**

Do not ask the Phase 8 recovery/account-management questions again until this Phase 0 corrective pass is complete.

The next step is implementation of only this approved Phase 0 correction. After implementation, validate it, update documentation, commit on `main`, and stop before Phase 8.