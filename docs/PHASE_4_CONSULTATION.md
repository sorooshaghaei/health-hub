# Phase 4 — Doctor room call and consultation handoff

Status: **Implemented in the repository.**

Phase 4 keeps the Doctor–Assistant handoff explicit and minimal. The Doctor signals that the room is ready; the Assistant chooses and sends a checked-in Patient. The two actions are separate so the application matches the physical clinic workflow and remains safe when the two workspaces are open on different computers.

## Workflow states

```text
PLANNED → CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

- `CHECKED_IN` means the Patient is waiting in the clinic queue.
- `WITH_DOCTOR` means the Assistant has sent the Patient into the Doctor's room.
- `DOCTOR_FINISHED` means the Doctor has subsequently tapped **Room ready**, indicating that the previous Patient has left and the next Patient may be sent.
- Checkout remains Phase 5 scope.

There is no Doctor **Finished**, **Pause**, **Return to queue**, or automatic-next-patient action.

## Doctor Room ready action

The Doctor workspace provides one **Room ready** button.

When tapped:

1. the current `WITH_DOCTOR` Appointment, if any, becomes `DOCTOR_FINISHED`;
2. one clinic-scoped pending room call is created;
3. a five-second server-enforced Undo period begins;
4. the Assistant does not see or hear the call until that Undo period expires.

Only one room call may be pending. The button is unavailable while a call is pending and during the five-second Undo period after the Assistant has just sent a Patient in.

A room call may be created while the queue is empty. It remains pending so the Assistant can send a Patient who checks in later without requiring another Doctor action.

## Assistant notification and selection

After the Doctor's five-second Undo period expires, the Assistant receives:

- one short sound;
- a persistent on-screen room-ready notification;
- a dismiss control that only hides the large notification;
- a smaller **Room ready** indicator that remains until a Patient is sent.

If Patients are waiting, the first Patient in persisted queue order is suggested. The Assistant may choose any checked-in Patient instead.

Selecting **With doctor**:

- changes only the selected Appointment from `CHECKED_IN` to `WITH_DOCTOR`;
- consumes the pending room call;
- removes the selected Patient from the waiting queue;
- preserves every Appointment's original check-in sequence;
- recalculates the displayed positions of the remaining queue.

Therefore, choosing another Patient does not move the original first Patient behind anyone else. That Patient remains first among the remaining waiting Patients.

## Five-second Undo

### Undo Room ready

During the first five seconds, the Doctor may undo **Room ready**.

- the pending call is removed;
- the Assistant never receives that call;
- if a Patient was changed to `DOCTOR_FINISHED`, that Patient returns to `WITH_DOCTOR`;
- the Doctor consultation card is restored.

After the pending call has become available to the Assistant, the Doctor's Undo period has expired.

### Undo With doctor

During the first five seconds after the Assistant selects **With doctor**, the Assistant may undo it.

- the selected Appointment returns to `CHECKED_IN`;
- its original check-in time and queue sequence remain unchanged;
- the pending room call is restored;
- the Patient disappears from the Doctor consultation card;
- queue positions are recalculated from the unchanged queue order.

Once this five-second period expires, the Doctor may tap **Room ready** for the next handoff.

## Doctor consultation card

The current `WITH_DOCTOR` Patient appears as a compact card in the Doctor workspace. The card remains available for as long as the Appointment is `WITH_DOCTOR`.

Clicking the card opens an expanded overlay containing:

- Patient name;
- scheduled time;
- check-in time;
- optional Appointment reason;
- existing shared Patient note;
- **Open patient profile**.

Clicking outside the overlay, using its close control, or pressing Escape closes only the overlay. Opening or closing it never changes workflow status.

The Doctor queue and consultation card do not show the Patient phone number.

## Assistant visibility

- `WITH_DOCTOR` Appointments disappear from the waiting queue.
- The Appointment list displays `WITH_DOCTOR` and `DOCTOR_FINISHED` status badges.
- No separate **With doctor** panel is added.
- The Assistant has no Doctor Finished, Pause, Return, or consultation-management control.

## Editing and deletion

After check-in, Patient and Appointment date remain locked. Scheduled time, reason, and Patient profile details remain correctable through the existing Edit flows.

Appointments cannot be deleted after consultation starts (`WITH_DOCTOR` or `DOCTOR_FINISHED`). Checkout and post-consultation removal behavior are reserved for Phase 5.

## Concurrency and refresh

The backend is authoritative. Room ready, With doctor, and their Undo operations use clinic-scoped database transactions and locks so Doctor and Assistant computers cannot consume the same call or place two Patients with the Doctor.

The existing authenticated three-second polling refreshes:

- waiting queue;
- room-call state;
- current Doctor consultation card;
- today's Appointment status badges.

No WebSocket service, browser push, email, SMS, or external notification dependency is introduced.

## API contract

```text
GET  /api/visits/room-state/
POST /api/visits/room-ready/
POST /api/visits/room-ready/undo/
POST /api/visits/<visit-id>/with-doctor/
POST /api/visits/<visit-id>/undo-with-doctor/
```

`room-state` is role-aware:

- Doctor workspace receives the current `WITH_DOCTOR` Appointment and immediate pending-call state;
- Assistant workspace receives no room call during the Doctor's five-second Undo period;
- after that period, Assistant workspace receives the pending call and suggested first Appointment.

Room ready and its Undo require Doctor workspace. With doctor and its Undo require Assistant workspace.

## Notes boundary

The shared Patient note shown on the consultation card is part of the Patient profile. Personal Doctor and Assistant sticky notes remain separate creator-only helpers planned for Phase 7; Phase 4 does not turn them into consultation records.
