# Phase 7 — Private sticky

Status: **Implemented according to the approved single-scratchpad workflow.**

## Purpose

Each staff member has one private piece of virtual sticky-note paper for temporary personal reminders. It is deliberately not a notes collection, task system, Patient record, or daily log.

Example content:

```text
I have to call Suzi
Today there is a coffee shop I should go to
My husband called
```

The same text remains on later days until its owner erases or replaces it.

## Data and editing

- one text value per staff account;
- plain text and line breaks only;
- no title and no second note;
- direct editing at any time;
- autosave to the backend while typing;
- no routine **Saving…** or **Saved** indicator;
- clearing every character saves an empty scratchpad;
- no Delete action, Trash, five-second Undo, revision history, or **Edited** label.

## Privacy and workspace placement

| Signed-in account | Active workspace | Sticky result |
| --- | --- | --- |
| Doctor | Doctor | Doctor's private sticky |
| Assistant | Assistant | Assistant's private sticky |
| Doctor administrator | Assistant | No private sticky |
| Assistant | Doctor | Access is not permitted |

The Doctor cannot read the Assistant's text. Doctor administrator access to Assistant workspace also does not carry the Doctor's own sticky into that workspace. The backend rejects private-note reads and writes whenever account role and active workspace do not match.

## Desktop interaction

- the sticky is fixed to the browser viewport, not placed in document flow;
- it remains reachable while the page scrolls;
- its minimized state is a small yellow strip placed at the lower-right;
- the minimized strip can be dragged elsewhere within the viewport;
- maximizing opens the same scratchpad;
- the opened sticky can be dragged and resized within the viewport;
- minimizing returns it to the lower-right;
- there is no Close button and no separate Notes tab or Open-note workflow.

## Mobile interaction

- the minimized strip sits near the lower edge and remains movable within the viewport;
- maximizing opens a full-screen plain-text editor;
- minimizing returns to the movable strip;
- there is no Close action.

## Explicit exclusions

- multiple notes or note ordering;
- titles, rich text, formatting controls, or color choices;
- Patient links or appearance inside Patient profiles;
- task conversion, due dates, reminders, notifications, or badges;
- attachments, search, archive, history, or collaborative access.

## API

```text
GET   /api/staff/private-note/
PATCH /api/staff/private-note/
```

Both endpoints require an authenticated staff session whose account role matches the active workspace. `PATCH` accepts the complete plain-text `content` value, including an empty string.

## Browser demo and validation

The Pages adapter stores the same one-text-value-per-account structure in browser-local demo data. Migration initializes older demo staff records with an empty private note. Automated tests cover independent Doctor/Assistant text, blank-page persistence, authentication, and the Doctor-administrator Assistant-workspace denial.
