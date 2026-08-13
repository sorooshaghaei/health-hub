# Phase 6 — Shared tasks

Status: **Implemented according to the approved Doctor-to-Assistant task workflow.**

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

### Assistant account

The Assistant may:

- view all shared tasks;
- open a task and read its details;
- mark an Open task Done;
- view completed History;
- add comments;
- edit/delete only the Assistant's own comments.

The Assistant cannot create, edit, or delete tasks.

## Visibility

The same clinic-scoped task data is visible in both Doctor and Assistant workspaces.

Open tasks are listed oldest first so older unfinished work naturally remains at the top.

Completed tasks disappear from the normal Open view and remain available in **History**. History is not a second workflow state; it is simply the view containing `DONE` tasks.

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

## Notifications and refresh

Phase 6 adds no sound, push, badge-alert, assignment, comment, due-date, or completion notification.

The existing Room ready call remains the clinic's only notification behavior.

The shared task list refreshes through the existing lightweight authenticated polling approach so Doctor and Assistant computers see current state without introducing a notification system.

## Browser demo parity

The public browser-only demo mirrors:

- Doctor-account task permissions;
- shared Open and History views;
- optional due date and Patient association;
- Done and five-second Undo;
- Doctor-only deletion and Undo;
- shared comment ownership/edit/delete rules;
- comment deletion Undo.

The browser demo remains demonstration storage only and must not contain real Patient information.
