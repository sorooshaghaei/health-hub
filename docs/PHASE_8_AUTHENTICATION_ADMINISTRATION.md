# Phase 8 — Account recovery, administration, and security

## Status

**Implemented and validated, including the browser-demo parity and entry-UX corrective passes.**

Phase 8 replaces the Phase 0 per-clinic staff identity model with global personal accounts plus clinic memberships, while preserving the trusted-device boundary around clinic operational data.

The original Phase 8 implementation was validated on commit `78bd2753c7b8b2c049576be8454ae512e311e6a0`. A later corrective pass fixed a demo-only regression where the GitHub Pages build still selected the legacy `DemoApp` authentication screen and therefore displayed the obsolete Username field. A final UX correction kept the same Phase 8 security model while removing unnecessary architecture choices from the everyday entry screen.

The final invariant is explicit: **GitHub Pages renders the same production React application and Phase 8 account screens; only its API/security transport is replaced by a browser-local adapter.** The visible login identifier is **Email or phone**, the old username contract is rejected, and the first screen is the sign-in form rather than a multi-choice architecture explainer.

The final corrective code/test commit `99e2bc072f3c99c4d0bb6bc5f846ea1db6d3bd58` passed the complete Verify foundation workflow: frontend browser tests, production/demo builds, Django checks, migration verification/application, and the PostgreSQL backend suite.

## Final account model

`StaffUser` is the global personal identity. Personal data follows the person across clinics:

- first name;
- last name;
- unique email;
- unique phone;
- password;
- email/phone verification state;
- passkeys;
- Doctor offline recovery codes;
- private sticky.

`StaffMembership` carries clinic-specific identity:

- clinic;
- Doctor or Assistant role;
- active/inactive membership state;
- clinic-specific task-attention seen state.

Each clinic has at most one active Doctor membership and one active Assistant membership.

Both Doctors and Assistants may belong to multiple clinics. A Doctor may be Doctor in multiple clinics simultaneously. A personal account cannot hold two roles in the same clinic.

Clinic operational data remains strictly clinic-scoped. Patient, Appointment, queue, room-call, shared-task, task-attention, and trusted-device queries resolve from the active session membership rather than from a permanent clinic field on the person.

## Clinic fields

Clinic-level email and phone were removed. A clinic now contains its identity/name and operational data only.

Authentication, verification, recovery, and security notifications use individual staff contacts. The removed shared clinic-password architecture remains removed.

## Sign-in and clinic selection

The security architecture is global-account-first, but the UI intentionally hides unnecessary architecture from daily users.

The first screen is the actual sign-in form:

- **Email or phone**;
- password;
- Sign in;
- optional **Use passkey**;
- **Forgot password?** in the same sign-in area;
- secondary **Create a clinic** action;
- small **Have an Assistant setup code? Join a clinic** path for a new Assistant.

After successful personal authentication:

1. verify personal email/phone only if still required;
2. if the person has exactly one active clinic membership, select that clinic automatically;
3. if the person has multiple clinic memberships, show the clinic chooser;
4. authorize the browser only if the selected clinic does not already trust it;
5. choose an allowed workspace for that membership.

Normal password sign-in accepts either verified account email or phone plus password.

The old username field is removed from the production account model, production API, and active GitHub Pages demo flow.

Workspace authorization remains:

- Doctor membership → Doctor workspace;
- Doctor membership → Assistant workspace for administrator intervention;
- Assistant membership → Assistant workspace;
- Assistant membership cannot open Doctor workspace.

## Contact verification

Phone is required for new staff accounts.

Both personal email and phone must be verified before clinic operational data may open. The server enforces this at the clinic-membership permission boundary, not only in the frontend.

Verification codes:

- six digits;
- expire after 10 minutes by default;
- resend minimum 60 seconds by default;
- maximum five failed attempts;
- code material is stored as keyed hashes, not plaintext.

Email delivery uses Django email infrastructure. SMS delivery is provider-pluggable through the configured `SMS_SENDER`; production does not silently pretend SMS delivery occurred when no provider is configured.

## Trusted-device authorization

Trusted-device authorization remains separate for each clinic.

A browser can become trusted for a clinic through either:

- a verification code sent to the signed-in person's verified email or verified phone; or
- the existing six-digit pairing flow approved from an already trusted device for that clinic.

Trusted devices remain trusted until removed. Clearing browser storage, changing browser/computer, or removing trust requires authorization again for that clinic.

Both Doctor and Assistant memberships may review and remove trusted devices for the active clinic.

Phase 8 removes the Phase 0 last-device deletion lockout. The final trusted device may be removed because verified-contact authorization can establish a new trusted browser later.

An active clinic staff session requires both:

- the bearer session token; and
- proof of the exact trusted device bound to that active clinic session.

A copied bearer token alone cannot be replayed for clinic operational APIs.

Global account sessions before clinic selection intentionally have no clinic/device binding and cannot open clinic operational data.

## Session policy

Default staff-session policy:

- 12-hour absolute maximum lifetime;
- 2-hour inactivity timeout;
- no Remember Me behavior;
- browser close does not itself revoke a valid server session;
- explicit sign-out deletes the staff session;
- sign-out does not remove trusted-device authorization.

Selecting a clinic binds the session to one `StaffMembership`, trusted device, and workspace. Leaving/switching clinic clears that active clinic binding before a different membership is selected.

## Profile and contact changes

Doctor and Assistant own their global personal profile.

First/last name can be edited directly.

Email and phone changes require recent reauthentication by either:

- current password; or
- a registered passkey.

The new contact value must then be verified. The former contact receives a best-effort security notice after the change.

Changing a contact changes the global personal account, so the new verified value applies to every clinic membership.

## Password changes

Normal password change does not require entering the current password again. The signed-in person chooses verified email or verified SMS, receives a code, verifies it, and chooses the new password.

Passwords use Django's configured password validators.

A successful normal password change:

- preserves the current session;
- revokes the person's other sessions;
- does not alter trusted-device records.

Security/account changes do not use the five-second Undo mechanism.

## Forgotten-password recovery

Forgotten-password recovery is individual and global across clinic memberships.

The user chooses verified email or verified SMS. Public recovery-request responses are generic so account existence is not disclosed through the normal response.

A verified recovery code creates a recovery grant that is valid for 30 minutes or until consumed. Creating a newer grant invalidates older outstanding grants.

Successful forgotten-password reset:

- validates the new password;
- consumes the recovery grant;
- revokes all sessions belonging to the recovered person;
- does not alter trusted-device records;
- does not alter another staff person's credentials or sessions.

## Doctor offline recovery codes

Offline recovery codes are available only to a person with at least one active Doctor membership.

- ten codes are generated at a time;
- each code is one-time use;
- codes are stored using password hashing, not plaintext;
- generating a new list invalidates every unused code from the previous list;
- Doctor codes recover only that Doctor's global account;
- they are not transferable Assistant credentials.

The UI shows newly generated plaintext codes only at generation time so the Doctor can store them offline.

## Passkeys

Passkeys are optional; password sign-in remains available.

A verified personal account may register up to five passkeys. WebAuthn registration/authentication challenges are server-created, short-lived, and single-use. Credential assertions are cryptographically verified server-side.

Passkeys can be used for:

- normal personal-account sign-in;
- sensitive-operation reauthentication.

Removing a passkey requires either:

- current password; or
- recent successful reauthentication using a different passkey.

The implementation uses the `webauthn` Python dependency and configured RP ID/origin settings.

## Assistant administration and replacement

The Doctor membership owns the clinic's Assistant slot management.

The Doctor may:

- view the active Assistant's identity/contact summary;
- initiate normal recovery to the Assistant's own verified email/SMS;
- generate a one-time setup code;
- explicitly replace the current Assistant.

Replacement behavior is membership-based, not destructive account reuse:

1. old Assistant membership for that clinic becomes inactive;
2. sessions tied to that old membership are ended;
3. clinic Patient/Appointment/queue/task data are unchanged;
4. old Assistant retains their global personal account, password, contacts, passkeys, private sticky, and memberships in other clinics;
5. historical task/comment authorship remains attached to the original person; inactive historical membership may be displayed as former Assistant;
6. Doctor receives a one-time Assistant setup code;
7. replacement Assistant can create a new global account or attach an existing global account to the clinic;
8. clinic operational data still cannot open until that person verifies both contacts and authorizes a trusted browser for the clinic.

There is no Doctor replacement/ownership-transfer workflow in Phase 8.

## Private sticky across clinics

The private sticky belongs to the global person, not to a clinic membership.

It therefore follows the person across clinics, but remains visible only when the active workspace matches that membership's own role:

- Doctor membership in Doctor workspace → Doctor sees their global sticky;
- Assistant membership in Assistant workspace → Assistant sees their global sticky;
- Doctor membership using Assistant workspace → no private sticky is exposed.

## Shared-task identity after multi-clinic/replacement changes

Task data remains clinic-scoped.

Doctor task-authoring permission is derived from the active clinic membership rather than from a global role field.

Task attention seen state is membership-scoped, so activity in one clinic does not clear the attention state in another clinic.

Historical task comments continue to reference their original personal author even after that person's clinic membership is inactive.

## Browser demo

The public GitHub Pages demo **must not have a separate product UI or separate authentication screen**.

The Pages build renders the same production Phase 8 screens and navigation as the real frontend. Its first screen is therefore the same simplified sign-in form, with **Email or phone**, secondary Create clinic, and the small Assistant setup-code path.

The only demo-specific substitution is below the UI boundary: `VITE_DEMO_API=true` routes API calls to a browser-local adapter instead of a Django/PostgreSQL server. `VITE_DEMO_MODE=false` is intentionally used for the Pages build so production React components remain active.

The browser adapter preserves the product workflow and Phase 8 account model sufficiently for demonstration, including personal accounts, email/phone login, contact-verification flow, clinic membership selection, browser authorization, account settings, clinic team setup, and clinic-scoped operational data. Existing Patient/Appointment/queue/task demo logic is reused behind that adapter.

The browser demo still must not fabricate real security infrastructure. In particular:

- verification codes shown by the demo are local development/demo codes, not delivered email/SMS;
- trusted-device records are browser-local simulation, not a production trust boundary;
- passkeys are not simulated as real WebAuthn security and explicitly report that limitation;
- browser storage is demonstration state only and must never contain real Patient information.

Regression coverage locks the UI contract: production and Pages share one React application; the login form is visible immediately; the old architecture-explainer landing is absent; one clinic is auto-selected; username login is rejected; and the browser adapter remains the only Pages-specific substitution.

## Migrations and compatibility

Migration `accounts.0006_phase8_global_accounts`:

- creates `StaffMembership` rows from the former per-user clinic/role data;
- removes Clinic email/phone;
- removes `StaffUser.username`, `StaffUser.clinic`, and `StaffUser.role` database fields;
- introduces verification, passkey, recovery, and Assistant-setup models;
- makes staff sessions capable of existing globally before clinic selection.

Migration `accounts.0007_alter_staffuser_options` records the final inherited Django user model options so `makemigrations --check --dry-run` remains clean.

The custom `HealthHubDiscoverRunner` adapts only historical Phase 1–7 test-fixture setup syntax during `manage.py test`. It does not change the production registration/login API. This keeps the older workflow regression suite useful while dedicated Phase 8 tests exercise the real new account API.

## Explicitly not added

Phase 8 does not add:

- shared clinic passwords;
- username login;
- clinic email/phone authentication;
- Doctor ownership transfer;
- security-event history UI;
- security-action five-second Undo;
- a separate demo login/product application;
- a mandatory clinic chooser for single-clinic users;
- a primary Assistant-join card on the landing page;
- fake production security inside the browser demo.

## Next phase boundary

Phase 8 is complete after the UI corrective passes. Stop before Phase 9.

Phase 9 is sensitive attachment architecture. Do not design or implement attachment storage, encryption, access control, file limits/types, scanning, retention/deletion, backups, audit requirements, or related Patient-file behavior until the product owner explicitly says **continue** and Phase 9 decisions are clarified.
