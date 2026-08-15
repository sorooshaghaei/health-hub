# Phase 8 — Account recovery, administration, and security

## Status

**Not started. Decisions and open questions preserved for later.**

The project will first complete the smaller Phase 0 base-authentication correction. Phase 8 begins only after that correction is implemented, validated, documented, committed, and stopped.

## Scope boundary

Phase 0 owns only the minimum trusted-device + individual-staff authentication foundation needed to remove the shared clinic-password boundary safely.

Phase 8 owns the more complicated account lifecycle, recovery, contact verification, administration, passkey management, multi-clinic identity, and broader security behavior described below.

Nothing in this document should be implemented early merely because it is related to authentication.

## Previously approved Phase 8 decisions

### Email/SMS and account recovery

- Both email and SMS are supported as account recovery channels.
- For forgotten-password recovery, the staff member chooses email or SMS.
- Recovery authorization is valid for 30 minutes or until a new password is successfully set, whichever occurs first.
- A newer recovery request invalidates an older outstanding recovery authorization.
- A successful forgotten-password reset revokes all existing sessions belonging to that staff account.
- Doctor and Assistant recovery are individual; one person's reset does not alter another person's credentials.
- Newly chosen passwords are never sent to the other staff member.
- Staff email addresses must be verified.
- Staff phone numbers must be verified.
- Changing email, phone number, or password requires verification.
- Phone number is required on staff accounts.

### New-device authorization upgrade

The Phase 0 correction deliberately authorizes additional clinic devices from an already trusted clinic device so that email/SMS infrastructure does not have to be pulled into the foundation correction.

In Phase 8, preserve the previously approved target behavior:

- Doctor and Assistant may authorize a new clinic device using a verified contact channel;
- the person authorizing the device chooses either verified email or verified SMS;
- the exact verification screen/protocol remains to be designed in Phase 8;
- this Phase 8 mechanism may replace or supplement the Phase 0 trusted-device-to-trusted-device pairing flow only after it is explicitly approved and implemented.

### Staff profile editing

Doctor and Assistant may edit their own:

- first name;
- last name;
- username;
- email;
- phone number;
- password.

The exact reauthentication and contact-change sequence remains unresolved.

### Passkeys and biometrics

- Passkey/device-biometric sign-in is approved for Phase 8.
- Exact passkey policy is not yet decided.

### Doctor emergency recovery

- The Doctor receives a list of offline recovery codes.
- Each code is one-time use.
- The Doctor must keep the codes somewhere safe.
- The exact number, regeneration behavior, and relationship to Assistant recovery remain unresolved.

### Assistant recovery and replacement

The Doctor may:

- edit Assistant identity/contact information;
- initiate Assistant recovery;
- perform a total Assistant-account reset when a different Assistant is hired.

The existing Assistant slot/account is reused rather than preserving a separate archived former-Assistant account.

After reset, the replacement Assistant establishes their own password and enters/verifies their own identity/contact information.

Changing Assistant must not affect clinic, Patient, Appointment, queue, consultation, or other operational data.

The treatment of the former Assistant private sticky, credentials, passkeys, sessions, and historical authored task comments remains unresolved.

A separate Assistant disable/re-enable workflow was not approved as necessary for Phase 8.

### Security actions

- Password changes/resets, device removal, account reset, and other security/account actions do not use the five-second Undo workflow.

### Clinic contacts

- Clinic-level email and phone are no longer intended to be authentication/recovery credentials once individual verified staff contacts provide those functions.
- The shared clinic password is not part of the target architecture.
- Whether clinic email/phone remain as ordinary non-authentication profile/contact fields or are removed entirely still needs an explicit decision before Phase 8 schema changes.

### Doctor identity across clinics

- Doctor replacement/ownership transfer is not part of Phase 8.
- A Doctor should be able to use one personal Doctor identity across more than one clinic instead of creating unrelated Doctor identities for each clinic.
- Clinic operational and Patient data remain clinic-scoped.
- The current `StaffUser.clinic` model does not support this and must not be changed until the multi-clinic behavior is clarified.

### Browser demo

- The GitHub Pages demo remains the same frontend/codebase through the browser adapter rather than becoming a separate application fork.
- Real email/SMS delivery is unavailable in the browser-only demo.
- Real trusted-device security is unavailable in the browser-only demo.
- Phase 0 uses the minimal adapter behavior: bypass real trusted-device authorization and continue into the existing demo Doctor/Assistant flow.
- Any later Phase 8 demo representation of account recovery/passkeys must remain simplified and must not pretend that real email/SMS or hardware trust exists.

## Questions intentionally parked for Phase 8

These questions should **not** block the Phase 0 correction unless one becomes strictly necessary there.

### Account session policy

- staff-session duration;
- inactivity timeout;
- browser-close behavior;
- Remember me behavior.

### Passkey policy

- optional versus preferred/required after enrollment;
- whether password remains a normal sign-in option;
- number of passkeys/devices an account may register;
- passkey removal/replacement flow.

### Contact and credential changes

- whether both email and phone must be verified before initial account activation;
- whether changing email verifies only the new email, both old and new, or also requires current credential reauthentication;
- equivalent behavior for phone changes;
- whether normal password change requires current password/passkey plus an email/SMS code;
- which channel is used for password-change verification.

### Offline recovery codes

- number generated at once;
- whether generating a new list invalidates every unused old code;
- whether Doctor codes recover only the Doctor;
- how the Doctor helps an Assistant who has lost access to normal email/SMS recovery;
- whether Assistant recovery should instead use a separate one-time Doctor-generated setup/recovery credential.

### Total Assistant reset

- whether former Assistant private sticky is erased;
- treatment of old task comments authored by the former Assistant;
- which profile fields, credentials, passkeys, recovery state, and sessions are erased;
- how the replacement Assistant receives the first setup credential before their new email/phone are established.

### Doctor account across multiple clinics

- whether only Doctors may belong to multiple clinics or Assistants may also do so;
- whether one Doctor may be Doctor for multiple clinics simultaneously;
- clinic-selection flow;
- whether trusted-device authorization is per clinic;
- whether Doctor private sticky is global or per-clinic;
- whether profile, contacts, password, passkeys, and recovery are global across clinic memberships.

### Password and security internals

- password validation requirements;
- recovery/device-verification throttling and rate limits;
- generic non-account-enumerating responses;
- token/code hashing and related implementation protections;
- security event history, if any.

### Demo behavior

- exact Phase 8 demo representation of recovery/passkey/account settings;
- whether demo password/passkey UI is simplified, simulated, or omitted.

## Relationship to Phase 0

See [`PHASE_0_FOUNDATION.md`](PHASE_0_FOUNDATION.md).

Phase 0 owns the immediate base-authentication correction. Its approved temporary foundation keeps username/password staff login, uses already-trusted-device approval for additional devices, and bypasses real trusted-device authorization in the static demo.

Phase 8 keeps the account-management/recovery/security decisions above for later, including the eventual verified email/SMS new-device authorization flow.

Do not implement Phase 8 until the Phase 0 correction is complete and the product owner explicitly moves the project forward to Phase 8.