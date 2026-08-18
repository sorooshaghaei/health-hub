# Phase 0 — Foundation

## Status

**Complete as the current foundation contract for Health Hub.**

Phase 0 defines the technical and access foundation on which the later clinic workflows are built. This document describes the **current final foundation**, including the account, clinic-membership, and trusted-device structure established through Phase 8. Obsolete username, shared-clinic-password, and old demo-authentication flows are not part of the current specification.

## Technical foundation

Health Hub uses:

- React/Vite frontend;
- Django REST Framework backend;
- PostgreSQL primary database;
- clinic-scoped operational and Patient data;
- global personal staff accounts;
- clinic-specific Doctor and Assistant memberships;
- trusted-device authorization per clinic;
- authenticated staff sessions;
- the same React application UI for production and the public GitHub Pages demo.

The clinic is the operational data boundary. Personal staff identity is separate from clinic data.

## Account, clinic, and workspace boundary

The current access model separates four concepts:

1. **Personal account** — the Doctor or Assistant as a person;
2. **Clinic membership** — that person's Doctor or Assistant role in one clinic;
3. **Trusted device** — whether the current browser is authorized for that clinic;
4. **Workspace** — Doctor or Assistant workspace opened for the selected membership.

A personal account may belong to multiple clinics. Clinic Patient, Appointment, queue, room-call, task, and trusted-device data remain isolated by clinic.

Each clinic has at most:

- one active Doctor membership;
- one active Assistant membership.

Both Doctors and Assistants may belong to multiple clinics.

Workspace authorization is:

- Doctor membership → Doctor workspace;
- Doctor membership → Assistant workspace for administrator intervention;
- Assistant membership → Assistant workspace;
- Assistant membership cannot open Doctor workspace.

## Personal authentication

There is no active username login and no shared clinic password.

A person authenticates with either:

- email or phone + password; or
- a registered passkey where supported.

Both personal email and phone must be verified before clinic operational data can open.

Authentication of the person and authorization of a browser for a clinic are separate security boundaries.

## Normal access flow

For an existing staff member, the current foundation is:

1. sign in to the personal account;
2. complete personal contact verification if still required;
3. choose a clinic membership;
4. authorize the current browser for that clinic if it is not already trusted;
5. choose an allowed workspace;
6. enter the clinic workflow.

A global personal session before clinic selection cannot open clinic operational data.

## First clinic and first trusted browser

For a brand-new clinic:

1. the clinic is created;
2. the current browser becomes that clinic's first trusted device automatically;
3. the first Doctor personal account is created and attached to the clinic through a Doctor membership;
4. the Doctor verifies both personal email and phone before clinic operational data opens.

The first browser is trusted automatically so initial clinic creation does not require a second device or an already-existing clinic authorization mechanism.

Clinic-level email, clinic-level phone, and clinic passwords are not authentication or recovery credentials.

## Trusted-device authorization

Trusted-device authorization is **per clinic**.

A browser that is not trusted for the selected clinic may be authorized using either of two methods.

### Verified-contact authorization

The signed-in person may request a verification code through either:

- verified personal email; or
- verified personal SMS/phone.

After successful verification, that browser receives its own trusted-device authorization for the selected clinic.

### Pairing through another trusted device

The existing pairing method remains available:

1. the new browser starts a pairing request for a clinic membership;
2. Health Hub displays a six-digit pairing code;
3. the pairing request expires after 10 minutes;
4. a signed-in Doctor or Assistant on an already trusted device for that clinic opens **Devices** and approves the code;
5. the requesting browser claims its own trusted-device credential;
6. the pairing code cannot be reused.

No Patient or other clinic operational data is exposed to the requesting browser merely because it has started a pairing request.

## Trusted-device management

- Trust belongs to the clinic, not globally to the person.
- Trusted devices remain trusted until explicitly removed.
- Both Doctor and Assistant memberships may view the trusted-device list for the active clinic.
- Each device row identifies browser, operating system, added date, and whether it is the **Current device**.
- Other trusted devices may be removed.
- **The current trusted device cannot be removed.**
- Signing out ends the staff session but does not remove device trust.
- Clearing browser storage, changing browser, reinstalling the browser, or using another computer requires authorization again for the relevant clinic.
- Device/security actions do not use the five-second workflow Undo.

The current-device restriction keeps device management simple: Health Hub does not allow a staff member to invalidate the exact trusted browser from which they are currently operating.

## Session and API security boundary

Personal and clinic-bound sessions are deliberately different.

### Global personal session

After personal authentication but before clinic selection:

- the session identifies the person;
- no clinic membership is active;
- no trusted device is bound to the session;
- clinic operational APIs are unavailable.

### Active clinic session

After clinic, device, and workspace selection:

- the session is bound to one active clinic membership;
- the session is bound to one trusted device for that clinic;
- the session carries the active workspace role.

Clinic-bound authenticated API requests require:

- `Authorization: Bearer <session-token>`; and
- proof of the matching trusted device.

The explicit browser header is `X-Device-Token`. The trusted-device credential may also be represented by the clinic-specific HttpOnly `SameSite=Strict` browser cookie where supported by the request path.

A copied bearer token alone is insufficient to open clinic data from another browser. A device credential for another clinic or another trusted device does not satisfy the active session binding.

Trusted-device secrets and staff-session secrets are stored as hashes rather than plaintext database credentials.

## Session lifecycle

The current default staff-session policy is:

- 12-hour absolute lifetime;
- 2-hour inactivity timeout;
- no Remember Me behavior;
- browser close does not itself revoke a still-valid server session;
- explicit sign-out deletes the staff session;
- sign-out does not remove trusted-device authorization.

Switching clinics clears the previous active clinic/device/workspace binding before another clinic is selected.

## Browser demo

The GitHub Pages demo uses the **same React application UI** as the real web application. There is no separate demo product, separate demo login screen, or active demo username flow.

The Pages build differs only below the UI boundary:

- production API calls are replaced by a browser-local adapter;
- visible account, clinic-selection, workspace, Patient, Appointment, queue, task, and settings screens remain the production React components.

The demo login uses **Email or phone**, matching the real application.

The browser adapter is demonstration storage only. It does not provide or claim real production security infrastructure. In particular, it does not provide real:

- email/SMS delivery;
- trusted-device authority;
- WebAuthn/passkey security;
- medical-data storage guarantees.

Real Patient information must not be entered into the public browser demo.

## Foundation invariants

The following are current product invariants:

- no shared clinic password;
- no active username login;
- personal identity is global;
- clinic operational data is clinic-scoped;
- both Doctors and Assistants may have memberships in multiple clinics;
- each clinic has at most one active Doctor and one active Assistant;
- both personal email and phone must be verified before clinic operational data opens;
- trusted-device authorization is per clinic;
- verified email/SMS authorization and trusted-device pairing are both valid device-authorization methods;
- clinic-bound bearer sessions require matching trusted-device proof;
- the current trusted device cannot be removed;
- sign-out does not untrust the browser;
- Doctor membership may open Doctor or Assistant workspace;
- Assistant membership may open Assistant workspace only;
- security/account actions do not use the five-second operational Undo;
- GitHub Pages uses the same production React product UI and substitutes only the browser-local API layer.

## Relationship to later phases

Phase 0 is the foundation rather than a competing historical authentication design. Detailed account recovery, contact-change, passkey, Assistant-replacement, and multi-clinic administration rules are specified in [`PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](PHASE_8_AUTHENTICATION_ADMINISTRATION.md).

Patient, Appointment, queue, consultation, task, and sticky behavior are specified in their corresponding Phase 1–7 documents.

**Phase 0 is complete.**
