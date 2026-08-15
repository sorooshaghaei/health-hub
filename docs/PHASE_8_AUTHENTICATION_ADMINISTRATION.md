# Phase 8 — Authentication recovery and clinic administration

## Status

**Not started. Clarification in progress.**

Phase 8 includes the approved correction to the Phase 0 authentication boundary plus password recovery and clinic/staff administration. No Phase 8 application code has been implemented yet.

## Problem being corrected

The current application requires a shared clinic email/password before individual Doctor or Assistant authentication. That shared secret creates two product problems:

- changing or forgetting the clinic password affects both staff members and requires coordination;
- a shared clinic password is not the desired final privacy boundary for preventing arbitrary outside devices from accessing clinic data.

The final design therefore must separate **clinic/device authorization** from **individual staff authentication**.

## Approved direction

The following decisions are approved and may be treated as fixed unless the product owner explicitly revises them.

### Clinic boundary

- The clinic remains the tenant/container that owns clinic data and staff membership.
- The shared clinic password is removed from normal daily authentication.
- A clinic device/browser must be authorized as a trusted clinic device before it can be used as a normal clinic access point.
- Knowledge of an individual staff password alone must not make an arbitrary outside device a trusted clinic device.
- Device authorization is distinct from an individual staff session.
- Signing out Doctor or Assistant does not automatically remove the device's clinic authorization.

### Individual staff authentication

- Doctor and Assistant remain separate individual accounts.
- Their credentials and recovery are independent.
- Forgetting or changing the Doctor password must not force an Assistant credential change.
- Forgetting or changing the Assistant password must not force a Doctor credential change.
- No new password is distributed to the other staff member as part of recovery.

### Recovery channels

- Both email and SMS are approved recovery channels in principle.
- Recovery is performed for the affected individual account rather than by resetting a shared clinic password.
- The actual recovery protocol, expiry, code/link format, verification choice, throttling, and session effects remain to be confirmed before implementation.

## Existing implementation that Phase 8 must replace or migrate

The current repository still contains:

- `Clinic.password_hash`;
- clinic entry using clinic email + clinic password;
- a signed clinic-access token issued after clinic-password validation;
- staff login performed after clinic access;
- separate `StaffSession` records for individual staff sessions.

Phase 8 must migrate this architecture deliberately. Documentation must not describe trusted-device authorization as already implemented until the code, tests, browser demo, and migrations actually match it.

## Scope to clarify before implementation

The following decisions are intentionally **not predetermined**.

### Trusted-device lifecycle

- how the first clinic device becomes trusted;
- how a second/new device is authorized;
- who is allowed to authorize a device;
- whether authorization uses email, SMS, an existing trusted device, or another approved mechanism;
- whether a trusted device expires automatically or remains trusted until revoked;
- what device information is shown to the Doctor;
- how a lost/stolen/replaced device is revoked;
- whether clearing browser storage requires reauthorization;
- whether Doctor and Assistant use the same trusted-device set.

### Remote access

- whether Doctor may access Health Hub from an untrusted/remote device;
- whether Assistant may access Health Hub remotely;
- whether remote access, if allowed, has a different authentication requirement;
- whether remote access can be enabled/disabled by the Doctor.

### Daily staff sign-in

- exact login identifier(s): username, email, phone, or another approved choice;
- whether passwords remain the only sign-in method in this phase;
- whether passkeys or another authenticator are in Phase 8 or deferred;
- whether a role chooser appears before or after identity is known;
- remember-session behavior and session lifetime.

### Password recovery

- whether users choose email or SMS, receive both, or follow another flow;
- recovery link/code format;
- recovery validity period;
- whether a recovery request invalidates earlier requests;
- session revocation after successful reset;
- rate limits/throttling and generic responses;
- behavior when email or phone is no longer accessible;
- emergency Doctor recovery, if any.

### Staff account administration

- which personal fields Doctor and Assistant may edit for themselves;
- which changes require current-password reauthentication;
- what the Doctor may edit on the Assistant account;
- whether Doctor may initiate Assistant recovery;
- Assistant disable/re-enable behavior;
- session termination when an account is disabled;
- replacement of the current Assistant and treatment of the former Assistant account/private sticky;
- whether the one-Doctor/one-Assistant database rule changes or remains one active account per role.

### Clinic administration

- which clinic fields the Doctor may edit;
- whether clinic email/phone are administrative contact channels or authentication/recovery channels;
- whether clinic deletion, ownership transfer, or Doctor replacement are in or out of Phase 8.

### Security action behavior

- which actions revoke current or other sessions;
- whether any security action participates in the five-second Undo rule;
- password validation rules;
- whether account/security events need a user-visible history in this phase.

### Browser demo

- how trusted-device behavior is represented in the browser-only demo;
- whether recovery is simulated and, if so, how it is clearly distinguished from real email/SMS delivery;
- which administration behaviors must mirror the backend.

## Implementation boundary

Do not implement Phase 8 until the product owner has answered the clarification questions. Do not invent fields, screens, permissions, recovery algorithms, device lifetimes, dependencies, or fallback behavior to fill gaps.

After decisions are approved, Phase 8 must update backend models/services/API, frontend flows, browser-demo parity, tests, migrations, documentation, and the Phase 0 foundation record together.