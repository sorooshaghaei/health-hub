# Phase 5 — Completed consultation behavior

Status: **Implemented and reconciled.**

Phase 5 defines consultation completion without adding a second Assistant checkout step. The Doctor's existing **Room ready** action completes the current consultation and starts the next handoff in one operation.

## Final workflow

```text
PLANNED → CHECKED_IN → WITH_DOCTOR → DOCTOR_FINISHED
```

`DOCTOR_FINISHED` is the final Appointment workflow state.

- the backend identifier remains `DOCTOR_FINISHED` / `doctor_finished`;
- the user-facing status label is **Completed**;
- there is no `CHECKED_OUT` state;
- there is no Checkout button or checkout form;
- there is no checkout queue;
- there is no `checked_out_at` field;
- `doctor_finished_at` is the consultation-completion timestamp.

No later workflow state follows `DOCTOR_FINISHED`.

## Completion trigger

When the Doctor taps **Room ready** in Doctor workspace while an Appointment is `WITH_DOCTOR`:

1. that Appointment becomes `DOCTOR_FINISHED`;
2. `doctor_finished_at` records the completion time;
3. the Patient is considered finished with the clinic for that Appointment;
4. the current Doctor consultation card is cleared;
5. the clinic's Room-ready call for the next Patient is created as defined by Phase 4.

The previous Patient's completion and the next Room-ready call are part of the same Doctor action. The Assistant does not perform a second confirmation.

## Finality and Undo

There is no checkout-specific Undo because there is no checkout action.

The existing five-second **Undo Room ready** is the only reversal of completion:

```text
WITH_DOCTOR → DOCTOR_FINISHED
     ↑              |
     └── Undo ──────┘
```

If the Doctor undoes Room ready during its five-second Undo window:

- the previous Appointment returns from `DOCTOR_FINISHED` to `WITH_DOCTOR`;
- `doctor_finished_at` is cleared;
- the pending Room-ready call is removed;
- the Doctor consultation card is restored.

After the five-second Undo window expires, the Completed Appointment cannot be reopened, returned to `WITH_DOCTOR`, or otherwise moved back into the active consultation workflow.

## Visibility

Completed Appointments:

- do not appear in the live waiting queue;
- do not appear in the current Doctor consultation card;
- remain visible in the Appointment list for their date;
- remain visible in the Patient's Appointment history;
- display **Completed** rather than **Doctor finished** in user-facing status text.

Phase 5 adds no Assistant notification, Doctor notification, sound, browser push, email, SMS, or external notification. The Phase 4 Room-ready notification remains the only notification associated with this transition.

## Editing and deletion after completion

Completion does not create a separate post-consultation administration workflow.

The existing post-check-in correction rules continue after completion:

- the Patient attached to the Appointment remains locked;
- the Appointment date remains locked;
- scheduled time may still be corrected;
- Appointment reason may still be corrected;
- Patient profile details may still be corrected through the normal Patient Edit flow.

These corrections do not reopen or change the Appointment's Completed state.

Appointments cannot be deleted after consultation has started, including while `WITH_DOCTOR` or `DOCTOR_FINISHED`.

## Clinic isolation and operational day

Completion is strictly clinic-scoped.

- a Completed Appointment belongs only to its clinic;
- Clinic A's consultation/completion state cannot affect Clinic B;
- switching clinics changes the visible Appointment history and active consultation state to the selected clinic;
- the clinic's stored operational timezone determines the consultation day and Room-ready day boundary;
- a travelling staff browser does not change which clinic day owns the completion.

The actual completion timestamp remains an absolute server timestamp; the stored clinic timezone governs which operational clinic day the workflow belongs to.

## Data model and API

Phase 5 adds no separate backend state, endpoint, timestamp, model, or migration beyond the existing `doctor_finished` state and `doctor_finished_at` field used by the Phase 4 workflow.

The Phase 4 Room-ready API remains authoritative for completion and its five-second Undo.

The browser-demo adapter mirrors the same final-state behavior and uses the selected clinic's stored operational timezone for clinic-day logic.

## Product boundary

A separate Checkout step would duplicate information already established by the Doctor's Room-ready action. Health Hub therefore keeps one final state, **Completed**, and one short reversal mechanism: the existing five-second Undo on Room ready.
