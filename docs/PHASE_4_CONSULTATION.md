# Phase 4 — Doctor room call and consultation handoff

Status: **Implemented and aligned with the current membership, clinic, and timezone architecture.**

Phase 4 keeps the Doctor–Assistant handoff explicit and minimal. The Doctor signals that the room is ready; the Assistant-side workspace chooses and sends a checked-in Patient. The two actions are separate so the application matches the physical clinic workflow and remains safe when the two workspaces are open on different computers.

## Workflow states

```text
PLANNED → CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

- `CHECKED_IN` means the Patient is waiting in the clinic queue.
- `WITH_DOCTOR` means the Assistant-side workflow has sent the Patient into the Doctor's room.
- `DOCTOR_FINISHED` means the Doctor subsequently tapped **Room ready**, indicating that the previous Patient has left and the next Patient may be sent.
- `DOCTOR_FINISHED` is the final Appointment state and is displayed to users as **Completed**.

There is no separate Doctor **Finished**, **Checkout**, **Pause**, **Return to queue**, or automatic-next-patient action.

## Membership and workspace permissions

Phase 4 permissions come from the active clinic membership together with the active workspace.

- a Doctor membership in Doctor workspace may use **Room ready**;
- an Assistant membership in Assistant workspace may use **With doctor** and its Undo;
- a Doctor membership opened in Assistant workspace as administrator may use the same Assistant-side **With doctor** and Undo controls;
- a Doctor membership in Assistant workspace cannot use **Room ready**;
- an Assistant membership cannot open Doctor workspace.

**Room ready is therefore strictly a Doctor-workspace clinical action.** Doctor administrator access to Assistant workspace does not duplicate that control.

## Clinic isolation

Consultation state belongs to exactly one clinic.

The active clinic membership determines the Patient records, Appointments, waiting queue, current `WITH_DOCTOR` Appointment, pending Room-ready call, and all Phase 4 mutations.

Each clinic therefore has its own independent consultation workflow:

- one current consultation at most per clinic operational day;
- one pending Room-ready call at most per clinic;
- Clinic A cannot expose, consume, undo, or alter Clinic B's Room-ready state or consultation;
- switching clinics changes the visible queue, current consultation, and pending Room-ready state.

## Clinic operational timezone

Phase 4 uses the clinic operational timezone established in Phase 3.

The stored clinic timezone determines which date counts as the active clinic day for:

- the waiting queue participating in handoff;
- the current `WITH_DOCTOR` Appointment;
- Room-ready state;
- **With doctor** eligibility;
- consultation completion for that clinic day.

A Doctor or Assistant travelling with a browser in another timezone does not change the clinic's operational day.

## Doctor Room ready action

The Doctor workspace provides one **Room ready** button.

When tapped:

1. the current `WITH_DOCTOR` Appointment for the active clinic day, if any, becomes `DOCTOR_FINISHED` / **Completed**;
2. one clinic-scoped pending room call is created;
3. a five-second server-enforced Undo period begins;
4. the Assistant-side workspace does not see or hear the call until that Undo period expires.

Only one room call may be pending for a clinic. The button is unavailable while a call is pending and during the five-second Undo period after a Patient has just been sent **With doctor**.

A room call may be created while the queue is empty. It remains pending so the Assistant-side workspace can send a Patient who checks in later without requiring another Doctor action.

## Assistant notification and Patient selection

After the Doctor's five-second Undo period expires, the Assistant-side workspace receives:

- one short sound;
- a persistent on-screen Room-ready notification;
- a dismiss control that only hides the large notification;
- a smaller **Room ready** indicator that remains until a Patient is sent.

If Patients are waiting, the first Patient in persisted queue order is suggested. The user may choose any checked-in Patient instead.

Selecting **With doctor**:

- changes only the selected Appointment from `CHECKED_IN` to `WITH_DOCTOR`;
- consumes the pending room call;
- removes the selected Patient from the waiting queue;
- preserves every Appointment's original check-in sequence;
- recalculates the displayed positions of the remaining queue.

Choosing another Patient does not change the original queue order of the Patients who remain waiting.

## Five-second Undo

### Undo Room ready

During the first five seconds, the Doctor may undo **Room ready**.

- the pending call is removed;
- the Assistant-side workspace never receives that call;
- if a Patient was changed to `DOCTOR_FINISHED`, that Appointment returns to `WITH_DOCTOR`;
- the Doctor consultation card is restored.

After the pending call becomes available to the Assistant-side workspace, the Doctor's Undo period has expired.

### Undo With doctor

During the first five seconds after **With doctor**, the Assistant-side workspace may undo it.

- the selected Appointment returns to `CHECKED_IN`;
- its original check-in time and queue sequence remain unchanged;
- the pending room call is restored;
- the Patient disappears from the Doctor consultation card;
- queue positions are recalculated from the unchanged queue order.

Once this five-second period expires, the Doctor may tap **Room ready** for the next handoff.

## Doctor consultation card

The current `WITH_DOCTOR` Patient appears as a compact card in Doctor workspace. The card remains available while the Appointment is `WITH_DOCTOR`.

Clicking the card opens an expanded overlay containing:

- Patient name;
- scheduled time;
- check-in time;
- optional Appointment reason;
- existing shared Patient note;
- **Open patient profile**.

Clicking outside the overlay, using its close control, or pressing Escape closes only the overlay. Opening or closing it never changes workflow status.

The Doctor queue and consultation card do not show the Patient phone number.

## Assistant-side visibility

- `WITH_DOCTOR` Appointments disappear from the waiting queue.
- The Appointment list displays `WITH_DOCTOR` and final `DOCTOR_FINISHED` status badges; the final status is labeled **Completed**.
- No separate **With doctor** or Checkout panel is added.
- The Assistant-side workspace has no Doctor Finished, Checkout, Pause, Return, or consultation-management control beyond the approved handoff action and Undo.

## Editing and deletion

After check-in, Patient association and Appointment date remain locked. Scheduled time, reason, and Patient profile details remain correctable through the existing Edit flows.

Appointments cannot be deleted after consultation starts (`WITH_DOCTOR` or `DOCTOR_FINISHED`). There is no post-consultation deletion or Checkout workflow.

## Concurrency and refresh

The backend is authoritative. Room ready, With doctor, and their Undo operations use clinic-scoped database transactions and locks so Doctor and Assistant computers cannot consume the same call or place two Patients with the Doctor.

The existing authenticated three-second polling refreshes:

- waiting queue;
- room-call state;
- current Doctor consultation card;
- the active day's Appointment status badges.

No WebSocket service, browser push, email, SMS, or external notification dependency is introduced.

## API contract

```text
GET  /api/visits/room-state/
POST /api/visits/room-ready/
POST /api/visits/room-ready/undo/
POST /api/visits/<visit-id>/with-doctor/
POST /api/visits/<visit-id>/undo-with-doctor/
```

`room-state` is workspace-aware and clinic-scoped:

- Doctor workspace receives the current `WITH_DOCTOR` Appointment and immediate pending-call state for the active clinic;
- Assistant workspace receives no room call during the Doctor's five-second Undo period;
- after that period, Assistant workspace receives the pending call and suggested first Appointment for the active clinic.

**Room ready** and its Undo require a Doctor membership in Doctor workspace. **With doctor** and its Undo require Assistant workspace; that workspace may be opened by the clinic's Assistant membership or by its Doctor membership using administrator access.

## Notes boundary

The shared Patient note shown on the consultation card is part of the Patient profile. Personal Doctor and Assistant sticky notes are separate owner-only helpers and are not consultation records.

## Phase 4 invariants

- Room ready is available only to a Doctor membership in Doctor workspace;
- Doctor administrator access to Assistant workspace may perform Assistant-side handoff but cannot use Room ready there;
- consultation and Room-ready state are strictly clinic-scoped;
- the clinic operational timezone determines the active consultation day;
- only one Patient may be `WITH_DOCTOR` for the active clinic day;
- only one Room-ready call may be pending per clinic;
- Room ready becomes visible/audible to Assistant workspace only after its five-second Undo window;
- first waiting Patient is suggested, but any checked-in Patient may be selected;
- With doctor preserves the original check-in sequence and has five-second Undo;
- `DOCTOR_FINISHED` is final and displayed as **Completed**;
- there is no Checkout workflow;
- three-second polling remains the synchronization mechanism.

**Phase 4 is complete as the consultation-handoff product contract.**