# Phase 0 — Foundation

## Status

**Implemented, including the base-authentication corrective pass and subsequent obsolete-auth cleanup.**

Phase 0 originally established the application foundation. After Phases 1–7, its shared clinic-password layer was reopened and corrected before Phase 8. That corrective pass and its cleanup are now implemented and validated.

This was not a rollback of Phases 1–7. Patient, Appointment, queue, consultation, task, and private-sticky behavior remain implemented.

## Implemented foundation

The repository has:

- React/Vite frontend;
- Django REST Framework backend;
- PostgreSQL primary database;
- clinic-scoped operational and Patient data;
- Doctor and Assistant workspaces;
- Doctor administrator access to Assistant workspace;
- individual staff accounts and staff sessions;
- trusted clinic-device authorization;
- browser-only public demo adapter;
- the completed Phase 1–7 workflows.

## Implemented authentication boundary

The old shared clinic password is no longer part of normal application authentication.

The implemented boundary is:

1. a browser must be trusted for the clinic;
2. on that trusted browser, Doctor or Assistant chooses the workspace role;
3. staff authenticates with the existing individual username + password flow;
4. the resulting staff session is bound to the trusted device that created it;
5. authenticated staff API requests must prove both the staff bearer session and possession of the matching trusted-device credential.

The clinic remains the tenant/container for clinic data. Trusted-device authorization and individual staff sessions are separate. Signing a staff member out ends the staff session without untrusting the browser.

A copied bearer token by itself is not enough to use clinic APIs from another browser. The backend rejects a staff session when the matching trusted-device proof is absent or belongs to another device.

An untrusted browser cannot use staff credentials to open normal clinic or Patient data. The removed `/api/clinics/enter/` shared-password route is not part of the implemented API.

## First clinic device

For a brand-new clinic:

1. the clinic is created;
2. the current browser is automatically registered as the clinic's first trusted device;
3. the Doctor account is created using the existing Phase 0 username/password mechanism;
4. the UI explains that Health Hub only allows clinic access from trusted devices and that the current browser has been registered.

The first browser is auto-trusted so the Doctor cannot create a clinic and immediately lose access to it.

Email/SMS verification is intentionally not part of this Phase 0 flow. Contact verification belongs to Phase 8.

## Additional clinic devices

Phase 0 authorizes another browser through an already trusted clinic device:

- the new/untrusted browser identifies the clinic and receives a six-digit pairing code;
- the pairing request expires after 10 minutes;
- no clinic or Patient data is returned to that browser before approval;
- on an already trusted device, a signed-in Doctor or Assistant opens **Devices** and enters the pairing code;
- the code is single-use;
- after approval, the requesting browser claims its own trusted-device token and can continue to the normal role-selection/sign-in flow.

Verified email/SMS authorization of new devices remains a Phase 8 enhancement.

## Trusted-device management

- Trusted browsers remain trusted indefinitely until explicitly revoked.
- Both Doctor and Assistant may open the trusted-device list.
- Each row shows browser + operating system, added date, and **Current device** when applicable; for example: `Chrome on macOS · Added 16 Aug 2026 · Current device`.
- Each removable row has a **Remove** action.
- Removing a trusted device also ends staff sessions created from that device because sessions are bound to the trusted-device record.
- The last remaining trusted device cannot be removed in the Phase 0 implementation; another device must be paired first. This prevents an unrecoverable clinic lockout before Phase 8 recovery channels exist.
- Signing out does not untrust the current browser.
- Clearing browser storage, changing browser, reinstalling the browser, or using another computer requires authorization again.
- Device removal and other security actions do not use the five-second Undo workflow.

## Tokens and API boundary

- Production frontend trusted-device requests use `X-Device-Token`.
- Production staff API requests send both `Authorization: Bearer <session-token>` and the matching trusted-device proof.
- The automatically trusted first browser also receives an HttpOnly `SameSite=Strict` device cookie as a secondary browser credential for staff-session proof; clinic bootstrap/context, registration, and login still require an explicit trusted-device token.
- Trusted-device secrets are stored as hashes rather than plaintext database values.
- Staff bearer sessions are linked to the trusted device that created them and cannot be replayed successfully without matching device proof.
- The obsolete `X-Clinic-Token` header alias and `clinic_access_token` response alias have been removed from active backend code and regression fixtures. `X-Device-Token` is the only explicit trusted-device header.

## Existing development data

Migration `accounts.0005_trusted_device_auth` deliberately resets incompatible pre-release clinic/authentication data before removing `Clinic.password_hash` and adding the trusted-device models.

This was explicitly approved because existing clinics/accounts were development data and did not require a compatibility migration. This is **not** a general permission to discard future production data.

Historical migrations remain unchanged when they describe fields that existed at the time of those migrations. They are database history, not active authentication behavior.

## Browser demo

The GitHub Pages demo remains the same React frontend through the browser adapter.

Because the static demo has no backend trusted-device authority, it bypasses real trusted-device authorization and continues into the demo Doctor/Assistant flow. The demo has no clinic password, clinic access token, or simulated trusted-device credential. Individual demo staff username/password behavior remains only to exercise the Doctor/Assistant interface locally. It does not simulate real email/SMS delivery or hardware/device trust and is not a medical-data backend.

## Cleanup pass

After the Phase 0 correction, a focused cleanup removed obsolete authentication remnants from active code and tests:

- removed `X-Clinic-Token` compatibility handling;
- removed `clinic_access_token` response/test plumbing;
- removed clinic-password and `/api/clinics/enter/` implementation from the browser demo;
- removed demo-only clinic-token state from the React application;
- converted older Phase 1–7 backend fixtures to `device_token` / `X-Device-Token`;
- converted demo regression fixtures to the credential-free demo clinic boundary;
- removed the unused `CLINIC_ACCESS_TOKEN_MAX_AGE` environment setting and documented `DEVICE_PAIRING_MAX_AGE` instead.

Intentional historical/compatibility behavior is not treated as dead code: Django migration history remains intact, the auth suite retains a regression assertion that `/api/clinics/enter/` is absent, and Appointment validation still rejects obsolete `visit_type` payloads explicitly.

## Validation

The corrective implementation was validated through the repository verification workflow after the pairing cleanup and device-proof boundaries were corrected:

- frontend browser-demo tests passed;
- production frontend build passed;
- GitHub Pages demo build passed;
- Django system checks passed;
- committed-migration check passed;
- migrations applied successfully to PostgreSQL;
- all backend tests passed against PostgreSQL;
- an explicit regression test confirms that a copied bearer session is rejected without its matching trusted-device proof and succeeds with the correct device token.

The post-correction obsolete-auth cleanup must pass the same repository verification workflow before the cleanup is considered complete.

## Explicitly deferred to Phase 8

The following approved ideas and unanswered questions remain in [`PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](PHASE_8_AUTHENTICATION_ADMINISTRATION.md) and were not pulled into Phase 0:

- forgotten-password recovery;
- email/SMS recovery protocols and throttling;
- verified email/SMS authorization of new devices;
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

## Phase relationship

**Phase 0 is complete after the cleanup verification passes. Stop here before Phase 8.**

Phase 8 remains not started until the product owner explicitly says **continue**. Its previously approved decisions and unresolved questions must be preserved rather than re-inferred.