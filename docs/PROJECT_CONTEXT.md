# Health Hub project continuation context

This file is the handoff entry point for a new chat or development session.

## Repository and workflow

- Repository: `sorooshaghaei/health-hub`
- Working branch: `main`
- Work directly on `main`; do not create branches or pull requests unless explicitly instructed.
- Implement one approved phase or corrective pass at a time.
- Ask before choosing an unapproved field, state, screen, action, permission, algorithm, dependency, or workflow.
- Update documentation, validate, commit, report, and stop after each phase/corrective pass.
- Continue only after the product owner explicitly says **continue**.

## Product baseline

Health Hub is a deliberately simple clinic workflow application with Doctor and Assistant roles. It uses React/Vite, Django REST Framework, and PostgreSQL. The public Pages build uses the same React frontend with a browser-only adapter and is not medical-data storage.

## Account and workspace rule

Account identity and active workspace are separate:

- Doctor credentials can open Doctor workspace;
- Doctor credentials can open Assistant workspace for full administrator intervention;
- Assistant credentials can open Assistant workspace;
- Assistant credentials cannot open Doctor workspace.

Doctor workspace owns Room ready and otherwise stays clinically focused. It may view and edit every approved Patient field, but it cannot create/delete Patients or administer Appointments. Assistant workspace owns full Patient and Appointment administration, check-in, queue, and Patient-to-room actions. A Doctor account inside Assistant workspace receives exactly the same administrative controls as the Assistant for those workflows.

Phase 6 task authoring permissions are based on account identity rather than workspace: the Doctor account may create/edit/delete Doctor-to-Assistant tasks even when the Doctor is using Assistant workspace; the Assistant account cannot author tasks.

Phase 7 private sticky access requires account identity to match the active workspace. The Doctor sees the Doctor sticky only in Doctor workspace. The Assistant sees the Assistant sticky only in Assistant workspace. Doctor credentials inside Assistant workspace see neither private sticky.

## Authentication foundation — implemented Phase 0 correction

The shared clinic-password boundary has been removed from the implemented application.

The current Phase 0 authentication foundation is:

- the clinic remains the tenant/container for clinic data;
- a browser must be trusted for that clinic before normal clinic access;
- the first browser is automatically trusted when a new clinic is created, with explanatory UI so the Doctor cannot accidentally create a clinic and immediately lose access;
- additional browsers display a six-digit pairing code that is approved by a signed-in Doctor or Assistant from an already trusted clinic device;
- pairing requests are short-lived and no clinic/Patient data is exposed to the requesting browser before approval;
- trusted devices remain trusted until explicitly revoked;
- both Doctor and Assistant may open a simple device list and remove trusted devices;
- device rows show browser + operating system, added date, and **Current device** when applicable;
- the last remaining trusted device cannot be removed until another device has been paired, preventing lockout before Phase 8 recovery channels exist;
- trusted-device authorization is separate from individual staff sessions;
- staff sessions are bound to the trusted device that created them, so removing a device ends sessions from that device;
- signing out ends only the staff session and does not untrust the browser;
- the Doctor/Assistant role-selection step remains;
- Phase 0 still uses individual username + password staff login;
- clearing browser storage, changing browser, reinstalling the browser, or changing computers requires device authorization again;
- `/api/clinics/enter/` and the shared clinic-password flow are removed;
- production frontend device requests use `X-Device-Token`; the obsolete `X-Clinic-Token` and `clinic_access_token` aliases have been removed from active code and tests;
- migration `accounts.0005_trusted_device_auth` deliberately resets incompatible pre-release clinic/authentication data, removes `Clinic.password_hash`, and introduces trusted-device/pairing data;
- the GitHub Pages demo keeps the same frontend/browser adapter but bypasses real trusted-device authority and contains no clinic password or clinic-access credential.

The Phase 0 correction and cleanup were validated in GitHub Actions: frontend tests/builds, Django checks, committed-migration verification, PostgreSQL migration application, the full backend test suite, and the final Pages deployment all passed. Historical Django migrations remain intact, while intentional regression validation still confirms that the removed clinic-entry route is absent and obsolete `visit_type` payloads are rejected.

Recovery, verified email/SMS authorization, offline codes, passkey policy/management, Assistant reset/replacement, multi-clinic Doctor identity, detailed session/security policy, and the other previously discussed decisions remain preserved for **Phase 8**.

See:

- [`PHASE_0_FOUNDATION.md`](PHASE_0_FOUNDATION.md)
- [`PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](PHASE_8_AUTHENTICATION_ADMINISTRATION.md)

## Implemented workflow

### Patients

- reusable Patient profile;
- full name, `Man`/`Woman`, country/calling code, phone, optional date of birth, optional shared Patient note;
- Iran `+98` default;
- compact flag-and-country selector with the selected calling code beside a large national-number input; on mobile the country row sits above the code-and-number row;
- one combined phone display in the Patient profile; no separate Country code or National number cards;
- search by name, phone, or date of birth updates automatically while typing;
- Doctor workspace may edit every Patient field;
- Patient creation and deletion remain Assistant-workspace actions;
- one Possible duplicate patient warning;
- internal soft deletion;
- current/future Appointments block deletion;
- five-second Patient deletion Undo;
- Role boundary and Individual access cards are removed;
- the separate Leave clinic card/action is removed; staff use the top Sign out control to leave or switch accounts.

### Appointments

- Patient, date, scheduled time, optional reason;
- one Appointment type for every clinic attendance;
- a Patient may have Appointments on different dates but only one active Appointment per clinic date;
- duplicate create/edit returns the existing Appointment with **Open appointment** rather than an override;
- a just-deleted Appointment reserves its Patient/date during the five-second Undo period;
- after Undo expiry, a replacement Appointment may be created;
- database uniqueness, API validation, and browser-demo validation enforce the same rule;
- migration never silently deletes or merges existing duplicates and stops for manual resolution if needed;
- a Patient arriving without an Appointment for today receives a normal same-day Appointment, whose frontend time defaults to current time, then check-in;
- Patient-first Appointment create/edit form: after two typed name characters, existing Patients are suggested in a floating list; selecting one collapses to a compact card, otherwise the same form continues as new-Patient creation;
- past and future history inside Patient profile;
- current/future Appointment deletion before consultation with five-second Undo;
- Appointment create/edit/delete controls are present in Assistant workspace, including when opened by the Doctor administrator;
- Doctor workspace does not expose Appointment administration controls;
- legacy Visit records migrate to the Appointment-only model.

### Check-in and queue

```text
PLANNED → CHECKED_IN
```

- only today's Appointments can check in;
- check-in timestamp records the check-in action;
- live queue contains today's checked-in Appointments only;
- queue order uses persisted check-in sequence, not scheduled time;
- equal timestamps retain first-saved order;
- queue row: position, Patient name, gender, scheduled time, check-in time, optional reason;
- Assistant Appointment list and queue show phone;
- Doctor queue omits phone;
- no early/late, unavailable, Left, Cancelled, or no-show state;
- checked-in Patient and date cannot change;
- scheduled time, reason, and Patient profile details remain correctable;
- Check in, Appointment deletion, and Patient deletion use server-enforced five-second Undo;
- live operational data refreshes every three seconds.

### Doctor room call, consultation handoff, and completion

```text
CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

- Doctor taps **Room ready** as a one-time ring/call;
- any current `WITH_DOCTOR` Patient becomes `DOCTOR_FINISHED`;
- `DOCTOR_FINISHED` is the final Appointment workflow state and is displayed to users as **Completed**;
- there is no separate `CHECKED_OUT` state, Checkout button, checkout queue, checkout form, or checkout timestamp;
- `doctor_finished_at` is the completion timestamp;
- the Doctor receives five-second Undo before the Assistant is notified;
- Undo Room ready restores the completed Appointment to `WITH_DOCTOR` within that existing five-second window;
- after five seconds, the Assistant receives one short sound and persistent on-screen notice;
- a smaller Room ready indicator remains after dismissal until the call is consumed;
- one pending call persists even if the queue is empty;
- first waiting Patient is suggested, but Assistant may choose any checked-in Patient;
- Assistant taps **With doctor** and consumes the pending call;
- queue sequence remains based on original check-in, while displayed positions recalculate;
- Assistant's five-second Undo restores the Patient to the queue and restores the pending call;
- `WITH_DOCTOR` disappears from the waiting queue and appears as a badge in the Appointment list;
- completed Appointments remain in the daily Appointment list and Patient history;
- Doctor consultation card shows Patient name, scheduled time, check-in time, reason, shared Patient note, and Patient-profile access;
- card expansion and dismissal are visual only and never change status;
- no Doctor Finished, Checkout, Pause, Return, or automatic-next-patient action;
- clinic-scoped transactions prevent conflicts between separate Doctor and Assistant computers.

### Shared tasks

```text
OPEN → DONE
```

- only the Doctor account creates tasks, and every task is implicitly for the Assistant;
- no assignment or self-assignment system;
- task fields: title, description, optional date-only due date, optional one-Patient association;
- clicking **New task** opens a compact modal instead of placing the create form above the Open list;
- same shared task data appears in both workspaces;
- Open tasks sort oldest first;
- the Assistant normally performs the task and taps **Done**; the Doctor may also mark Done;
- Done has five-second Undo back to Open and no permanent Reopen action after expiry;
- Done tasks leave Open and remain in History;
- Doctor creator may edit tasks;
- only Doctor may delete tasks, including completed tasks; deletion has five-second Undo;
- both staff may comment, but each may edit/delete only their own comments;
- edited comments show **Edited** without visible revision history;
- comment deletion has five-second Undo;
- optional Patient name opens the Patient profile, but tasks do not appear inside Patient profiles;
- no task attachments;
- when the Doctor creates a new task, only the Assistant account gets a small red dot beside the Tasks tab;
- when the Assistant marks a task Done, the Doctor account gets a small red dot beside the Tasks tab;
- opening Tasks clears the current account's red dot; while Tasks remains open, the same lightweight refresh keeps activity seen;
- pre-existing tasks from before the attention-dot feature are initialized as already seen;
- the red dot is an in-app attention marker only: no task sound, push notification, popup alert, email, badge count, comment alert, or due-date alert is added;
- Room ready remains the only sound/persistent notification workflow;
- browser-demo behavior mirrors backend permissions, lifecycle, attention state, and modal UX.

### Private sticky

- exactly one private scratchpad per staff account, not multiple notes;
- plain multiline text only, with no title, ordering, formatting, history, or Edited label;
- autosaves to the server while typing with no routine Saving/Saved label;
- persists across dates, reloads, and sign-ins until its owner changes or erases the text;
- erasing the content saves a blank scratchpad; there is no Delete action or Undo;
- stays fixed to the viewport throughout the owner's workspace and has no dedicated Notes tab;
- minimizes to a small movable yellow strip at the lower-right; there is no Close button;
- desktop expanded state is draggable and resizable;
- mobile minimized state is movable and expands to a full-screen editor;
- Doctor sticky appears only in Doctor workspace;
- Assistant sticky appears only for the Assistant account in Assistant workspace;
- Doctor administrator access to Assistant workspace shows neither account's sticky;
- no Patient links, reminders, attachments, search, notifications, colors, or other note system;
- browser-demo behavior mirrors backend persistence and workspace privacy.

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

## Current work

**Phase 0 base authentication and its cleanup, plus Phases 1–7, are complete. Phase 8 has not started.**

The Phase 0 correction and obsolete-auth cleanup are implemented and validated. Phase 8's previous answers and unresolved questions remain documented and must not be lost.

The public Pages deployment outcome is separate from the repository verification result and may be checked independently when needed.

## Next action

Stop before Phase 8. Wait for the product owner to explicitly say **continue**.

When Phase 8 is started, read [`PHASE_8_AUTHENTICATION_ADMINISTRATION.md`](PHASE_8_AUTHENTICATION_ADMINISTRATION.md), preserve its approved answers, and ask only the remaining genuine clarification questions before implementing recovery, account-management, multi-clinic, passkey-management, or broader security behavior.