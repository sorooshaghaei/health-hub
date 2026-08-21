import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(name) {
  return readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");
}

test("shared Dialog traps focus, closes with Escape, and restores the opener", () => {
  const dialog = source("Dialog.jsx");
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /event\.key === "Escape"/);
  assert.match(dialog, /event\.key !== "Tab"/);
  assert.match(dialog, /returnFocusSelector/);
  assert.match(dialog, /target\.focus\(\)/);

  for (const file of ["AccountSettings.jsx", "ClinicTeam.jsx", "TrustedDevices.jsx", "TaskWorkspace.jsx", "ScheduleWorkspace.jsx"]) {
    assert.match(source(file), /import Dialog from "\.\/Dialog\.jsx"/);
    assert.doesNotMatch(source(file), /role="dialog"/);
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
  assert.match(parts, /aria-label="New comment"/);
  assert.match(parts, /aria-label="Edit comment"/);
  assert.match(parts, /data-dialog-initial-focus/);
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
