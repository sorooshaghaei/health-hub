# Phase 8 — Authentication, account administration, and security

## Status

**Implemented on `main`. Rendered-browser validation is limited to the explicit release-smoke paths recorded in the project context and Quality workflow.**

Phase 8 defines the final staff identity and authentication architecture for Health Hub. It supersedes earlier temporary assumptions that role belonged to a clinic membership or that trusted devices belonged to individual clinics.

The central rule is simple: **a person has one global Health Hub account with one permanent role, and clinic memberships only determine which clinics that account may enter.**

## Final identity model

`StaffUser` is the global personal identity.

Every account has exactly one permanent role:

- `DOCTOR`; or
- `ASSISTANT`.

A Doctor account never becomes an Assistant account. An Assistant account never becomes a Doctor account. The same person/account therefore cannot be Doctor in one clinic and Assistant in another.

Personal account data follows the person across every clinic:

- first and last name;
- permanent account role;
- unique email;
- unique phone;
- email/phone verification state;
- password;
- passkeys;
- trusted devices;
- account sessions;
- private sticky;
- Doctor offline recovery codes where applicable.

`StaffMembership` is only the relationship between one personal account and one clinic. It stores:

- user;
- clinic;
- active/inactive state;
- clinic-specific task-attention seen state;
- join time.

Role authorization is derived from `StaffUser.role`, not from a membership role column.

Both Doctors and Assistants may belong to multiple clinics.

## Clinic ownership and staffing

Only a Doctor account can create a clinic.

Each clinic has one owning Doctor. The owning Doctor has an active clinic membership and is the clinic administrator.

For the current product scope, a clinic has at most:

- one active Doctor owner; and
- one active Assistant.

There is no Doctor ownership-transfer or Doctor-replacement workflow in Phase 8.

Doctor ownership is distinct from workspace selection. A Doctor remains a Doctor even when opening the Assistant workspace as administrator.

## Workspace authorization

Allowed workspaces are:

- Doctor account → Doctor workspace;
- Doctor account → Assistant workspace as administrator;
- Assistant account → Assistant workspace only.

An Assistant account cannot open the Doctor workspace.

The Doctor workspace is the default after a Doctor enters a clinic. Switching to the Assistant workspace is an in-session workspace switch, not another sign-in and not a role change.

The private sticky remains visible only when the workspace matches the person's permanent account role:

- Doctor in Doctor workspace → own private sticky;
- Assistant in Assistant workspace → own private sticky;
- Doctor in Assistant administrator workspace → no private sticky.

## First screen and role selection

The first account screen is intentionally simple:

1. choose **Doctor** or **Assistant**;
2. choose **Sign in** or **Create account** for that permanent role.

The chosen role is part of authentication. A Doctor account presented as Assistant, or an Assistant account presented as Doctor, is rejected rather than silently redirected to another role.

## Phase 8 UI invariants

Authentication and account-administration controls use the shared UI components rather than browser-default form controls.

- **Back** is the only absolutely positioned authentication navigation control.
- Role entry uses **Sign in or create your Doctor/Assistant account.** The sign-in choice explains **Use your email address or phone number with a password, or use a passkey.** Registration says **Verify both your personal email address and phone number before accessing a clinic.**
- **Forgot password?** appears only on the actual sign-in form. It is a normal text link and never reuses `.back-button`.
- Recovery uses mutually exclusive radio cards for verified email/SMS versus a Doctor offline code, followed by the shared select-field control where applicable.
- On screens up to 900px wide, the large desktop authentication introduction collapses to a compact roughly 100–140px header. The current screen title remains visible; the long decorative description is hidden.
- Workspace headers use one account menu at every width for Clinics, Account settings, Clinic team, trusted devices, and Sign out. The trigger exposes menu state, Up/Down/Home/End move through its actions, outside activation closes it, and Escape closes it and returns focus to the visible Account trigger. This avoids duplicating the same action components in separate desktop and mobile trees.
- The workspace menu item is labelled **Account settings**. Pending onboarding verification uses **Edit email address** and **Edit phone number** for contact correction.
- The Doctor/Assistant workspace switch remains directly visible. At widths up to 1200px the secondary clinic/workspace context collapses, leaving the brand, workspace switch when applicable, and account trigger.
- The clinic name appears once in the wide header and in the account-menu identity. It is not repeated beside the page title with an unlabeled status dot.
- Doctor access to the Assistant workspace has a persistent **Viewing Assistant workspace as Doctor administrator** banner and a direct **Return to Doctor workspace** action.
- Account settings keeps routine Profile, Security, Passkeys, and Recovery sections together. Permanent Doctor-account deletion is isolated in a visually distinct Danger zone and opens a nested final-review dialog while Account settings remains mounted beneath it.
- A successful Profile update displays **Profile saved.** beside its save action and announces that confirmation through a polite status region. Editing the profile or leaving its section clears the prior confirmation.
- Account settings tabs and dialog close controls expose at least 44×44px interactive areas. Settings-tab text is at least 15px, while form inputs remain at least 15px on desktop and 16px on compact/mobile layouts.
- Account, trusted-device, clinic-team, task-creation, Patient-deletion, and consultation-detail dialogs share a topmost-dialog stack. The app and any parent dialog become inert and hidden from assistive technology, focus enters and remains in the top dialog, Escape affects only that dialog when closing is allowed, and closing restores focus to a connected visible opener. Visual × controls have contextual accessible names.

These are shared production/Pages UI rules; the browser demo must not maintain a separate layout.

## New Doctor onboarding

The new-Doctor sequence is:

1. choose Doctor;
2. create the personal Doctor account;
3. verify personal email;
4. verify personal phone;
5. create the clinic with its clinic name;
6. make the current browser the account's first trusted device automatically;
7. create the Doctor's clinic membership and ownership;
8. enter the Doctor workspace.

Both contact verifications are mandatory before clinic creation and operational data access.

The first trusted-device creation is automatic because the person has just completed the new-account verification flow and has no older trusted device to distinguish from the current browser.

Until the first clinic is created, the clinic-creation screen always exposes
**Back to account** and **Sign out**. Health Hub also seeds an app-owned account
history entry before showing this screen, so the browser's first Back action
returns to Account settings rather than immediately navigating away from the
application.

## New Assistant onboarding

The new-Assistant sequence is:

1. choose Assistant;
2. create the personal Assistant account;
3. verify personal email;
4. verify personal phone;
5. enter a one-time setup code created by the clinic Doctor;
6. make the current browser the account's first trusted device automatically;
7. create the Assistant's clinic membership;
8. enter the Assistant workspace.

Only a Doctor can create a clinic. An Assistant joins an existing clinic.

Assistant setup codes are:

- one-time use;
- valid for 24 hours by default;
- tied to one clinic;
- accepted without regard to letter case;
- not global account recovery credentials.

The Doctor sees a new setup code's plaintext only in the response that creates
it. Clinic team provides a copy control and displays the exact expiry date and
time. After the dialog is closed or the page is reloaded, the server returns
only whether an active code exists and its expiry; it never returns the
plaintext again. The Doctor can choose **Replace setup code**, confirm that the
current unclaimed code will be invalidated immediately, and receive a new
one-time plaintext value. Replacing a currently assigned Assistant also
requires confirmation because that action immediately deactivates the existing
clinic membership. Production and the Pages demo follow the same lifecycle.

Claiming is idempotent for the Assistant who successfully filled the slot. An
immediate retry of the same submitted code returns that existing active
membership and re-enters the Assistant workspace instead of returning a
conflict or creating a duplicate membership. The used code remains invalid for
every other account and cannot reactivate a membership after the Assistant is
removed from the clinic.

The join form prevents duplicate submission while a claim is pending. It also
always exposes **Back to account** and **Sign out**. **Your clinics** is exposed
when the Assistant already has at least one membership, so a valid global
account is never trapped on the setup-code screen. These actions wrap with
separate touch targets, and first-clinic onboarding uses the same app-owned
browser-history fallback as Doctor onboarding.

## Existing account on a trusted browser

The existing-account flow on an already trusted browser is:

1. choose Doctor or Assistant;
2. sign in with personal email or phone plus password, or a registered passkey;
3. if there is one active clinic membership, open it directly;
4. if there are multiple active clinic memberships, choose a clinic;
5. enter the account's default workspace for that clinic.

There is no second OTP merely for normal sign-in on a browser that is already trusted for that account.

The server still requires both personal contacts to have been verified before clinic operational data may open.

## Existing account on a new or untrusted browser

The flow on a browser that is not trusted for that personal account is:

1. choose the permanent account role;
2. sign in with email or phone plus password, or passkey;
3. choose verified email or verified SMS;
4. receive one six-digit device-authorization code;
5. verify that code;
6. make the browser a trusted device for the personal account;
7. choose/open a clinic membership.

Only one of the already verified contact channels is needed for new-device authorization. Both contacts were already verified during account setup.

## Global trusted devices

Trusted devices belong to the personal account globally, not to a clinic.

Once a browser is trusted for an account, that browser may be used with every active clinic membership belonging to that same account. Switching clinics does not require another device OTP.

One physical browser may be trusted for more than one personal account. Browser storage retains each account's credential separately and selects it from the entered permanent role plus email/phone identity during sign-in. Alternating a Doctor account and an Assistant account therefore does not overwrite either account's trust. Successful reuse updates the matching trusted-device record's last-used time and does not create a duplicate record.

Trusted-device management is also global:

- list the account's trusted devices;
- identify the current trusted device;
- the current trusted device cannot be removed;
- another trusted device can be removed;
- removing another device ends sessions bound to that device across all clinics;
- sign-out ends only the session and does not remove device trust.

A session bound to a trusted device requires proof of that exact device through the account-scoped trusted-device token/cookie. A copied bearer token alone is not sufficient for a trusted-device-bound session.

An untrusted global session may exist temporarily for contact verification or new-device authorization, but it cannot open clinic operational data or manage trusted devices.

## Contact verification

Personal email and phone are both required for new staff accounts.

Personal phone fields require full international input and use libphonenumber metadata for validation. Formatting characters and a leading `00` international prefix are accepted; the stored account value is canonical E.164. The production backend is authoritative, and the frontend applies the same normalization before account registration or phone replacement.

Both must be verified before clinic operational data may open.

Verification-code defaults are:

- six digits;
- 10-minute lifetime;
- minimum 60 seconds between resend requests;
- maximum five failed attempts.

After a code is sent, the interface displays the remaining resend delay and enables **Resend code** when the server-provided window reaches zero. Authenticated onboarding, new-device authorization, contact-change, and password-change screens restore an unexpired pending challenge and its server-derived resend window after reload. Code confirmation remains disabled until the complete six-digit value is present. The person may return to change the email, phone, channel, or recovery method without being forced to complete a stale code flow.

The new-account verification screen always provides **Edit email**, **Edit phone**, and **Sign out**. Correcting a contact requires the current password, consumes outstanding verification/change challenges for that contact, and clears only that contact's verification timestamp. The other contact's verification state is preserved. Once both contacts are verified, later contact replacement uses Account settings and the normal sensitive-operation flow.

Verification code material is stored as keyed hashes rather than plaintext in the production backend.

Email delivery uses Django email infrastructure. SMS delivery is supplied through the configured `SMS_SENDER`; production does not pretend a text message was delivered when no provider is configured.

## Sessions

Default staff-session policy remains:

- 12-hour absolute maximum lifetime;
- 2-hour inactivity timeout;
- no Remember Me option;
- closing the browser does not itself revoke a server session;
- explicit sign-out revokes the current session;
- sign-out does not remove trusted-device authorization.

A clinic session contains the selected membership and workspace. Leaving/switching clinic clears the clinic/workspace selection while preserving the trusted-device relationship for that personal account.

## Sensitive-operation reauthentication

Ordinary account sign-in does **not** count as sensitive-operation reauthentication.

Changing personal email or phone requires an explicit fresh reauthentication by either:

- current password; or
- a registered passkey.

A successful explicit reauthentication remains valid for 10 minutes by default so the person can complete the contact-change flow without repeated prompts.

The new email/phone value must then be verified before it replaces the old value. Account settings restores the pending replacement after reload and shows the pending value. The person may edit it or explicitly cancel it. Cancellation consumes the pending challenge, clears the draft/code/countdown in the interface, and leaves the verified contact unchanged. The former verified contact receives a best-effort security notice after a completed change.

Because contact data belongs to the global personal account, the changed value applies across every clinic membership.

## Password changes

A normal signed-in password change is confirmed using one verified personal contact channel.

The person chooses verified email or verified SMS, verifies the code, and supplies a new password that passes Django password validation.

New-password forms show the active requirements before submission, update requirement and strength feedback while the person types, confirm whether both entries match, and provide an accessible **Show/Hide** control for each password field. A password with any client-known displayed requirement failure is labelled **Invalid**, never **Strong**. Password submission remains disabled until the client-known checks and confirmation match pass. The production backend remains authoritative for minimum length, common-password, and entirely-numeric checks and also rejects passwords containing the account's name, email, or phone tokens.

Successful password change:

- preserves the current session;
- revokes the person's other sessions;
- leaves trusted-device records intact.

Account/security operations do not use the five-second operational Undo mechanism.

## Forgotten-password recovery

Normal forgotten-password recovery is personal and global.

The person chooses verified email or verified SMS. Public recovery requests use a generic response so normal API responses do not disclose whether an account exists.

For a Doctor route, the recovery form presents mutually exclusive **Email or SMS** and **Doctor offline code** methods as radio cards. An Assistant route does not render the Doctor-only choice and uses verified personal email/SMS only. The contact-code path provides the same resend countdown plus a **Change email, phone, or method** action.

A verified recovery code creates a short-lived recovery grant, valid for 30 minutes by default. A newer grant invalidates older outstanding grants.

Successful reset:

- validates and replaces the password;
- consumes the grant;
- revokes all sessions belonging to the account;
- leaves trusted-device records intact.

A clinic Doctor may trigger normal recovery instructions to the active Assistant's own verified email/SMS as a convenience. The Doctor never receives the recovery code and never gains authority over the Assistant's global credentials.

## Doctor offline recovery codes

Doctor accounts have an additional offline recovery mechanism:

- ten codes are generated per set;
- each code is one-time use;
- generating a new set invalidates every unused code from the previous set;
- stored code values use password hashing;
- the plaintext list is returned only when a new set is generated;
- the codes recover only that Doctor's global account.

Assistant accounts do not receive Doctor offline recovery codes.

## Passkeys

Passkeys are optional; password sign-in remains available.

A verified account may register up to five passkeys. WebAuthn registration/authentication challenges are server-created, short-lived, and single-use.

Passkeys can be used for:

- normal sign-in; and
- explicit sensitive-operation reauthentication.

Removing a passkey requires either:

- current password; or
- recent explicit reauthentication using a different passkey.

Normal passkey sign-in, like normal password sign-in, does not silently satisfy later sensitive-operation reauthentication.

## Assistant membership administration

The clinic Doctor controls the Assistant membership in that clinic. The Doctor does **not** own or delete the Assistant's global personal account.

Doctor-facing actions use the terms:

- **Remove Assistant from clinic**; and
- **Replace Assistant**.

There is no Doctor-facing **Delete Assistant account** action.

Removing an Assistant from one clinic:

1. deactivates that clinic membership;
2. immediately ends sessions using that membership;
3. preserves the Assistant's global account;
4. preserves the Assistant's other clinic memberships;
5. preserves personal email, phone, password, passkeys, trusted devices, and private sticky;
6. preserves historical clinic authorship through the inactive membership/person record.

Replacing an Assistant performs the same clinic-only deactivation and then generates a fresh one-time setup code for the replacement.

An existing Assistant account can use a new Doctor setup code to join an additional clinic. A second personal account is not required.

## Assistant with no remaining recovery method

There is no Doctor-generated emergency credential that can reset an Assistant's global account.

If an Assistant loses access to all personal recovery methods—password, verified contacts, passkeys, and any other usable personal recovery path—the old global account is considered inaccessible.

Each clinic Doctor independently replaces/removes that Assistant's membership in the Doctor's own clinic. One Doctor cannot reset credentials or gain access to the Assistant's work in another clinic.

This avoids giving one employer control over a global account that may be connected to several unrelated clinics.

## Dormant Assistant lifecycle

Assistants do not have a self-service **Delete account** option.

When an Assistant reaches **zero active clinic memberships**, `dormant_since` begins.

If an Assistant later rejoins a clinic before cleanup, the dormant state is cleared and the same personal account continues.

After two years with zero active memberships, the dormant-account cleanup process anonymizes/removes personal and authentication data while keeping the minimal non-login historical identity needed for clinic history.

Cleanup removes or invalidates personal/authentication material including:

- personal email and phone;
- verification state;
- usable password;
- passkeys;
- trusted devices;
- active sessions;
- verification/recovery artifacts;
- private sticky;
- personal first/last name.

The retained historical representation is non-login and displays as **Former Assistant**. Inactive membership rows remain available for historical attribution.

The cleanup is implemented as an idempotent backend service plus the `cleanup_dormant_assistants` management command. Production scheduling of that command belongs to deployment/operations configuration.

## Doctor account deletion

Only Doctor accounts have the destructive self-service account-deletion operation.

Before deletion, the UI/API identifies all clinics owned by that Doctor.

The destructive flow is not an ordinary Account settings tab. Account settings opens a nested **Danger zone** review dialog so routine profile/security work and permanent deletion cannot be confused. Account settings remains mounted but inert beneath the review; closing the review returns focus to **Review account deletion**, while closing Account settings returns focus to the visible workspace Account trigger.

Deletion requires:

- a currently trusted browser;
- explicit fresh password/passkey reauthentication;
- an explicit destructive warning;
- the affected clinic list;
- typed confirmation `DELETE`;
- no five-second Undo.

Deleting the Doctor account intentionally performs this cascade:

1. delete every clinic owned by that Doctor;
2. delete those clinics' Patient, Appointment, queue, room-call, task, and other clinic-owned operational data through normal database cascades;
3. remove memberships attached to those deleted clinics;
4. preserve other people's global personal accounts;
5. if an affected Assistant now has zero active clinic memberships, start that Assistant's two-year dormant period;
6. delete the Doctor's global account and its personal authentication/security data.

Clinics are deleted before the Doctor row so Doctor-authored clinic history with protected author references cannot block the intentional destructive account cascade.

## Shared tasks and historical attribution

Task data remains strictly clinic-scoped.

Doctor task-authoring authorization comes from the permanent Doctor account role plus an active membership in the current clinic. A Doctor keeps task-authoring authority while using the Assistant workspace as administrator.

Task-attention seen state remains clinic-membership-scoped so viewing Tasks in one clinic does not clear another clinic's attention state.

Historical task/comment authorship remains attached to the original person. If that person's membership in the clinic is inactive, Assistant attribution may display as **Former Assistant**. After dormant-account anonymization, the minimal retained identity continues to display **Former Assistant**.

## Clinic operational isolation

The Phase 8 identity changes do not weaken tenant isolation.

Patient, Appointment, queue, room-call, shared-task, task-attention, and other operational queries still resolve through the active clinic membership. The clinic operational timezone continues to determine the clinic day.

Global identity means the same person can enter several clinics; it does not merge those clinics' medical/workflow data.

## Browser demo parity

GitHub Pages renders the same production React application and Phase 8 screens. It must not maintain a separate product/login UI.

The demo uses `VITE_DEMO_API=true` to replace only the backend transport with a browser-local adapter. The adapter mirrors the product-level Phase 8 model:

- permanent Doctor/Assistant account roles;
- both-contact onboarding;
- Doctor clinic ownership;
- Assistant setup-code membership;
- 24-hour setup-code validity;
- global trusted-device simulation;
- separate browser credentials for each simulated account and last-used updates on reuse;
- role-correct recovery choices;
- pending challenge restoration and resend timing;
- contact-replacement cancellation;
- displayed password-rule enforcement;
- clinic selection and workspace authorization;
- clinic-only Assistant removal/replacement;
- Doctor destructive account cascade;
- role-specific recovery behavior.

The demo does not claim to reproduce real security infrastructure. Browser-local verification codes and trusted-device records are demonstration state, not production security. Real WebAuthn passkeys are not fabricated by the browser adapter.

## Migrations and compatibility

`accounts.0006_phase8_global_accounts` introduced the earlier global-account/membership foundation.

`accounts.0009_final_phase8_identity` completes the approved model by:

- adding the permanent `StaffUser.role`;
- adding Assistant dormancy/anonymization fields;
- adding explicit clinic Doctor ownership;
- migrating trusted devices from clinic scope to personal-account scope;
- moving device-pairing requests to personal-account scope;
- migrating existing membership roles into permanent account roles;
- removing the persisted `StaffMembership.role` field;
- removing the persisted clinic relation from trusted devices;
- making normal session creation no longer imply sensitive reauthentication.

`StaffMembership.role` may remain as a compatibility property for historical tests/code, but it derives from `StaffUser.role` and is not a database role assignment.

The custom test runner translates older Phase 1–7 fixture syntax only while running tests. It does not restore username login, membership-owned roles, or clinic-scoped trusted devices to production APIs.

## Explicitly not added

Phase 8 does not add:

- shared clinic passwords;
- username login;
- mutable account roles;
- a person who is Doctor in one clinic and Assistant in another;
- Assistant self-service account deletion;
- Doctor control over an Assistant's global credentials;
- Doctor emergency global Assistant recovery keys;
- Doctor ownership transfer;
- clinic-scoped trusted-device authorization;
- security-operation five-second Undo;
- email/SMS/OS notifications unrelated to the approved security flows;
- production brute-force/IP throttling beyond the verification-code limits.

Broader login/recovery/IP throttling belongs to Phase 10 production hardening.

## Next phase boundary

Phase 8 ends with this account/security contract and its implementation. Stop before Phase 9.

Phase 9 concerns sensitive attachment architecture and must be clarified before implementation.
