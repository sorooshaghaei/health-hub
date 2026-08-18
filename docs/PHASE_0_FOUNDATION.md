# Phase 0 — Foundation

## Status

**Complete as the current foundation contract for Health Hub.**

Phase 0 describes the foundation as it exists after the Phase 8 identity reconciliation. Historical username, shared-clinic-password, membership-owned-role, and clinic-scoped trusted-device designs are not part of the current specification.

## Technical foundation

Health Hub uses:

- React/Vite frontend;
- Django REST Framework backend;
- PostgreSQL primary database;
- clinic-scoped Patient and operational data;
- global personal staff accounts;
- permanent Doctor or Assistant account roles;
- clinic memberships that link accounts to clinics;
- account-scoped trusted devices;
- authenticated staff sessions;
- the same React product UI for production and the GitHub Pages demo.

The clinic remains the operational-data/tenant boundary. Personal staff identity and device trust are global to the person.

## Account, membership, device, and workspace boundaries

The final access model separates four concepts:

1. **Personal account** — one global person with permanent `DOCTOR` or `ASSISTANT` role;
2. **Clinic membership** — permission for that account to enter one clinic;
3. **Trusted device** — whether a browser is trusted for that personal account;
4. **Workspace** — Doctor or Assistant operational view selected inside the active clinic.

A Doctor account cannot become Assistant and an Assistant account cannot become Doctor. The same account cannot hold different roles in different clinics.

Both account types may belong to multiple clinics.

Each clinic currently has at most:

- one owning Doctor; and
- one active Assistant.

Only Doctors create clinics.

Workspace authorization is:

- Doctor account + active clinic membership → Doctor workspace;
- Doctor account + active clinic membership → Assistant workspace as administrator;
- Assistant account + active clinic membership → Assistant workspace only.

Opening the Assistant workspace as a Doctor never changes the Doctor's account role.

## Personal authentication

There is no active username login and no shared clinic password.

A person authenticates with:

- selected permanent role + email or phone + password; or
- selected permanent role + a registered passkey.

Both personal email and phone must be verified before clinic operational data can open.

A wrong role selection is rejected rather than changing or inferring a different account role.

## New-account foundation

New Doctor:

1. choose Doctor;
2. create personal account;
3. verify email;
4. verify phone;
5. create clinic;
6. current browser becomes the first trusted device automatically;
7. Doctor ownership/membership is created;
8. enter Doctor workspace.

New Assistant:

1. choose Assistant;
2. create personal account;
3. verify email;
4. verify phone;
5. enter the Doctor's one-time Assistant setup code;
6. current browser becomes the first trusted device automatically;
7. Assistant membership is created;
8. enter Assistant workspace.

Assistant setup codes are one-time and valid for 24 hours by default.

## Existing account on a trusted browser

Existing staff on a trusted browser:

1. choose permanent role;
2. sign in with email/phone + password or passkey;
3. if exactly one clinic membership exists, open it directly;
4. if several memberships exist, choose a clinic;
5. enter the default role workspace.

A trusted browser does not require a second OTP merely because the person switches clinics.

## Existing account on a new browser

After successful personal sign-in on an untrusted browser:

1. choose verified email or verified SMS;
2. receive one six-digit authorization code;
3. verify the code;
4. make that browser trusted for the global account;
5. choose/open a clinic membership.

Both contacts were already verified at account setup; only one verified channel is required to authorize a later new device.

## Trusted-device model

Trusted-device authorization is **global per personal account**.

A trusted browser works with every clinic membership belonging to that account.

Trusted-device management rules:

- devices are listed for the personal account, not per clinic;
- the current trusted device is identified;
- the current trusted device cannot be removed;
- other trusted devices may be removed;
- removing another device ends sessions bound to it across all clinics;
- explicit sign-out ends a session but does not remove device trust;
- security/device actions do not use the five-second operational Undo.

A new browser is normally authorized through verified email or SMS. The backend also retains account-scoped pairing primitives for compatibility/internal use, but the approved visible Phase 8 new-device flow is verified email/SMS.

## Session and API security boundary

A staff session may exist before a clinic is active so onboarding, contact verification, account recovery, and device authorization can occur without exposing operational data.

An active clinic session records:

- the selected active clinic membership;
- the selected workspace;
- the trusted device bound to that personal session.

When a session is bound to a trusted device, authenticated requests require:

- `Authorization: Bearer <session-token>`; and
- proof of the matching account-scoped trusted device through `X-Device-Token` or the account-scoped HttpOnly `SameSite=Strict` cookie where available.

A copied bearer token alone cannot replay a trusted-device-bound session from another browser.

Clinic switching clears the active membership/workspace while preserving the account-scoped device binding.

## Session lifecycle

Default staff-session policy:

- 12-hour absolute lifetime;
- 2-hour inactivity timeout;
- no Remember Me;
- browser close does not automatically revoke a still-valid server session;
- explicit sign-out revokes the session;
- sign-out does not untrust the browser.

Normal sign-in does not count as explicit sensitive-operation reauthentication. Sensitive contact/account operations use the separate reauthentication rules defined in Phase 8.

## Clinic and timezone boundary

Clinic Patient, Appointment, queue, room-call, shared-task, and task-attention data remain strictly clinic-scoped through the active membership.

Each clinic stores one operational IANA timezone. The clinic timezone defines the clinic day for date-sensitive Appointment/queue/consultation behavior; a travelling browser does not silently change the clinic's operational day.

Global accounts and devices do not merge operational data across clinics.

## Browser demo

GitHub Pages renders the same production React product UI. It does not maintain a separate username/demo application.

The Pages environment replaces only the API/security transport with a browser-local adapter. Visible role choice, account creation, contact verification, device authorization, clinic selection, workspaces, Patient/Appointment/queue/task flows, and settings remain the production components.

Browser-local verification codes and trusted-device records are demonstration state, not production security. The demo does not claim real email/SMS delivery, WebAuthn security, or medical-data guarantees.

Real Patient information must not be entered into the public demo.

## Foundation invariants

Current invariants are:

- one global personal staff account;
- one permanent Doctor or Assistant role per account;
- no role switching or mixed roles across clinics;
- no shared clinic password;
- no username login;
- both email and phone verified before clinic operational access;
- only Doctors create/own clinics;
- both Doctors and Assistants may have multiple clinic memberships;
- one active Assistant slot per clinic in the current product scope;
- trusted devices are global per personal account;
- current trusted device cannot be removed;
- sign-out does not remove device trust;
- Doctor may open Doctor or Assistant administrator workspace;
- Assistant may open Assistant workspace only;
- clinic operational data remains clinic-scoped;
- security/account actions do not use the five-second operational Undo;
- GitHub Pages uses the production React product UI with a browser-local API adapter.

## Relationship to later phases

Detailed verification, device, recovery, passkey, Assistant-replacement, dormant-account, and Doctor-account-deletion rules are defined in [`PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](PHASE_8_AUTHENTICATION_ADMINISTRATION.md).

Patient, Appointment, queue, consultation, task, and private-sticky behavior are specified in Phases 1–7.

**Phase 0 is complete.**