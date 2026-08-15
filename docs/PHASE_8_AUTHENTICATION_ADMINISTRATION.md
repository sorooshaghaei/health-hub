# Phase 8 — Authentication recovery and clinic administration

## Status

**Not started. Clarification in progress.**

Phase 8 includes the approved correction to the Phase 0 authentication boundary plus password recovery and clinic/staff administration. No Phase 8 application code has been implemented yet.

## Problem being corrected

The current application requires a shared clinic email/password before individual Doctor or Assistant authentication. That shared secret creates two product problems:

- changing or forgetting the clinic password affects both staff members and requires coordination;
- a shared clinic password is not the desired final privacy boundary for preventing arbitrary outside devices from accessing clinic data.

The final design therefore separates **clinic/device authorization** from **individual staff authentication**.

## Approved decisions

The following decisions are approved and may be treated as fixed unless the product owner explicitly revises them.

### Trusted clinic devices

- The shared clinic password is removed from normal daily authentication.
- A clinic device/browser must be trusted before it can be used for normal clinic access.
- An untrusted device cannot access clinic or Patient data, even if a staff password is known.
- The first-device flow must explicitly ask whether the current computer/browser should be trusted and remembered.
- Doctor and Assistant are both permitted to authorize additional clinic devices.
- New-device authorization uses a verified email or SMS channel; the Doctor or Assistant performing the authorization chooses which channel.
- A trusted device stays trusted indefinitely until Doctor or Assistant explicitly removes it.
- Doctor and Assistant may explicitly remove a trusted device.
- Trusted-device authorization is separate from the logged-in staff session.
- Signing out Doctor or Assistant does not remove the device's trusted status.
- Clearing browser storage, switching to a different browser, reinstalling the browser, or changing computers requires device authorization again.
- Remote access from an untrusted device is blocked for both Doctor and Assistant.

### Daily sign-in

- The Doctor/Assistant role-selection screen remains.
- Staff sign in using verified email or verified phone number rather than relying on the clinic email/password layer.
- Phone number is required on staff accounts.
- Passkey/device-biometric login is included in Phase 8.
- Password-based account recovery remains supported.
- Username remains an editable staff profile field, but it is not approved as a normal sign-in identifier at this point.

### Contact verification and self-service account settings

- Doctor and Assistant may edit their own first name, last name, username, email, phone number, and password.
- Email addresses must be verified.
- Phone numbers must be verified.
- Initial account setup/activation must verify staff contact information.
- Changing email, phone number, or password requires a verification step.
- The exact sequencing of current-credential reauthentication versus contact verification remains unresolved.

### Forgotten-password recovery

- Doctor and Assistant choose whether to recover through verified email or verified SMS.
- Recovery authorization is valid for 30 minutes or until a new password is successfully set, whichever occurs first.
- A newer recovery request invalidates an older outstanding recovery authorization.
- A successful forgotten-password reset revokes every existing staff session belonging to the affected account.
- Recovery affects only that individual account; it never resets a clinic-wide shared password and never distributes the newly chosen password to the other staff member.

### Offline emergency recovery

- The Doctor receives a list of offline recovery codes.
- Each offline recovery code is one-time use.
- The Doctor is responsible for keeping the codes somewhere safe.
- Offline recovery codes are a Doctor-controlled recovery mechanism.
- If an Assistant loses access to normal email/SMS recovery, the Doctor must be able to help recover/reset the Assistant rather than requiring a clinic-wide credential change.
- The precise way a Doctor-held code is used for Assistant recovery is still unresolved and must not be invented during implementation.

### Doctor administration of the Assistant account

The Doctor may:

- edit Assistant identity/contact information;
- initiate Assistant recovery;
- perform a total Assistant-account reset when the clinic hires a different Assistant.

Assistant replacement uses the existing Assistant slot/account rather than retaining an archived former-Assistant account. Clinic, Patient, Appointment, queue, consultation, and other clinic operational data must remain unaffected by the personnel change.

After a total Assistant reset, the replacement Assistant establishes their own password and enters/verifies their own identity/contact information.

A separate Assistant disable/re-enable workflow is not approved for Phase 8 at this point.

### Clinic contact fields

- Clinic-level email and phone are no longer needed for authentication or recovery because those functions move to verified individual staff contacts.
- The shared clinic password is removed from the target architecture.
- The clinic itself remains the tenant/container for clinic-scoped data.

### Doctor identity and multiple clinics

- Doctor replacement/ownership transfer is not part of Phase 8.
- A Doctor must be able to use one personal Doctor account across more than one clinic, rather than creating unrelated Doctor identities for each clinic.
- Clinic operational and Patient data remain clinic-scoped.
- Exact multi-clinic membership, clinic-selection, device-trust, and Doctor-private-sticky behavior remains unresolved.

### Security actions

- Password changes/resets, trusted-device removal, account resets, and other security/account actions do not use the five-second Undo workflow.

### Browser demo

- The public browser demo must remain the same frontend/codebase through the browser adapter rather than becoming a separately maintained code fork.
- Real email/SMS recovery is unavailable in the browser-only demo.
- Real trusted-device authorization is unavailable in the browser-only demo.
- The exact demo entry/authentication flow still needs to be defined so the demo does not preserve obsolete production authentication merely for convenience.

## Existing implementation that Phase 8 must replace or migrate

The current repository still contains:

- `Clinic.password_hash`;
- clinic entry using clinic email + clinic password;
- a signed clinic-access token issued after clinic-password validation;
- staff login performed after clinic access;
- `StaffUser.clinic`, which links one staff account to one clinic;
- separate `StaffSession` records for individual staff sessions;
- clinic-level email and phone fields.

Phase 8 must migrate this architecture deliberately. Documentation must not describe trusted-device authorization, passkeys, verified phone recovery, or multi-clinic Doctor membership as already implemented until code, migrations, tests, frontend, and browser adapter match it.

## Remaining clarification before implementation

The following decisions are intentionally **not predetermined**.

### 1. First-device/bootstrap sequence

The first computer/browser must ask whether it should be trusted and remembered. Still unresolved:

- at exactly what point that prompt appears during new-clinic/Doctor setup;
- whether both Doctor email and phone must be verified before that first device may be trusted;
- whether trusting the first device needs any additional verification beyond the already completed account/contact verification.

### 2. New/untrusted-device sequence

Because untrusted devices are blocked from clinic data, the application still needs a limited pre-access authorization flow. Still unresolved:

- what the user sees before device authorization;
- how the target clinic is identified/selected;
- whether staff identity authentication happens before or after device authorization;
- what exact device information is displayed in the trusted-device management list.

### 3. Staff session behavior

Trusted-device lifetime is approved, but staff-session lifetime is separate and unresolved:

- session duration;
- inactivity timeout, if any;
- whether closing the browser ends the staff session;
- whether there is any separate Remember me/session option.

### 4. Passkeys

Passkeys/device biometrics are in scope, but still unresolved:

- whether passkey is an optional alternative to password or the preferred/required sign-in method after enrollment;
- whether password remains available for normal sign-in;
- whether an account may register more than one passkey/device;
- how passkeys are removed/replaced from account settings.

### 5. Verification when changing credentials/contact information

Verification is required, but still unresolved:

- whether both email and phone must be verified before an account is considered fully activated;
- when changing email, whether verification is sent only to the new email, also to the old email, or combined with current-password/passkey reauthentication;
- equivalent behavior for changing phone number;
- when changing password while already signed in, whether current password/passkey is also required in addition to the verification code;
- which verified channel is used for a password-change verification code.

### 6. Offline recovery codes

Still unresolved:

- how many Doctor offline codes are generated at a time;
- whether generating a replacement list invalidates every unused code in the previous list;
- whether a Doctor-held code can directly recover the Doctor account only, or whether it is also entered directly for Assistant recovery;
- alternatively, whether the Doctor uses their own authenticated/recovered access to generate a separate one-time Assistant setup/recovery credential.

### 7. Total Assistant reset

Still unresolved:

- whether total reset erases the former Assistant private sticky;
- what happens to historical task comments authored by the former Assistant, because reusing the same database account could otherwise make those comments appear to have been written by the replacement Assistant;
- which existing Assistant account fields/credentials/passkeys/sessions are erased by total reset;
- how the replacement Assistant obtains the first setup credential before their own email and phone are established and verified.

### 8. Doctor account across multiple clinics

The requirement for one Doctor identity across multiple clinics changes the current one-clinic `StaffUser` model. Still unresolved:

- whether only Doctors may belong to multiple clinics or Assistants may also work in multiple clinics;
- whether one Doctor may be the Doctor for multiple clinics simultaneously;
- how a Doctor selects which clinic to open;
- whether each clinic must independently trust the same physical browser/device;
- whether the Doctor's private sticky is one global personal sticky across all clinics or a separate private sticky per clinic;
- whether Doctor profile/contact/passkeys/recovery are global across all clinic memberships.

### 9. Password/security internals

Still unresolved:

- password validation/minimum requirements;
- recovery/device-verification throttling;
- generic non-account-enumerating responses;
- token/code hashing and other implementation-level protections that need an approved security policy.

### 10. Browser-demo entry flow

Trusted-device and real recovery features are unavailable in the demo, but the same frontend is retained. Still unresolved:

- what replaces production device authorization in the demo;
- whether the demo starts with a simple Demo access action before the existing Doctor/Assistant role chooser;
- whether demo password/passkey behavior is simulated, simplified, or omitted.

## Implementation boundary

Do not implement Phase 8 until the remaining clarification questions are answered. Do not invent screens, permissions, account-membership behavior, recovery-code semantics, session lifetimes, passkey policy, reset behavior, or demo behavior to fill gaps.

After the decisions are approved, Phase 8 must update backend models/services/API, frontend flows, browser-adapter parity, tests, migrations, documentation, and the Phase 0 foundation record together.