# Health Hub project continuation context

This is the handoff entry point for a new chat or development session.

## Repository and working protocol

- Repository: `sorooshaghaei/health-hub`
- Working branch: one dedicated branch created from the current `main` for each approved product phase or design step.
- Merge into `main` only after validation and product-owner approval; keep the branch history small and reviewable.
- Clarify product/workflow changes with the product owner before implementing them.
- Do not re-ask decisions already explicit in the current product-phase or design-step specifications.
- Reconcile specification, implementation, tests, browser adapter, and handoff documentation together.
- Phase 8 and the approved release-readiness audit remediation are complete. The Phase 9 behavior is explicitly clarified and approved; implement its remaining parts without changing that contract unless the product owner approves a revision.

## Current phase status

Phases 0–8 have approved product contracts and are implemented on `main`. The approved release-readiness audit corrections are complete and were applied in separately validated parts with one commit per part.

- Phase 0 — Foundation: reconciled to the final permanent-role/global-device architecture.
- Phase 1 — Patient records: reconciled; metadata-backed international phone normalization complete.
- Phase 2 — Appointments: reconciled.
- Phase 3 — Check-in/live queue and clinic operational timezone: reconciled.
- Phase 4 — Room ready/consultation handoff: reconciled.
- Phase 5 — Completed consultation behavior: reconciled.
- Phase 6 — Shared tasks: reconciled to permanent account roles with membership-scoped attention state.
- Phase 7 — Private sticky: reconciled; minimized sticky never exposes private text.
- Phase 8 — Authentication/administration/security: implemented; approved release-readiness audit corrections and the rendered-browser gate are complete.
- Phase 9 — Secure Patient attachments: in progress; approved specification, backend foundation, and production Patient-profile interface complete; actual-file demo parity and final reconciliation pending.
- Phase 10 — Production infrastructure and security: not started.
- Phase 11 — Legal, privacy, and website completion: not started.
- Phase 12 — Final testing and stable production release: not started.

The post-Phase-8 usability corrections are named **Design Steps**, not phases:

- Design Steps 1–4 — complete and merged;
- Design Step 5 — weekly clinic working days/hours and optional Appointment-time suggestions; implemented, merged, and validated on `main`;
- Product Phase 9 remains separate from the Design Steps and is now in progress.

## Final identity architecture

### Personal account

`StaffUser` is one global personal identity.

Every account has one permanent role:

- `DOCTOR`; or
- `ASSISTANT`.

Role never changes. A person/account cannot be Doctor in one clinic and Assistant in another.

Personal/global data includes:

- first and last name;
- permanent role;
- unique email;
- unique phone;
- contact verification state;
- password;
- passkeys;
- trusted devices;
- sessions;
- Doctor recovery codes where applicable;
- one global private sticky;
- Assistant dormancy/anonymization state where applicable.

There is no username login and no shared clinic password.

### Clinic membership

`StaffMembership` links one global account to one clinic. It does not own Doctor/Assistant role.

Membership-specific data includes:

- clinic;
- active/inactive state;
- clinic-specific task-attention seen state;
- join time.

Both Doctor and Assistant accounts may have memberships in multiple clinics.

### Clinic ownership

Only Doctors create clinics.

Each clinic has one owning Doctor in the current scope and at most one active Assistant.

There is no Doctor ownership-transfer/replacement workflow in Phase 8.

### Workspace access

- Doctor account + active membership → Doctor workspace;
- Doctor account + active membership → Assistant workspace as administrator;
- Assistant account + active membership → Assistant workspace only.

Doctor defaults to Doctor workspace. Opening Assistant workspace does not change the Doctor's account role.

## Phase 8 authentication flows

### New Doctor

`Choose Doctor → create account → verify email → verify phone → create clinic → first browser trusted automatically → Doctor workspace`

Before a first clinic exists, Doctor and Assistant onboarding always provides
**Back to account** and **Sign out**. The app seeds an Account-settings history
entry before the clinic step, so the browser's first Back action remains inside
Health Hub. Assistant accounts with existing memberships also receive a
separate **Your clinics** action.

### New Assistant

`Choose Assistant → create account → verify email → verify phone → enter Doctor setup code → first browser trusted automatically → Assistant workspace`

Assistant setup code is one-time, case-insensitive, and valid for 24 hours. Its
plaintext is displayed only when created, alongside a copy control and the exact
expiry. Reopening Clinic team returns only active-code status and expiry.
Replacing an unclaimed code requires confirmation and invalidates the previous
code; replacing an assigned Assistant separately confirms the immediate
clinic-membership deactivation. Production and the Pages demo share this
lifecycle.

The claim operation is idempotent only for the same Assistant's already-active
membership, which makes an immediate submission retry enter the workspace
without duplicating membership state. The code remains unusable by a different
account. The setup-code screen always provides account and sign-out exits, and
provides the clinic picker when memberships already exist.

### Existing account on trusted browser

`Choose permanent role → email/phone + password or passkey → clinic`

- no second OTP on a trusted browser;
- exactly one clinic opens automatically;
- multiple clinics show clinic picker.

### Existing account on new browser

`Choose permanent role → sign in → choose verified email or SMS → one OTP → browser becomes globally trusted → clinic`

Both contacts were already verified during account onboarding, so one verified channel is sufficient for later device authorization.

## Trusted devices and sessions

Trusted devices belong to the personal account globally, not per clinic.

- one trusted browser works across all clinic memberships for that account;
- browser storage keeps the trusted-device credential separately for each account used in that browser;
- alternating Doctor and Assistant accounts selects the credential matching the entered role and identity rather than overwriting the other account's trust;
- successful credential reuse updates the matching device's last-used time without creating another record;
- current trusted device cannot be removed;
- other devices may be removed;
- removing another device ends sessions bound to it across all clinics;
- sign-out ends the current session but keeps device trust;
- untrusted global sessions cannot open clinic operational data or manage trusted devices.

Trusted-device-bound sessions require bearer token + proof of the exact account-scoped trusted device.

Default session policy:

- 12-hour absolute lifetime;
- 2-hour inactivity timeout;
- no Remember Me;
- browser close alone does not revoke a still-valid server session.

## Contact, password, passkey, and recovery rules

Both personal email and phone are mandatory and must be verified before clinic operational access. Personal phones require international input and are validated with country metadata before canonical E.164 storage. Patient phones retain the approved country selector, accept domestic or matching international input, and use the same metadata-backed E.164 normalization in production and demo paths.

OTP defaults:

- six digits;
- 10-minute lifetime;
- 60-second resend minimum;
- maximum five failed attempts.

Pending onboarding, new-device, contact-change, and password-change challenges are restored from server state after reload, including the authoritative resend window. Code confirmation remains disabled until all six digits are present. During new-account verification, staff may correct either contact with their current password; only the edited contact loses verification, its stale challenges are consumed, and Sign out remains available.

Email/phone changes require explicit fresh password or passkey reauthentication. Normal login does not count. Explicit reauth remains valid for 10 minutes by default. A pending replacement can be edited or explicitly cancelled; cancellation consumes the pending challenge without changing the verified contact.

Password change uses one verified email/SMS code, preserves current session, revokes other sessions, and does not remove device trust.

New-password pairs show Django-aligned requirements, live strength/match feedback, and accessible Show/Hide controls. A known requirement failure cannot be labelled **Strong**, and submission remains disabled until client-known requirements and the confirmation match pass. The backend also enforces that a password does not contain the account's name, email, or phone tokens.

The workspace Account menu supports Up/Down/Home/End navigation and Escape-to-trigger focus restoration. Routine Account settings are separated from permanent Doctor-account deletion in a nested Danger zone dialog. A shared topmost-dialog stack makes the app and parent dialogs inert, contains focus, applies Escape only to the active dialog, and restores focus to a connected visible opener.

After a successful Profile update, Account settings displays and politely announces **Profile saved.** beside the save action. Editing either name field or leaving the Profile section clears the confirmation so stale success is not presented as current state.

Working-day selectors, working-time inputs, Account settings tabs, and dialog close controls expose at least 44×44px interactive areas. Form controls remain at least 15px on desktop and 16px on compact/mobile layouts; secondary metadata may remain 12–14px. The weekly-hours rows keep their existing 62px density while their interactive children grow to the required target.

Release-facing UI copy follows the approved audit wording table. Role entry says **Sign in or create your Doctor/Assistant account.** Account-menu navigation uses **Account settings**; verification correction uses **Edit email address** and **Edit phone number**; optional Patient labels state **(optional)**; and the editable weekly schedule says **Set one working-hours range for each day the clinic is open.**

The Quality workflow includes a rendered Chromium release-smoke layer in addition to Node unit/contract tests, PostgreSQL-backed Django tests, and both frontend builds. The rendered layer covers challenge restoration after reload, alternating Doctor/Assistant trusted credentials, Account-menu Escape and nested-dialog focus containment/restoration, visible future-DOB rejection, and contextual task/comment/Undo names. Other product claims are not described as browser-validated unless a rendered test exercises them.

Forgotten-password recovery uses verified email/SMS and a 30-minute recovery grant.

Doctor recovery chooses one exclusive method: verified email/SMS or a Doctor offline code. Doctor accounts have ten one-time offline recovery codes; regeneration invalidates unused previous codes. Assistant recovery never offers the Doctor-only method and shows verified personal email/SMS only.

Passkeys are optional, maximum five, and may be used for sign-in or explicit sensitive-operation reauthentication.

Broader login/recovery/IP brute-force throttling is deferred to Phase 10.

## Assistant administration and lifecycle

A clinic Doctor controls only the Assistant's membership in that Doctor's clinic.

Doctor-facing actions are:

- **Remove Assistant from clinic**; and
- **Replace Assistant**.

There is no Doctor-facing Delete Assistant account action.

Removing/replacing an Assistant:

- deactivates only that clinic membership;
- immediately ends sessions using that membership;
- leaves the Assistant's global account intact;
- leaves memberships in other clinics intact;
- leaves password/email/phone/passkeys/trusted devices/private sticky intact;
- preserves historical authorship as former Assistant where relevant.

An existing Assistant can join another clinic using another Doctor setup code.

If an Assistant loses every personal recovery method, no Doctor receives a global recovery key. Each clinic Doctor independently replaces/removes that Assistant in their own clinic.

Assistants have no self-service account deletion.

When an Assistant has zero active clinic memberships, a two-year dormant clock begins. After two years, the cleanup service/command anonymizes personal/authentication data while retaining minimal non-login **Former Assistant** identity/history.

## Doctor account deletion

Doctor self-service account deletion is destructive and intentional.

It requires:

- current trusted browser;
- fresh password/passkey reauthentication;
- affected-clinic list/warning;
- typed `DELETE` confirmation;
- no five-second Undo.

Cascade:

1. delete all clinics owned by the Doctor;
2. delete those clinics' operational data through clinic cascades;
3. remove memberships tied to those clinics;
4. preserve other people's global accounts;
5. start dormancy for affected Assistants who now have zero active memberships;
6. delete the Doctor global account.

Clinics are deleted before the Doctor row so protected historical task author references do not block the intentional cascade.

## Clinic operational timezone

Each clinic stores one IANA operational timezone captured from the creating browser during normal clinic creation.

It determines:

- operational **today**;
- today's Appointment list;
- check-in eligibility;
- live queue membership;
- Room-ready/consultation day boundaries.

A travelling browser does not change the clinic's operational day.

## Operational workflow baseline

### Patients

- clinic-scoped reusable Patient records;
- full name, `Man`/`Woman`, country/phone, optional DOB limited to clinic today or earlier, optional shared Patient note;
- automatic search + one duplicate warning;
- long Patient names in Appointment search, daily lists, and queues wrap to two visible lines before truncation, retain their complete assistive text, and expose the full value on hover;
- Doctor workspace may edit;
- Assistant workspace may create/edit/delete;
- Doctor in Assistant workspace gets Assistant-side administrator controls;
- current/future Appointments block Patient deletion;
- Patient deletion uses the shared alert dialog, keeps blocking errors inside that confirmation, and returns focus to the delete trigger or Patient search after the dialog closes;
- eligible deletion has five-second Undo.

### Appointments

- Patient, date, scheduled time, optional reason;
- new Appointment creation searches the active clinic's Patients first; the complete new-Patient form appears only after **Create new patient** is chosen;
- daily Appointment rows show workflow status once in the status chip and do not repeat it beneath the scheduled time;
- one active Appointment maximum per Patient per clinic date;
- no walk-in type; unplanned arrival = normal same-day Appointment then check-in;
- Patient/date lock after check-in;
- scheduled time/reason remain correctable;
- eligible deletion has five-second Undo.

Design Step 5 adds a **Today** shortcut and optional 15-minute time suggestions derived from the selected clinic's weekly working hours. Manual time entry remains available and unrestricted. The complete approved contract is in [`DESIGN_STEP_5_WORKING_HOURS.md`](DESIGN_STEP_5_WORKING_HOURS.md).

### Queue

```text
PLANNED → CHECKED_IN
```

- clinic-today only;
- queue order is original persisted check-in sequence;
- check-in times add seconds only for active queue arrivals sharing the same minute, without changing the authoritative sequence;
- the empty live queue uses compact content padding without a forced minimum height;
- Assistant queue shows phone; Doctor queue omits it;
- check-in has five-second Undo;
- three-second polling;
- compact New Task dialog with focus management, complete Open/History tab semantics, and task-contextual comment fields;
- repeated Undo, task, and comment controls have action/resource-specific accessible names while preserving short visible labels.

### Consultation

```text
CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

- Room ready = Doctor account in Doctor workspace only;
- with a current Patient, the action reads **Complete Patient and signal room ready** and explains both consequences before submission;
- With doctor = Assistant workspace, including Doctor administrator access;
- one pending room call per clinic;
- five-second Undo before Assistant notification;
- one short sound + persistent visual after expiry;
- first waiting Patient suggested but any checked-in Patient may be sent;
- With doctor five-second Undo preserves queue sequence;
- three-second polling.

### Completion

`DOCTOR_FINISHED` displays as **Completed** and is final.

No Checkout state/action exists. Completion feedback retains the Patient identity; five-second Room-ready Undo names and reverses both that completion and the pending room call.

### Shared tasks

```text
OPEN → DONE
```

- clinic-scoped Doctor-to-Assistant work;
- Doctor account can author in either Doctor or Assistant administrator workspace;
- Assistant cannot create/edit/delete tasks;
- creator-only task editing; Doctor clinic task deletion;
- both may mark Done; five-second Undo; no permanent Reopen;
- attention state is per clinic membership;
- optional date-only due date and optional same-clinic Patient link;
- both may comment; only personal author edits/deletes own comment;
- former Assistant attribution preserved;
- task/comment delete five-second Undo;
- red attention dot only; no general task notification system;
- repeated task/comment actions and Undo notifications expose resource-specific accessible names;
- existing-task editing replaces that card's normal details and action/comment controls until Save or Cancel, then updates the same task identity;
- three-second polling.

### Private sticky

- one global plain-text sticky per personal account;
- follows account across clinics;
- visible only when workspace matches permanent account role;
- Doctor in Assistant administrator workspace gets no sticky;
- minimized strip always says **Private note**, never content;
- autosave with Saving/Saved feedback; no title/multiple notes/history/attachments/etc.;
- pointer and arrow-key movement/resizing for the nonessential desktop layout, constrained inside edge margins below the workspace header and above the Undo lane, with no Reset control;
- the sticky remains below workspace menus, dialogs, and the bottom-right Undo notification lane;
- layout state not server-persisted.

## Browser demo invariant

GitHub Pages is only the product-owner review demo. It uses the same production React product UI, while `VITE_DEMO_API=true` substitutes a browser-local API/storage adapter only.

The adapter mirrors product-level permanent roles, global trusted-device simulation, clinic ownership/memberships, setup codes, Assistant replacement, and Doctor account cascade.

Phase 9 demo parity is not complete yet. Demo builds temporarily withhold the attachment area rather than expose broken requests or prohibited metadata-only behavior. Part 3 must remove that guard, use the same production React attachment interface, and retain actual browser-local file bytes in IndexedDB.

It does not claim real security infrastructure. Real Patient information must never be entered into the public demo.

## Production deployment and data boundaries

- Intended production use may include clinics in France and Iran with real Patient and clinic data.
- Health Hub remains one product and one codebase.
- The starting architecture is shared, securely tenant-scoped storage: records may share PostgreSQL tables and file-storage infrastructure, but every access must be restricted to the authorized clinic and Patient.
- Do not assume one database per user, clinic, or country.
- Keep the storage provider and region configurable. Separate regional database/file-storage environments are introduced only if confirmed legal, regulatory, provider, availability, or operational requirements justify them.
- Terms, privacy information, consent where applicable, and cookie choices are separate from technical data security; they do not replace access control, encryption, backups, or auditing.
- Every product, security, legal, and cookie behavior must be clarified against the finished system before implementation rather than added speculatively.

Phase boundaries:

- Phase 9 builds secure Patient attachments without choosing a country-specific hosting structure.
- Phase 10 chooses and hardens the real production environment: hosting and data-location requirements for France and Iran, managed PostgreSQL, private file storage, encryption, secrets, backups and restoration tests, audit/logging, monitoring, retention operations, communication providers, and incident/recovery operations.
- Phase 11 completes terms and conditions, privacy information, user acceptance, Patient-data information or consent responsibilities where applicable, the actual cookie inventory and only the notice/settings/consent that inventory requires, and remaining small production website details.
- Phase 12 performs final end-to-end testing and produces the stable production release.

## Key migrations / maintenance

- `accounts.0008_clinic_timezone` — clinic operational timezone.
- `accounts.0009_final_phase8_identity` — permanent account roles, explicit clinic ownership, global trusted devices, Assistant dormancy/anonymization fields, removal of persisted membership role.
- `accounts.0010_clinic_working_hours` — one clinic-scoped start/end range per enabled weekday.
- `accounts.0011_trusted_device_last_used_at` — trusted-device last-used tracking and recency ordering.
- `attachments.0001_initial` — clinic- and Patient-scoped private attachment metadata, immutable original filenames, source-content hashes, uploader attribution, and five-second soft-delete state.
- `python manage.py cleanup_dormant_assistants` — anonymizes eligible zero-membership Assistants after the two-year retention period; production scheduling belongs to deployment/operations.
- `python manage.py cleanup_deleted_attachments` — permanently deletes expired attachment rows and stored objects; attachment APIs also purge opportunistically, while production scheduling belongs to Phase 10 operations.

## Phase specifications

- [`PHASE_0_FOUNDATION.md`](PHASE_0_FOUNDATION.md)
- [`PHASE_1_PATIENT_RECORDS.md`](PHASE_1_PATIENT_RECORDS.md)
- [`PHASE_2_VISITS.md`](PHASE_2_VISITS.md)
- [`PHASE_3_QUEUE.md`](PHASE_3_QUEUE.md)
- [`PHASE_4_CONSULTATION.md`](PHASE_4_CONSULTATION.md)
- [`PHASE_5_COMPLETION.md`](PHASE_5_COMPLETION.md)
- [`PHASE_6_SHARED_TASKS.md`](PHASE_6_SHARED_TASKS.md)
- [`PHASE_7_PRIVATE_NOTES.md`](PHASE_7_PRIVATE_NOTES.md)
- [`PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](PHASE_8_AUTHENTICATION_ADMINISTRATION.md)
- [`PHASE_9_PATIENT_ATTACHMENTS.md`](PHASE_9_PATIENT_ATTACHMENTS.md)

## Design-step specifications

- [`DESIGN_STEP_5_WORKING_HOURS.md`](DESIGN_STEP_5_WORKING_HOURS.md)

## Next action

Continue Product Phase 9 one approved part at a time. Parts 1–2 are complete; Part 3 is actual-file GitHub Pages demo parity through IndexedDB. Do not start a later part before the current part is validated, committed, and explicitly continued by the product owner.
