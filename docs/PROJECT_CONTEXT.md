# Health Hub project continuation context

This is the handoff entry point for a new chat or development session.

## Repository and working protocol

- Repository: `sorooshaghaei/health-hub`
- Working branch: `main`
- Work directly on `main`; do not create branches or pull requests unless explicitly instructed.
- Clarify product/workflow changes with the product owner before implementing them.
- Do not re-ask decisions already explicit in the current phase specifications.
- Reconcile one phase at a time: specification → implementation alignment → validation → handoff update.
- Do not begin Phase 9 until Phase 0–8 reconciliation and a final repository-wide consistency audit are complete.

## Current reconciliation status

The Phase 0–8 implementation already exists. The repository is being corrected line by line so outdated pre-Phase-8 assumptions are removed and replaced with the final architecture.

Completed reconciliation:

- Phase 0 — Foundation: corrected; current trusted device cannot be removed; implementation aligned.
- Phase 1 — Patient records: corrected to membership/workspace and multi-clinic terminology; implementation already aligned.
- Phase 2 — Appointments: corrected to final clinic-scoped model; implementation already aligned.
- Phase 3 — Check-in/live queue: corrected; persisted clinic operational timezone implemented.
- Phase 4 — Room ready/consultation handoff: corrected; implementation already aligned; permission regression coverage strengthened.
- Phase 5 — Completed consultation behavior: corrected; implementation already aligned.
- Phase 6 — Shared tasks: corrected to membership-scoped permissions/attention/history semantics; implementation terminology aligned and coverage strengthened.
- Phase 7 — Private sticky: corrected to global-account/membership privacy semantics; minimized private-text preview removed; coverage strengthened.

Next clarification target: **Phase 8 — Accounts, recovery, administration, and security**.

Phase 9 has not started.

## Product architecture

Health Hub is a deliberately simple clinic workflow application using React/Vite, Django REST Framework, and PostgreSQL.

Personal staff identity is global; clinic workflow data is tenant-scoped.

### Global personal account

`StaffUser` owns personal/global data:

- first and last name;
- unique email;
- unique phone;
- password;
- contact verification state;
- passkeys;
- eligible Doctor recovery codes;
- one global private sticky.

There is no active username login and no shared clinic password. Sign-in uses email or phone + password, with passkeys where supported.

### Clinic membership

`StaffMembership` owns clinic-specific identity:

- clinic;
- Doctor or Assistant role;
- active/inactive state;
- task-attention seen state.

Each clinic currently has at most one active Doctor membership and one active Assistant membership. Both Doctors and Assistants may belong to multiple clinics.

Workspace access:

- Doctor membership → Doctor workspace;
- Doctor membership → Assistant workspace as administrator;
- Assistant membership → Assistant workspace only.

Patient, Appointment, queue, Room-ready, task, and trusted-device data never become global.

## Trusted devices and sessions

Device trust is per clinic.

A new browser may be authorized through:

- a code sent to the signed-in person's verified email or verified phone/SMS; or
- six-digit pairing approved from another trusted browser for that clinic.

Current device-management rule:

- other trusted devices may be removed;
- **the current trusted device cannot be removed**;
- sign-out ends the session but does not remove device trust.

Clinic-bound APIs require bearer session + matching trusted-device proof.

Default staff-session policy:

- 12-hour absolute lifetime;
- 2-hour inactivity timeout;
- no Remember Me.

## Clinic operational timezone

Each clinic stores one IANA operational timezone. The frontend captures the creating browser's timezone automatically when the clinic is created.

The stored clinic timezone governs clinic-day logic:

- operational **today**;
- today's Appointments;
- check-in eligibility;
- live queue membership;
- Room-ready/consultation day boundaries.

A travelling staff browser does not change the clinic's operational day.

Migration: `accounts.0008_clinic_timezone`.

## Reconciled workflow through Phase 7

### Phase 1 — Patients

- reusable clinic-scoped Patient records;
- full name, `Man`/`Woman`, calling code + phone, optional DOB, optional shared Patient note;
- Iran `+98` default;
- automatic search and one duplicate warning;
- Doctor workspace may edit approved Patient information;
- Assistant workspace may create/edit/delete Patients;
- Doctor membership in Assistant workspace receives Assistant-side administration controls;
- current/future Appointments block Patient deletion;
- deletion has five-second Undo;
- the same physical person in two clinics remains two independent Patient records.

### Phase 2 — Appointments

- Patient, date, scheduled time, optional reason;
- one active Appointment maximum per Patient per clinic date;
- unplanned same-day arrival is represented by a normal same-day Appointment followed by check-in;
- Assistant workspace administers Appointments;
- Doctor workspace is read-only for Appointment administration;
- Patient/date lock after check-in; scheduled time/reason remain correctable;
- eligible deletion has five-second Undo.

### Phase 3 — Check-in and queue

```text
PLANNED → CHECKED_IN
```

- only clinic-operational-today Appointments may check in;
- queue order is persisted original check-in sequence;
- Assistant queue shows Patient phone; Doctor queue omits it;
- queue state is clinic-scoped;
- check-in has five-second Undo;
- refresh uses authenticated three-second polling.

### Phase 4 — Room ready and handoff

```text
CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

- **Room ready** requires Doctor membership + Doctor workspace;
- Doctor administrator access in Assistant workspace cannot use Room ready;
- **With doctor** is an Assistant-workspace action, including Doctor administrator access;
- one pending Room-ready call maximum per clinic;
- Room ready may remain pending with an empty queue;
- Room ready has five-second Undo before Assistant notification;
- after Undo expiry: one short sound + persistent visual indication;
- first waiting Patient is suggested, but any checked-in Patient may be chosen;
- With doctor has five-second Undo and preserves original queue sequence;
- synchronization remains three-second polling.

### Phase 5 — Completed consultation

`DOCTOR_FINISHED` is final and displayed as **Completed**.

- the Doctor's next Room ready completes the current `WITH_DOCTOR` Appointment;
- no Checkout state/action/form/queue/timestamp exists;
- `doctor_finished_at` records completion;
- five-second Undo Room ready is the only reversal;
- after that window expires, Completed cannot return to `WITH_DOCTOR`;
- Completed leaves queue/current Doctor card but remains in date list and Patient history;
- Patient/date remain locked; scheduled time/reason/Patient profile corrections remain possible;
- Completed Appointments cannot be deleted.

### Phase 6 — Shared tasks

```text
OPEN → DONE
```

- tasks are strictly clinic-scoped Doctor-to-Assistant work;
- Doctor membership can create tasks in Doctor workspace or Assistant workspace administrator access;
- Assistant membership cannot create/edit/delete tasks;
- only the personal author may edit an existing task;
- an active Doctor membership may delete Open or Done tasks in that clinic;
- Doctor or Assistant may mark Done;
- Done has five-second Undo; no permanent Reopen after expiry;
- Doctor does not receive a self-generated attention dot when the Doctor marks Done;
- Assistant attention = Doctor-created task since that membership last viewed Tasks;
- Doctor attention = Assistant-completed task since that membership last viewed Tasks;
- attention seen state is per `StaffMembership`, so one clinic never clears another clinic's dot;
- optional due date is date-only with no overdue workflow/reminders;
- optional Patient link must reference an active Patient in the same clinic;
- Doctor and Assistant may comment on Open or Done tasks;
- comments remain owned by their personal author; only author may edit/delete;
- historical comments remain attached to a former Assistant after membership replacement;
- comment deletion and task deletion have five-second Undo;
- New Task uses the compact modal;
- task/attention refresh uses authenticated three-second polling;
- no task sound, popup, OS notification, email/SMS, comment alert, or due-date alert.

### Phase 7 — Private sticky

- one global plain-text sticky belongs to each personal `StaffUser` account;
- the same sticky follows that person across clinic memberships;
- Doctor membership + Doctor workspace shows that person's sticky;
- Assistant membership + Assistant workspace shows that person's sticky;
- Doctor membership + Assistant administrator workspace shows **no sticky**;
- the Doctor can never read the Assistant's sticky;
- Assistant replacement/deactivation never transfers or deletes the former Assistant's personal sticky;
- one plain-text value only; autosave; blank text is valid;
- no title, multiple notes, Delete/Trash, Undo, history, rich text, Patient link, task conversion, reminders, attachments, or notifications;
- desktop: fixed viewport sticky, movable minimized strip, movable/resizable expanded editor;
- mobile: movable minimized strip, full-screen expanded editor;
- no Close button;
- minimized strip always displays **Private note**, never private text content;
- sticky content persists globally, but UI position/size/minimized state is not stored on the server and resets to the default presentation when reopened.

## Browser demo invariant

GitHub Pages renders the same production React product UI and substitutes only the browser-local API/storage layer.

It must not expose a separate username/demo application. Browser storage is demonstration-only and must not contain real Patient information.

The demo does not claim real email/SMS delivery, trusted-device authority, WebAuthn security, or medical-data guarantees.

## Phase 8 work still to reconcile

Implemented architecture includes global accounts, memberships, email/phone login, verified contacts, trusted devices, recovery, passkeys, Assistant membership management, multi-clinic support, and Pages UI parity.

Phase 8 still requires explicit final decisions on remaining ambiguities identified during the audit, including:

- Assistant emergency recovery semantics when the Assistant has lost access to both verified email and phone;
- whether recent login itself satisfies contact-change reauthentication or a fresh password/passkey prompt is required;
- whether general authentication/login throttling belongs in Phase 8 or Phase 10;
- correction of stale wording such as the superseded trusted-device removal rule and the login/verification wording.

Do not silently infer these decisions.

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

Continue with **Phase 8 clarification**. Do not implement unresolved Phase 8 behavior until its decisions are fully approved.

After Phase 8 reconciliation, perform a final repository-wide code/document consistency audit before considering Phase 9.
