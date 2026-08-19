# Phase 6 — Shared tasks

Status: **Reconciled with the final permanent-role account architecture and implemented in the repository.**

Phase 6 provides one deliberately simple shared task area for clinic follow-up work. Tasks are separate from Appointments, Patient notes, and private sticky notes.

## Purpose

A Doctor account with an active membership in the clinic can create a task for the Assistant. The Assistant can perform the work and mark the task **Done**. The Doctor can see both Open work and completed History.

There is no general assignment system. Every task is implicitly Doctor-to-Assistant work for one clinic.

## Clinic scope

Shared tasks are strictly clinic-scoped.

- Clinic A and Clinic B have independent Open and History lists.
- A task can reference only a Patient from the same clinic.
- Task attention state is stored on the active `StaffMembership`, so viewing Tasks in one clinic never clears another clinic's attention state.
- Switching clinics changes the visible task set and attention state to the selected clinic only.

## Task fields

A task contains:

- title;
- description;
- optional due date, date only;
- optional association to one Patient in the same clinic;
- creation metadata;
- completion metadata;
- shared comments.

There are no task attachments in Phase 6.

## Account roles and permissions

The permanent personal account role determines Doctor/Assistant task authority. The active membership determines which clinic's tasks can be accessed. Workspace selection does not change the person's task role.

### Doctor account

A Doctor account with an active membership in the clinic may:

- create tasks;
- edit tasks originally created by that same personal account;
- delete Open or Done tasks in the active clinic;
- mark an Open task Done if needed;
- view Open tasks and completed History;
- add comments;
- edit/delete only that person's own comments.

A Doctor retains Doctor task permissions when opening Assistant workspace as administrator because the personal account remains Doctor.

Task authorship is personal. Editing an existing task is restricted to the Doctor account that originally created it. Clinic-level task deletion is available to the active Doctor account for that clinic.

When the active Assistant account completes a task, the Doctor's clinic membership receives a small red attention dot beside **Tasks**. Opening Tasks for that clinic clears only that Doctor membership's attention state for that clinic.

If the Doctor marks a task Done personally, the Doctor does not generate an attention dot for their own completion.

### Assistant account

An Assistant account with an active membership in the clinic may:

- view all shared tasks in that clinic;
- open a task and read its details;
- mark an Open task Done;
- view completed History;
- add comments;
- edit/delete only that person's own comments.

An Assistant account cannot create, edit, or delete tasks.

When the Doctor creates a task, the Assistant's membership in that clinic receives a small red attention dot beside **Tasks**. Opening Tasks clears only that Assistant membership's attention state for the active clinic.

## Visibility and attention state

The same clinic-scoped task data is visible from Doctor and Assistant workspaces when the signed-in account has an active membership in that clinic.

Open tasks are listed oldest first so older unfinished work remains at the top.

Done tasks disappear from the normal Open view and remain available in **History**. History is a view over `DONE` tasks, not a separate workflow state.

The red attention dot is membership-scoped even though role is account-scoped:

- Assistant membership: a Doctor-created task exists since that clinic membership last viewed Tasks;
- Doctor membership: an Assistant completed a task since that clinic membership last viewed Tasks.

Opening Tasks marks current task activity as seen for the active clinic membership only. While Tasks remains open, lightweight polling keeps both the list and seen state current.

## New Task UX

Clicking **New task** opens the create form in a compact modal dialog. The Open task list remains visually stable underneath it.

The modal uses the shared accessible dialog behavior: focus enters the title field, Tab remains contained, Escape and Cancel close it when a save is not in progress, and focus returns to **New task**. The presentation does not change task fields or permissions.

Open and History expose complete tab semantics, including selected state, associated tab panels, and Left/Right/Home/End keyboard navigation. New- and edit-comment textareas have explicit accessible names rather than relying on placeholder text.

## Lifecycle

```text
OPEN → DONE
```

There are no In progress, Blocked, Cancelled, reassignment, or other task states.

Both Doctor and Assistant accounts with an active membership in the clinic may perform the Done action. The normal workflow is that the Assistant completes the Doctor's task.

### Five-second Undo for Done

Marking Done is a discrete operational action and receives the project's server-enforced five-second Undo.

```text
OPEN → DONE → Undo within five seconds → OPEN
```

After that five-second period expires, there is no permanent **Reopen** action.

## Due date

Due date is optional and contains a calendar date only.

Phase 6 does not add:

- due-time fields;
- overdue workflow states;
- reminders;
- due-date notifications.

Because no automatic overdue behavior exists, the due date is simply stored and displayed as the chosen clinic calendar date; no additional timezone-driven task logic is introduced.

## Patient association

A task may optionally refer to one existing active Patient in the same clinic. General clinic tasks may have no Patient.

When present, the Patient name is clickable from Tasks and opens that Patient profile. Tasks are not embedded into the Patient profile in Phase 6.

A Patient from another clinic cannot be associated with the task.

If the linked Patient is later soft-deleted, the task remains valid but the deleted Patient is no longer exposed as an active Patient link.

## Comments and historical authorship

Doctor and Assistant may both add comments to Open and Done tasks.

Each comment belongs to its personal author:

- only the author may edit it;
- only the author may delete it;
- Doctor administrator access cannot edit or delete another person's comment;
- an edited comment shows a subtle **Edited** indicator;
- visible revision history is not a user-facing feature.

If an Assistant's clinic membership is later deactivated or replaced, historical comments remain attached to the original personal account. In that clinic the historical author is represented as a former Assistant, and a replacement Assistant cannot edit or delete those comments.

If the old Assistant later reaches the two-year dormant anonymization threshold defined by Phase 8, the minimal retained historical identity continues to display **Former Assistant**.

Comment deletion uses the server-enforced five-second Undo rule.

## Task deletion

Only the Doctor account with an active membership in the clinic may delete a task, whether it is Open or Done.

Deletion is soft deletion with a server-enforced five-second Undo. During deletion the task is removed from both Open and History. Undo restores its previous state.

## Notifications and refresh

The red Tasks-tab dot is a lightweight in-app attention indicator, not a general notification system.

There is no task:

- sound;
- popup alert;
- browser push;
- operating-system notification;
- badge count;
- email/SMS alert;
- comment alert;
- due-date alert.

The existing Room ready call remains the clinic's only sound/persistent call-style notification behavior.

Task lists and attention state use the existing authenticated three-second polling approach.

## Browser demo parity

The public browser-only adapter mirrors the same production React task behavior and clinic-scoped task model, including:

- Doctor-account task permissions even from Assistant workspace administrator access;
- shared Open and History views;
- optional due date and same-clinic Patient association;
- Done and five-second Undo;
- Doctor-only deletion and Undo;
- shared comment ownership/edit/delete rules;
- comment deletion Undo;
- clinic-membership-scoped Tasks-tab attention dots and seen state;
- compact, keyboard-accessible New Task modal behavior;
- fully named comment fields and complete Open/History tab semantics.

The browser demo remains demonstration storage only and must not contain real Patient information.
