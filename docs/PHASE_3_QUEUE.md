# Phase 3 — Check-in and live queue

Status: **Implemented in the repository.**

## Workflow state

```text
PLANNED → CHECKED_IN
```

`CHECKED_IN` means the Patient is physically present in the clinic. The check-in timestamp records when the Assistant checks the Patient in.

There is no separate Arrived state and no alternate Visit type.

## Check-in eligibility

- only an Appointment dated today can be checked in;
- future and past Appointments cannot enter today's queue;
- an Appointment that already entered the clinic workflow cannot be checked in again;
- the Assistant workspace performs check-in;
- the Doctor workspace views the queue but does not perform Phase 3 actions.

## Live queue scope and ordering

The live queue contains only active, checked-in Appointments for the clinic's current local date.

Ordering is:

1. persisted check-in sequence;
2. check-in timestamp as a defensive secondary key;
3. creation timestamp as the final deterministic key.

The sequence is assigned while holding a clinic-level database lock. Therefore, when two check-in timestamps are equal, the first successfully saved check-in remains first.

Displayed queue position is recalculated from the active ordered queue, so positions close automatically when an Appointment is removed or enters consultation.

## Queue row

Every row shows:

- queue position;
- Patient name;
- gender;
- scheduled time;
- check-in time;
- optional visit reason.

The Assistant queue also shows the Patient phone number. The Doctor queue omits the phone number. The Assistant daily Appointment list shows phone numbers so absent Patients can be called.

There are no early, on-time, or late labels.

## Editing after check-in

While checked in:

- the Patient association cannot change;
- the Appointment date cannot change;
- scheduled time may be corrected;
- visit reason may be corrected;
- Patient profile details, including phone, may be corrected from the Patient profile;
- queue order remains based on the original check-in action.

## Patient leaves before consultation

The Assistant deletes the Appointment, including when it is checked in.

Deletion immediately removes it from:

- the Appointment list;
- the live queue;
- Patient Appointment history.

This frees the time and presents the Appointment as though it did not exist. Internally, deletion is soft for the five-second Undo mechanism.

There is no Left, Cancelled, unavailable, or no-show state in Phase 3.

Once consultation starts, Phase 4 prevents Appointment deletion. Phase 5 confirms that `DOCTOR_FINISHED` is the final **Completed** state and adds no checkout or post-consultation deletion workflow.

## Five-second Undo

Five-second Undo applies to discrete operational and destructive actions:

- Check in;
- Appointment deletion;
- Patient deletion.

Normal form edits use the existing Edit flow and do not create Undo notifications.

Undo is server-enforced, not only a disappearing frontend message.

### Undo check-in

Undo clears status, check-in time, and queue sequence. The result is equivalent to the check-in never occurring. A later new check-in receives ordering based on that later action.

### Undo Appointment deletion

Undo restores the exact prior Appointment state. If the Appointment was checked in, its original check-in time and queue sequence return.

### Undo Patient deletion

Undo restores the Patient profile exactly.

## Live refresh

The frontend refreshes the live queue every three seconds using the existing authenticated API. No WebSocket service or external dependency is introduced.

## API contract

```text
GET  /api/visits/queue/
POST /api/visits/<visit-id>/check-in/
POST /api/visits/<visit-id>/undo-check-in/
POST /api/visits/<visit-id>/undo-delete/
POST /api/patients/<patient-id>/undo-delete/
```

Queue access is clinic-scoped. Mutation endpoints require the Assistant workspace.
