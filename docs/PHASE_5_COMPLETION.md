# Phase 5 — Completed consultation behavior

Status: **Implemented in the repository.**

Phase 5 confirms that Health Hub does not need a separate checkout action. The Doctor's existing **Room ready** action already marks the current consultation as finished, so asking the Assistant to perform another checkout step would duplicate work without adding useful clinic state.

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
- `doctor_finished_at` remains the consultation-completion timestamp.

## Completion trigger

When the Doctor taps **Room ready** while an Appointment is `WITH_DOCTOR`:

1. that Appointment becomes `DOCTOR_FINISHED`;
2. the Patient is considered finished with the clinic for that Appointment;
3. the current Doctor consultation card is cleared;
4. the existing room-ready call for the next Patient is created as defined by Phase 4.

The completion of the previous Patient and the pending room call for the next Patient are part of the same existing Doctor action. The Assistant does not perform a second confirmation.

## Undo

No checkout-specific Undo exists because there is no checkout action.

The existing five-second **Undo Room ready** remains authoritative:

```text
WITH_DOCTOR → DOCTOR_FINISHED
     ↑              |
     └── Undo ──────┘
```

If the Doctor undoes Room ready within the existing five-second window, the previous Appointment returns from `DOCTOR_FINISHED` to `WITH_DOCTOR` and the room call is removed. After that window expires, the Appointment remains completed.

## Visibility

Completed Appointments:

- do not appear in the live waiting queue;
- do not appear in the Doctor consultation card;
- remain in the Appointment list for the selected date;
- remain in the Patient's Appointment history;
- display **Completed** rather than **Doctor finished** in user-facing status text.

No new Assistant notification, Doctor notification, sound, browser push, email, SMS, or external notification is introduced by Phase 5.

## Editing and deletion

Phase 5 does not add a new post-consultation administration workflow.

The existing rules continue unchanged:

- after check-in, Patient and Appointment date stay locked;
- scheduled time, reason, and Patient profile details remain correctable through existing Edit flows;
- Appointments cannot be deleted after consultation has started, including while `WITH_DOCTOR` or `DOCTOR_FINISHED`.

## Data model and API

Phase 5 adds no backend state, endpoint, timestamp, model field, or migration. Existing Phase 4 API behavior remains authoritative.

The browser-demo adapter continues to mirror the backend by treating `doctor_finished` as the final state.

## Product rationale

A separate checkout step would require the Assistant to confirm an event the application already knows from the Doctor's Room ready action. Keeping `DOCTOR_FINISHED` as the final state reduces clicks, avoids a second completion queue, and preserves the project's goal of keeping clinic operations simple.
