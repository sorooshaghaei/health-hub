# Phase 7 — Private sticky

Status: **Reconciled and implemented according to the approved single-scratchpad workflow.**

## Purpose

Each personal `StaffUser` account owns one private plain-text scratchpad for temporary personal reminders.

It is deliberately not a notes collection, task system, Patient record, clinic record, or daily log.

The text follows the person across clinics because it belongs to the global personal account rather than to a clinic membership.

## Data and persistence

- one text value per personal account;
- plain text and line breaks only;
- no title and no second note;
- direct editing at any time;
- autosave to the backend while typing;
- subtle **Saving…**, **Saved**, and **Not saved** status in the expanded note header;
- clearing every character saves an empty scratchpad;
- the same text remains until its owner changes or clears it;
- no Delete action, Trash, five-second Undo, revision history, or **Edited** label.

Only the note content is persistent application data.

The sticky's screen position, size, and minimized/expanded state are not stored on the server. Reopening a workspace starts from the default minimized lower-right presentation above the reserved Undo-notification lane.

## Global-account behavior

The sticky belongs to the personal account, not to a clinic.

Every account has one permanent Doctor or Assistant role. Therefore:

- the same person sees the same sticky while working in any clinic where that account has an active membership;
- a Doctor account sees the same Doctor sticky across all of that Doctor's clinics when using Doctor workspace;
- an Assistant account sees the same Assistant sticky across all of that Assistant's clinics when using Assistant workspace;
- one account is never Doctor in one clinic and Assistant in another;
- deactivating or replacing an Assistant's membership in one clinic does not delete or transfer that person's sticky;
- a replacement Assistant has only their own personal-account sticky.

If an Assistant eventually reaches the two-year dormant anonymization threshold defined by Phase 8, the private sticky is part of the personal data removed during anonymization.

## Privacy and workspace placement

Access is determined by the permanent account role plus the active workspace. An active clinic membership is still required because the sticky is presented inside a clinic workspace.

| Permanent account role | Active workspace | Sticky result |
| --- | --- | --- |
| Doctor | Doctor | that Doctor's private sticky |
| Assistant | Assistant | that Assistant's private sticky |
| Doctor | Assistant administrator workspace | no private sticky |
| Assistant | Doctor | access is not permitted |

The backend permits private-note reads/writes only when the active workspace role equals the signed-in account's permanent role.

Consequences:

- the Doctor cannot read or edit the Assistant's sticky;
- Doctor administrator access to Assistant workspace does not expose the Assistant's sticky;
- Doctor administrator access also does not carry the Doctor's own sticky into Assistant workspace;
- no clinic membership can access another person's sticky.

## Minimized privacy rule

The minimized sticky never displays private note content.

Its visible label is always **Private note**. The actual text is shown only after the owner expands the sticky.

This avoids exposing personal reminder text on a clinic screen while the sticky is minimized.

## Desktop interaction

- the sticky is fixed to the browser viewport rather than document flow;
- it remains reachable while the page scrolls;
- default state is a small minimized strip near the lower-right, above the reserved Undo-notification lane;
- the minimized strip may be dragged within the available viewport area without entering that lane;
- maximizing opens the same scratchpad;
- the expanded sticky may be dragged and resized within the available viewport area above that lane;
- focusing the minimized bar or expanded header enables arrow-key movement, with Shift for larger steps;
- focusing the resize grip enables arrow-key resizing, with Shift for larger steps;
- **Reset** returns position and size to the safe default without changing note text;
- minimizing returns it to the lower-right default position above the lane;
- Undo notifications render above the sticky so their time-sensitive action remains operable;
- there is no Close button;
- there is no separate Notes tab or Open-note workflow.

## Mobile interaction

- the minimized strip sits above the Undo-notification lane and remains movable within the available viewport area;
- maximizing opens a full-screen plain-text editor;
- minimizing returns to the movable strip;
- there is no Close action.

## Explicit exclusions

Phase 7 does not add:

- multiple notes or note ordering;
- titles, rich text, formatting controls, or color choices;
- Patient links or appearance inside Patient profiles;
- task conversion, due dates, reminders, notifications, or badges;
- attachments;
- search, archive, history, or collaborative access;
- server-side persistence of sticky position, size, or minimized state.

## API

```text
GET   /api/staff/private-note/
PATCH /api/staff/private-note/
```

Both endpoints require an authenticated clinic-bound session with an active clinic membership whose active workspace matches the permanent account role.

`PATCH` accepts the complete plain-text `content` value, including an empty string.

## Browser demo parity

The Pages adapter follows the same product rules:

- one private text value per personal demo account;
- the value follows that account across demo clinic memberships;
- permanent Doctor/Assistant role is account-scoped;
- Doctor administrator access to Assistant workspace shows no sticky;
- minimized UI displays only **Private note**, never note content;
- the expanded header reports autosave state without exposing note text;
- desktop movement, resizing, and layout reset are keyboard-operable;
- layout state is not treated as persistent server data.

The public browser demo remains demonstration storage only and must not contain real Patient or sensitive personal information.
