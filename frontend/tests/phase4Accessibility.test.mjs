import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(name) {
  return readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");
}

test("shared Dialog isolates the background and only the top dialog owns focus", () => {
  const dialog = source("Dialog.jsx");
  const dialogStyles = source("dialog.css");
  assert.match(dialog, /role = "dialog"/);
  assert.match(dialog, /role=\{role\}/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /const dialogStack = \[\]/);
  assert.match(dialog, /data-dialog-layer="true"/);
  assert.match(dialog, /setAttribute\("inert", ""\)/);
  assert.match(dialog, /setAttribute\("aria-hidden", "true"\)/);
  assert.match(dialog, /topDialog\(\) !== entry/);
  assert.match(dialog, /event\.key === "Escape"/);
  assert.match(dialog, /event\.key !== "Tab"/);
  assert.match(dialog, /document\.addEventListener\("focusin"/);
  assert.match(dialog, /returnFocusSelector/);
  assert.match(dialog, /activeDialog\.panel\.contains\(entry\.opener\)/);
  assert.match(dialog, /focusElement\(selected\) \|\| focusElement\(entry\.opener\)/);
  assert.match(dialogStyles, /\[data-dialog-layer="true"\][\s\S]*?z-index: 1200 !important/);

  for (const file of ["AccountSettings.jsx", "ClinicTeam.jsx", "TrustedDevices.jsx", "TaskWorkspace.jsx", "ScheduleWorkspace.jsx", "PatientDetail.jsx"]) {
    assert.match(source(file), /import Dialog from "\.\/Dialog\.jsx"/);
    assert.doesNotMatch(source(file), /aria-modal="true"/);
  }
});

test("dialog close controls have contextual accessible names", () => {
  assert.match(source("AccountSettings.jsx"), /aria-label="Close account settings"/);
  assert.match(source("AccountSettings.jsx"), /aria-label="Close account danger zone"/);
  assert.match(source("ClinicTeam.jsx"), /aria-label="Close clinic team"/);
  assert.match(source("TrustedDevices.jsx"), /aria-label="Close trusted devices"/);
  assert.match(source("ScheduleWorkspace.jsx"), /aria-label="Close consultation details"/);
});

test("task views expose complete tabs and comment textarea names", () => {
  const workspace = source("TaskWorkspace.jsx");
  const parts = source("TaskParts.jsx");
  assert.match(workspace, /role="tablist"/);
  assert.equal((workspace.match(/role="tab"/g) ?? []).length, 2);
  assert.match(workspace, /aria-selected=\{view === "open"\}/);
  assert.match(workspace, /aria-selected=\{view === "history"\}/);
  assert.match(workspace, /role="tabpanel"/);
  assert.match(workspace, /ArrowRight/);
  assert.match(workspace, /returnFocusSelector="#new-task-trigger"/);
  assert.match(parts, /aria-label=\{`New comment on \$\{task\.title\}`\}/);
  assert.match(parts, /aria-label=\{`Edit \$\{commentLabel\}`\}/);
  assert.match(parts, /data-dialog-initial-focus/);
});

test("account menu supports menu keys, Escape, and a visible dialog return target", () => {
  const workspace = source("PatientWorkspaceView.jsx");
  assert.match(workspace, /id="workspace-account-trigger"/);
  assert.match(workspace, /aria-haspopup="menu"/);
  assert.match(workspace, /role="menu"/);
  assert.match(workspace, /role="menuitem"/);
  assert.match(workspace, /event\.key === "Escape"/);
  assert.match(workspace, /closeAndReturnFocus/);
  assert.match(workspace, /ArrowDown/);
  assert.match(workspace, /ArrowUp/);
  for (const file of ["AccountSettings.jsx", "ClinicTeam.jsx", "TrustedDevices.jsx"]) {
    assert.match(source(file), /returnFocusSelector="#workspace-account-trigger"/);
  }
});

test("nested account danger review leaves the parent dialog mounted", () => {
  const account = source("AccountSettings.jsx");
  const openDanger = account.slice(account.indexOf("phase8-danger-zone"), account.indexOf("{dangerOpen"));
  assert.match(openDanger, /setDangerOpen\(true\)/);
  assert.doesNotMatch(openDanger, /setOpen\(false\)/);
  assert.match(account, /Back to account settings/);
  assert.match(account, /setDangerOpen\(false\); setError\(null\)/);
});

test("repeated actions expose contextual accessible names", () => {
  const undo = source("UndoStack.jsx");
  const tasks = source("TaskParts.jsx");
  assert.match(undo, /aria-label=\{`Undo: \$\{action\.message\}`\}/);
  assert.match(tasks, /aria-label=\{`Mark \$\{task\.title\} done`\}/);
  assert.match(tasks, /aria-label=\{`Edit task \$\{task\.title\}`\}/);
  assert.match(tasks, /aria-label=\{`Delete task \$\{task\.title\}`\}/);
  assert.match(tasks, /const commentLabel = `comment by/);
  assert.match(tasks, /aria-label=\{`Delete \$\{commentLabel\}`\}/);
});

test("Patient deletion uses the shared alert dialog and owns its error", () => {
  const detail = source("PatientDetail.jsx");
  const controller = source("usePatientWorkspace.js");
  const ui = source("ui.jsx");
  assert.match(detail, /role="alertdialog"/);
  assert.match(detail, /returnFocusSelector="#delete-patient-trigger, #patient-search-input"/);
  assert.match(detail, /<ErrorMessage error=\{deleteError\} focus/);
  assert.match(detail, /data-dialog-initial-focus="true"/);
  assert.match(controller, /catch \(e\) \{ return asError\(e, "Patient could not be deleted\."\); \}/);
  assert.match(ui, /tabIndex=\{focus \? -1 : undefined\}/);
  assert.match(ui, /alertRef\.current\?\.focus\(\)/);
});

test("task editing replaces that task detail until Save or Cancel", () => {
  const workspace = source("TaskWorkspace.jsx");
  const parts = source("TaskParts.jsx");
  assert.doesNotMatch(workspace, /doctorAccount && formTask && <TaskForm/);
  assert.match(workspace, /editingTask \? <TaskForm/);
  assert.match(workspace, /taskEditActive=\{taskEditActive\}/);
  assert.match(workspace, /disabled=\{taskEditActive\}/);
  assert.match(parts, /detailsOpen && \(editing \? <div className="task-card__detail task-card__detail--editing">\{editForm\}/);
  assert.match(parts, /editing \? "Editing"/);
  assert.match(parts, /disabled=\{taskEditActive\}/);
});

test("account deletion is isolated from ordinary settings", () => {
  const account = source("AccountSettings.jsx");
  assert.match(account, /const tabs = \["profile", "security", "passkeys", "recovery"\]/);
  assert.doesNotMatch(account, /tab === "delete"/);
  assert.match(account, /phase8-danger-zone/);
  assert.match(account, /Review account deletion/);
  assert.match(account, /phase8-danger-dialog/);
  assert.match(account, /Back to account settings/);
});

test("private note announces autosave and supports keyboard movement and resizing", () => {
  const sticky = source("PrivateSticky.jsx");
  assert.match(sticky, /setSaveStatus\("saving"\)/);
  assert.match(sticky, /setSaveStatus\("saved"\)/);
  assert.match(sticky, /aria-live="polite"/);
  assert.match(sticky, /function moveWithKeyboard/);
  assert.match(sticky, /function resizeWithKeyboard/);
  assert.match(sticky, /aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"/);
  assert.doesNotMatch(sticky, /Reset private note position and size/);
  assert.doesNotMatch(sticky, />Reset<\/button>/);
});
