# Phase 6 — Shared tasks

Status: **Implemented according to the approved Doctor-to-Assistant task workflow, including the approved task attention-dot and New Task modal UX correction.**

Phase 6 adds one deliberately simple shared task area for clinic follow-up work. Tasks are separate from Appointments and Patient notes.

## Purpose

The Doctor can write a task for the Assistant. The Assistant opens the shared Tasks area, performs the work, and marks the task **Done**. The Doctor can see both open work and completed history.

There is no general assignment system in Phase 6. Every task is implicitly from the Doctor to the Assistant.

## Task fields

A task contains:

- title;
- description;
- optional due date, date only;
- optional association to one Patient;
- creation metadata;
- completion metadata;
- shared comments.

There are no task attachments in Phase 6.

## Roles and permissions

### Doctor account

The Doctor may:

- create tasks;
- edit tasks created by that Doctor account;
- delete open or completed tasks;
- mark a task Done if needed;
- view Open tasks and completed History;
- add comments;
- edit/delete only the Doctor's own comments.

Doctor permissions are based on the authenticated Doctor account identity, not the selected workspace. Therefore Doctor credentials retain Doctor task-authoring rights when the Doctor opens Assistant workspace.

When the Assistant completes a task, the Doctor receives a small red attention dot beside the **Tasks** workspace tab. Opening Tasks clears that dot.

### Assistant account

The Assistant may:

- view all shared tasks;
- open a task and read its details;
- mark an Open task Done;
- view completed History;
- add comments;
- edit/delete only the Assistant's own comments.

The Assistant cannot create, edit, or delete tasks.

When the Doctor creates a new task, the Assistant receives a small red attention dot beside the **Tasks** workspace tab. Opening Tasks clears that dot.

## Visibility

The same clinic-scoped task data is visible in both Doctor and Assistant workspaces.

Open tasks are listed oldest first so older unfinished work naturally remains at the top.

Completed tasks disappear from the normal Open view and remain available in **History**. History is not a second workflow state; it is simply the view containing `DONE` tasks.

The red attention dot is role-specific account state rather than workspace state:

- Assistant account: new Doctor-created task since Tasks was last viewed;
- Doctor account: task completed by the Assistant since Tasks was last viewed.

Opening Tasks marks current task activity as seen. While Tasks remains open, the lightweight refresh keeps that view state current. Existing tasks from before this attention feature was introduced are initialized as already seen and do not all appear as new.

## New Task form UX

Clicking **New task** opens the create form in a compact modal dialog instead of inserting the form above the Open task list. The underlying task list remains visually stable while the Doctor creates a task.

The existing task fields and permissions are unchanged by this presentation change.

## Lifecycle

```text
OPEN → DONE
```

There are no In progress, Blocked, Cancelled, reassignment, or other task states in Phase 6.

Both staff accounts may perform the Done action. The normal workflow is that the Assistant completes the Doctor's task.

### Five-second Undo for Done

Marking Done is a discrete operational action and receives the project's server-enforced five-second Undo.

```text
OPEN → DONE → Undo within five seconds → OPEN
```

After the five-second period expires, there is no permanent **Reopen** action in Phase 6.

## Due date

Due date is optional and contains a calendar date only.

Phase 6 does not add:

- due-time fields;
- overdue workflow states;
- reminders;
- due-date notifications.

## Patient association

A task may optionally refer to one existing Patient. General clinic tasks may have no Patient.

When present, the Patient name is clickable from the Tasks area and opens the Patient profile. Tasks are not embedded into the Patient profile in Phase 6.

If the linked Patient is later soft-deleted, the active task remains valid but the deleted Patient is no longer exposed as an active Patient link.

## Comments

Doctor and Assistant may both add comments to a task.

Each comment belongs to its author:

- only the author may edit it;
- only the author may delete it;
- the Doctor administrator cannot edit or delete the Assistant's comment;
- an edited comment shows a subtle **Edited** indicator;
- visible revision history is not stored as a user-facing feature.

Comment deletion uses the same server-enforced five-second Undo rule.

## Task deletion

Only the Doctor may delete a task, whether it is Open or Done.

Deletion is a soft deletion with a server-enforced five-second Undo. During deletion the task is removed from both Open and History views. Undo restores it to its prior state.

## Attention indicator, notifications, and refresh

The red Tasks-tab dot is a lightweight in-app attention indicator. It is intentionally not a notification system: there is no task sound, browser push, operating-system notification, popup alert, badge count, email, assignment alert, comment alert, or due-date alert.

The existing Room ready call remains the clinic's only sound/persistent call-style notification behavior.

The task list and task attention state use the existing lightweight authenticated polling approach so Doctor and Assistant computers see current state without introducing a broader notification architecture.

## Browser demo parity

The public browser-only demo mirrors:

- Doctor-account task permissions;
- shared Open and History views;
- optional due date and Patient association;
- Done and five-second Undo;
- Doctor-only deletion and Undo;
- shared comment ownership/edit/delete rules;
- comment deletion Undo;
- role-specific Tasks-tab attention dots and seen state;
- compact New Task modal behavior in the shared frontend.

The browser demo remains demonstration storage only and must not contain real Patient information.
