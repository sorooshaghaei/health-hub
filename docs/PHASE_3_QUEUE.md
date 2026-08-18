# Phase 3 — Check-in and live queue

Status: **Implemented, with the current membership and clinic-timezone contract documented here.**

## Workflow state

```text
PLANNED → CHECKED_IN
```

`CHECKED_IN` means the Patient is physically present in the clinic. The check-in timestamp records when the Assistant checks the Patient in.

There is no separate Arrived state and no alternate Visit type.

## Clinic operational timezone

Each clinic has one operational timezone.

When a clinic is created, Health Hub automatically captures the creating browser's IANA timezone, for example `Europe/Paris`, and stores it with the clinic. The user is not required to choose a timezone manually during normal clinic creation.

The clinic operational timezone determines:

- what calendar date counts as **today** for that clinic;
- which Appointment list is today's list;
- whether an Appointment is eligible for check-in;
- which checked-in Appointments belong to the live queue;
- the operational day used by the Room-ready and consultation workflow.

A staff member travelling with a different browser timezone does not change the clinic's operational day. Different staff devices therefore cannot disagree about which clinic date is active.

Browser-local formatting may still be used where appropriate for presentation, but workflow eligibility and clinic-day boundaries use the stored clinic timezone.

## Check-in eligibility and permissions

- only an Appointment dated today in the clinic's operational timezone can be checked in;
- future and past Appointments cannot enter today's queue;
- an Appointment that already entered the clinic workflow cannot be checked in again;
- an Assistant membership in Assistant workspace may perform check-in and queue operations;
- a Doctor membership opened in Assistant workspace has the same administrative controls;
- a Doctor membership in Doctor workspace views the queue but does not perform Phase 3 mutations;
- an Assistant membership cannot open Doctor workspace.

## Clinic isolation

The live queue belongs to exactly one clinic.

Patient, Appointment, check-in, queue sequence, and later consultation state are resolved through the active clinic membership. If the same personal account belongs to several clinics, every clinic has an independent daily Appointment list and live queue.

Switching clinics never carries queue state, queue positions, check-in ordering, or Room-ready state from one clinic into another.

## Live queue scope and ordering

The live queue contains only active, checked-in Appointments for the active clinic's current operational date.

Ordering is:

1. persisted check-in sequence;
2. check-in timestamp as a defensive secondary key;
3. creation timestamp as the final deterministic key.

The sequence is assigned while holding a clinic-level database lock. Therefore, when two check-in timestamps are equal, the first successfully saved check-in remains first.

Displayed queue position is recalculated from the active ordered queue, so positions close automatically when an Appointment is removed or enters consultation.

Scheduled time is planning information only and never determines queue position.

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

Corrections to scheduled time or Patient details never recalculate the original persisted queue order.

## Patient leaves before consultation

The Assistant workspace deletes the Appointment, including when it is checked in.

Deletion immediately removes it from:

- the Appointment list;
- the live queue;
- Patient Appointment history.

Internally, deletion is soft for the five-second Undo mechanism.

There is no Left, Cancelled, unavailable, or no-show state in Phase 3.

Once consultation starts, the Appointment cannot be deleted. `DOCTOR_FINISHED` later remains the final **Completed** state and there is no checkout workflow.

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

The frontend refreshes the live queue every three seconds using the authenticated clinic session. No WebSocket service or external dependency is introduced in Phase 3.

## API contract

```text
GET  /api/visits/queue/
POST /api/visits/<visit-id>/check-in/
POST /api/visits/<visit-id>/undo-check-in/
POST /api/visits/<visit-id>/undo-delete/
POST /api/patients/<patient-id>/undo-delete/
```

Queue access is clinic-scoped through the active membership. Mutation endpoints require Assistant workspace, whether it is opened by an Assistant membership or by a Doctor membership using administrator access.

## Phase 3 invariants

- `PLANNED → CHECKED_IN` is the only Phase 3 status transition;
- check-in is available only for the clinic's current operational date;
- clinic operational timezone is captured automatically from the browser that creates the clinic;
- clinic operational timezone, not each viewing browser's timezone, determines the clinic day;
- queue state is completely clinic-scoped;
- queue order is the persisted original check-in order;
- Doctor workspace omits Patient phone from queue rows;
- Assistant workspace includes Patient phone in queue/list context;
- Patient and Appointment date are locked after check-in;
- scheduled time, reason, and Patient profile details remain correctable;
- check-in and destructive actions use five-second server-enforced Undo;
- normal edits do not use Undo;
- live queue refresh remains lightweight three-second polling.

**Phase 3 is complete as the queue/check-in product contract.**