# Phase 0 — Foundation

## Status

**Implemented, with the authentication architecture scheduled for correction in Phase 8.**

Phase 0 established the application foundation, but its original shared clinic-password layer is no longer the intended final authentication model. The current repository still contains that implementation. Phase 8 will correct it; this document must not be read as claiming the correction is already implemented.

## Implemented foundation

Phase 0 established:

- React/Vite frontend;
- Django REST Framework backend;
- PostgreSQL primary database;
- clinic-scoped operational and Patient data;
- one Doctor role and one Assistant role in the current clinic model;
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

The current backend therefore has a clinic password hash and a clinic-access token in addition to individual staff credentials and staff sessions. A `StaffUser` is currently linked to one clinic.

This remains the actual behavior until Phase 8 changes the implementation.

## Approved authentication correction

The product owner has approved the following Phase 8 correction to the Phase 0 foundation.

### Clinic/device boundary

- The clinic remains the tenant/container for clinic data.
- The shared clinic password is removed from normal daily authentication.
- Normal clinic access is gated by a trusted clinic device/browser.
- Trusted-device authorization and individual staff sessions are separate security layers.
- A trusted device is not itself a logged-in Doctor or Assistant session.
- Signing out a staff account ends that staff session without automatically removing trusted-device authorization.
- An arbitrary untrusted device must not gain clinic or Patient-data access merely because somebody knows a staff password.
- Doctor and Assistant may authorize a new clinic device through verified email or SMS and choose which channel to use.
- A trusted device remains trusted indefinitely until Doctor or Assistant explicitly removes it.
- Doctor and Assistant may explicitly remove trusted devices.
- Clearing browser storage, changing browser, reinstalling the browser, or moving to another computer means the device/browser must be authorized again.
- The first-device setup must explicitly ask whether the current computer/browser should be trusted and remembered; the exact ordering of that prompt with initial account/contact verification remains to be confirmed.
- Remote access from an untrusted device is not allowed for either role.

### Individual staff authentication

- Doctor and Assistant continue to authenticate as individual accounts.
- Doctor and Assistant recovery are independent; changing or recovering one person's password does not change another person's credentials.
- The Doctor/Assistant role-selection step remains in the normal sign-in flow.
- Staff identify themselves using verified email or verified phone number for normal sign-in.
- Phone number becomes a required staff-account field.
- Passkey/device-biometric sign-in is included in Phase 8; its exact relationship to password sign-in remains to be confirmed.
- Both email and phone must be verified as account contact methods.
- Staff may edit first name, last name, username, email, phone number, and password.
- Changes to email, phone number, and password require verification; exact reauthentication/verification sequencing remains to be confirmed.

### Recovery

- A user with normal recovery access chooses either verified email or verified SMS for recovery.
- A recovery authorization is valid for 30 minutes or until a new password is successfully set, whichever happens first.
- Issuing a newer recovery request invalidates the older recovery authorization.
- A successful forgotten-password reset revokes all existing sessions belonging to the affected staff account.
- Recovery never distributes a newly generated password to the other staff member.
- Security/account changes do not use the five-second Undo workflow.
- Doctor emergency recovery uses a one-time list of offline recovery codes that must be stored safely; each code can be used only once.
- Those offline recovery codes are controlled by the Doctor. The product owner also wants the Doctor to be able to help an Assistant who has lost normal recovery access; the exact scope and use of a Doctor-held code for Assistant recovery still needs clarification.

### Assistant replacement

- Changing the person working as Assistant must not change clinic/Patient/Appointment operational data.
- The existing Assistant slot/account is to be reset and reused rather than preserving an archived former-Assistant account.
- The Doctor may edit Assistant identity/contact information, initiate Assistant recovery, and perform a total Assistant-account reset for a replacement Assistant.
- After reset, the new Assistant must establish their own password and enter/verify their own contact and identity information.
- The exact treatment of the former Assistant's private sticky and authored task comments during total reset remains to be confirmed.
- A separate Assistant disable/re-enable workflow has not been approved for Phase 8.

### Clinic contacts and Doctor identity

- Clinic-level email and phone are no longer needed as authentication/recovery contacts; staff verified email/phone provide those functions.
- Doctor replacement/ownership transfer is not part of Phase 8.
- A Doctor must be able to use the same personal account in more than one clinic rather than creating unrelated Doctor identities for each clinic.
- The exact multi-clinic membership, clinic-selection, trusted-device, and private-sticky behavior is not yet defined and must be clarified before implementation.

### Browser demo

- The public browser demo remains the same frontend/codebase through its browser adapter; it must not become a separately maintained application fork.
- Real trusted-device authorization and real email/SMS recovery are unavailable in the browser-only demo.
- The exact demo entry/authentication behavior after removal of the shared clinic-password flow remains to be confirmed.

## Still unresolved before Phase 8 implementation

The approved direction above does **not** predetermine the remaining implementation behavior. The open items include:

- exact first-device/bootstrap authorization sequence;
- exact untrusted-device authorization screen/sequence;
- what information appears in trusted-device management;
- staff session lifetime and inactivity/remember-session behavior;
- whether passkey is optional, primary, or required and how many passkeys an account may register;
- whether both email and phone must be verified before initial account activation;
- exact reauthentication rules when changing email, phone, or password;
- exact Doctor-held offline-code behavior for Assistant recovery and recovery-code regeneration;
- exact total-reset treatment of former Assistant private sticky and historical task comments;
- how a replacement Assistant receives the initial setup invitation/credential before their own contacts are established;
- multi-clinic Doctor membership, clinic selection, device authorization per clinic, and private-sticky scope;
- password validation rules and security-only recovery throttling/non-enumeration behavior;
- exact browser-demo entry flow.

## Phase relationship

Phase 0 remains the implemented foundation. Phase 8 is responsible for correcting the authentication boundary without changing unrelated Patient, Appointment, queue, consultation, task, or private-sticky behavior except where an explicitly approved account-reset or multi-clinic decision requires it.

See [`PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](PHASE_8_AUTHENTICATION_ADMINISTRATION.md) for the Phase 8 decision record.