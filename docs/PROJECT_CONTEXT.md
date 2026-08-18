# Health Hub project continuation context

This is the handoff entry point for a new chat or development session.

## Repository and working protocol

- Repository: `sorooshaghaei/health-hub`
- Working branch: `main`
- Work directly on `main`; do not create branches or pull requests unless explicitly instructed.
- Before implementing a product or workflow change, clarify it with the product owner first.
- Do not re-ask decisions that are already explicit in the current phase specifications.
- Work one approved phase or corrective pass at a time.
- Update documentation and implementation together when a clarified rule changes behavior.
- Validate before treating an implementation correction as closed.

## Current correction pass

The Phase 0–8 implementation exists, but the project is undergoing a line-by-line documentation and implementation alignment pass before Phase 9.

Alignment completed so far:

- Phase 0 — Foundation: specification corrected to the final account/membership/device architecture; current-device removal rule implemented.
- Phase 1 — Patient records: specification corrected to membership/workspace and multi-clinic terminology; implementation already matched.
- Phase 2 — Appointments: specification corrected to current clinic-scoped architecture; implementation already matched.
- Phase 3 — Check-in/live queue: specification corrected and clinic operational timezone implemented.
- Phase 4 — Room ready/consultation handoff: specification corrected to membership/workspace, clinic isolation, clinic timezone, and final Completed semantics; implementation already matched and permission regression coverage was strengthened.
- Phase 5 — Completed consultation behavior: specification corrected to final-state, visibility, editing/deletion, clinic isolation, and clinic-timezone rules; implementation already matched.

Next clarification target: **Phase 6 — Shared tasks**.

Do not begin Phase 9 while this Phase 0–8 reconciliation is still in progress.

## Product baseline

Health Hub is a deliberately simple clinic workflow application for Doctor and Assistant roles.

Technology:

- React/Vite frontend;
- Django REST Framework backend;
- PostgreSQL primary database;
- GitHub Pages uses the same production React UI through a browser-local API/storage adapter.

Clinic operational data is tenant-scoped. Personal staff identity is global.

## Personal account and clinic membership model

`StaffUser` is the person's global personal account. It owns:

- first/last name;
- unique email;
- unique phone;
- password;
- contact-verification state;
- passkeys;
- eligible Doctor recovery codes;
- global private sticky.

There is no active username login and no shared clinic password. Staff sign in with email or phone + password, or a registered passkey where supported.

`StaffMembership` is clinic-specific. It owns:

- clinic;
- Doctor or Assistant role;
- active/inactive membership state;
- membership-scoped task-attention seen state.

Each clinic has at most one active Doctor membership and one active Assistant membership. Both Doctors and Assistants may belong to multiple clinics.

The same physical Patient appearing in two clinics remains two independent clinic Patient records. Patient, Appointment, queue, room-call, task, and trusted-device data never become global.

## Workspace authorization

Account identity, clinic membership, and workspace are separate.

- Doctor membership → Doctor workspace.
- Doctor membership → Assistant workspace for administrator intervention.
- Assistant membership → Assistant workspace.
- Assistant membership cannot open Doctor workspace.

Doctor workspace is clinically focused. It may edit approved Patient information but does not create/delete Patients or administer Appointments.

Assistant workspace owns Patient/Appointment administration, check-in, queue, and consultation handoff. A Doctor membership opened in Assistant workspace receives those Assistant-side administrative controls.

## Verified contacts and trusted devices

Phone is required for new personal accounts. Both personal email and phone must be verified before clinic operational data opens.

Trusted-device authorization is per clinic. A new browser may be authorized through either:

- a code sent to the signed-in person's verified email or verified phone/SMS; or
- the six-digit pairing flow approved from another already trusted device for that clinic.

Trusted devices remain trusted until removed.

Current approved device-management rule:

- other trusted devices may be removed;
- **the current trusted device cannot be removed**;
- signing out does not remove device trust.

A clinic-bound staff session requires the bearer session plus proof of the matching trusted device. A copied bearer token alone cannot open clinic operational data.

## Session policy

Current default session policy:

- 12-hour absolute lifetime;
- 2-hour inactivity timeout;
- no Remember Me;
- browser close does not itself revoke an otherwise valid server session;
- explicit sign-out deletes the staff session but keeps device trust.

A global personal session before clinic selection cannot open clinic operational APIs.

## Clinic operational timezone

Each clinic stores one operational IANA timezone, for example `Europe/Paris`.

When a clinic is created, the frontend automatically captures the creating browser's timezone and sends it with clinic creation. There is no required timezone field in the normal creation UI.

The stored clinic timezone is authoritative for clinic-day logic, including:

- what counts as **today**;
- today's Appointment list;
- check-in eligibility;
- live queue membership;
- Room-ready/consultation day boundaries.

A Doctor travelling with a laptop does not move the clinic into another operational day merely because that browser changes timezone.

The backend activates the selected clinic timezone for clinic-scoped requests and resets timezone state between requests. The browser demo preserves the same captured clinic timezone in local demonstration storage.

Migration `accounts.0008_clinic_timezone` adds the persisted clinic timezone field.

## Implemented clinic workflow through Phase 5

### Patients

- reusable clinic-scoped Patient profile;
- full name;
- `Man` / `Woman`;
- country/calling code + phone;
- Iran `+98` default;
- optional date of birth;
- optional shared Patient note;
- automatic search by normalized name, phone, or DOB;
- one duplicate warning;
- Doctor workspace may edit approved Patient fields;
- Assistant workspace may create/edit/delete Patients;
- Doctor membership in Assistant workspace receives the same Patient administration controls;
- current/future Appointments block Patient deletion;
- Patient deletion has five-second Undo.

### Appointments

- Patient, date, scheduled time, optional reason;
- one active Appointment maximum per Patient per clinic date;
- each clinic's Appointment history is independent;
- unplanned same-day arrival is represented by a normal same-day Appointment, then check-in;
- Assistant workspace creates/edits/deletes Appointments subject to workflow locks;
- Doctor workspace is read-only for Appointment administration;
- deletion has five-second Undo.

### Check-in and queue

```text
PLANNED → CHECKED_IN
```

- only an Appointment whose date equals the clinic's operational today may check in;
- check-in timestamp records the actual check-in action;
- queue order is the original persisted check-in sequence;
- Assistant queue shows Patient phone; Doctor queue omits it;
- Patient and Appointment date are locked after check-in;
- scheduled time, reason, and Patient profile information remain correctable;
- queue position does not change because of those corrections;
- check-in and eligible destructive actions use the five-second server-enforced Undo;
- live queue refresh uses the existing three-second authenticated polling.

### Room ready and consultation handoff

```text
CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

- **Room ready** is strictly a Doctor-membership + Doctor-workspace action;
- Doctor membership in Assistant workspace cannot use Room ready there;
- Assistant workspace may perform **With doctor**, whether opened by the Assistant membership or by the Doctor membership as administrator;
- consultation/current-Patient/Room-ready state is strictly clinic-scoped;
- the clinic operational timezone determines the active consultation day;
- one pending Room-ready call maximum per clinic;
- Room ready has five-second server-enforced Undo before Assistant-side notification;
- after the Undo period, Assistant workspace receives one short sound plus persistent visual indication;
- first waiting Patient is suggested but any checked-in Patient may be selected;
- With doctor preserves the original queue sequence and has its own five-second Undo;
- synchronization remains authenticated three-second polling.

### Completed consultation

`DOCTOR_FINISHED` is the final Appointment state and is displayed as **Completed**.

- the next Room ready completes the current `WITH_DOCTOR` Appointment and creates the next Room-ready call in the same Doctor action;
- no Checkout state, action, form, queue, or timestamp exists;
- the five-second Undo on Room ready is the only way to reverse completion;
- once that Undo period expires, the Appointment cannot return to `WITH_DOCTOR`;
- Completed Appointments leave the waiting queue and Doctor consultation card but remain in their date list and Patient history;
- Patient and Appointment date remain locked after completion;
- scheduled time, reason, and Patient profile details remain correctable through existing Edit flows;
- Completed Appointments cannot be deleted;
- completion and history are clinic-scoped and use the clinic operational timezone for the clinic-day boundary.

## Existing Phase 6–8 implementation

The repository already contains Phase 6–8 features: shared tasks, private sticky, and Phase 8 account/recovery/security architecture.

Their phase documents are being reviewed sequentially in the current reconciliation pass. When an older Phase 6–8 document conflicts with an explicitly corrected Phase 0–5 rule above, do not silently choose one: continue the phase-by-phase clarification process with the product owner.

The Phase 8 Pages parity correction remains an invariant: production and GitHub Pages render the same React product UI. Pages substitutes only the browser-local API/security storage layer and must not expose a separate username/demo application.

## Browser demo security boundary

The public GitHub Pages demo is demonstration storage only. It does not provide or claim real production:

- email/SMS delivery;
- trusted-device authority;
- WebAuthn/passkey verification;
- medical-data storage guarantees.

Do not enter real Patient information into the public demo.

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

## Next action

Continue with **Phase 6 clarification**. Do not implement Phase 6 corrections until its behavior is fully approved.

After Phase 8 reconciliation is complete, perform a final repository-wide documentation/code consistency audit before considering Phase 9.
