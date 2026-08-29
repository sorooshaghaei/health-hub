import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Doctor administrator mode has a persistent return banner without a duplicate clinic status pill", async () => {
  const workspace = await source("../src/PatientWorkspaceView.jsx");
  const styles = await source("../src/styles.css");

  assert.match(workspace, /doctorAccount && assistantWorkspace && <aside className="administrator-banner">/);
  assert.match(workspace, /Viewing Assistant workspace as Doctor administrator/);
  assert.match(workspace, /Return to Doctor workspace/);
  assert.doesNotMatch(workspace, /className="status-pill"/);
  assert.match(styles, /\.workspace-title h1 \{[^}]*font-size: clamp\(32px, 3\.3vw, 40px\)/);
});

test("empty clinic cards collapse naturally and empty content stays compact", async () => {
  const schedule = await source("../src/ScheduleWorkspace.jsx");
  const base = await source("../src/styles.css");
  const appointments = await source("../src/phase2.css");
  const queue = await source("../src/phase3.css");

  assert.match(schedule, /live-queue-card\$\{!queueLoading && !queue\.length \? " workspace-card--empty"/);
  assert.match(schedule, /phase2-card\$\{mode === "list" && !loading && !visits\.length \? " workspace-card--empty"/);
  assert.match(base, /\.empty-state \{ min-height: 120px;/);
  assert.match(appointments, /\.phase2-card \{\s*min-height: 0;/);
  assert.match(appointments, /\.schedule-empty \{[\s\S]*?min-height: 100px;/);
  assert.match(queue, /\.live-queue-card \{\s*min-height: 0;/);
  assert.match(
    queue,
    /\.live-queue-card\.workspace-card--empty \.schedule-empty \{\s*min-height: 0;\s*padding: 18px 12px 0;/,
  );
  assert.doesNotMatch(
    queue,
    /\.live-queue-card\.workspace-card--empty \.schedule-empty \{\s*min-height: 100px;/,
  );
});

test("Appointment rows show workflow status once in the status chip", async () => {
  const schedule = await source("../src/ScheduleWorkspace.jsx");
  const visitTime = schedule.match(/<div className="visit-time">[\s\S]*?<\/div>/)?.[0];

  assert.ok(visitTime);
  assert.match(visitTime, /<strong>\{formatTime\(visit\.scheduled_time\)\}<\/strong>/);
  assert.doesNotMatch(visitTime, /statusLabel\(visit\.status\)/);
  assert.match(
    schedule,
    /<span className=\{`status-chip status-chip--\$\{visit\.status\}`\}>\s*\{statusLabel\(visit\.status\)\}/,
  );
});

test("shared form controls and operational metadata meet the corrected type scale", async () => {
  const base = await source("../src/styles.css");
  const appointments = await source("../src/phase2.css");
  const queue = await source("../src/phase3.css");
  const workspaceUsability = await source("../src/workspaceUsability.css");

  assert.match(base, /input, select, textarea \{ font-size: 15px; \}/);
  assert.match(base, /@media \(max-width: 680px\)[\s\S]*?input, select, textarea \{ font-size: 16px; \}/);
  assert.match(base, /--control-height-standard: 44px;/);
  assert.match(appointments, /\.patient-context small,[\s\S]*?font-size: 12px;/);
  assert.match(queue, /\.status-chip \{[\s\S]*?font-size: 12px;/);
  assert.match(queue, /\.queue-fact small,[\s\S]*?font-size: 12px;/);
  assert.match(workspaceUsability, /\.task-status,[\s\S]*?font-size: 12px;/);
  assert.match(workspaceUsability, /\.task-field \{\s*font-size: 14px;/);
});

test("schedule, settings, and dialog touch controls expose 44px targets without denser hour rows", async () => {
  const hours = await source("../src/workingHours.css");
  const settings = await source("../src/phase8.css");
  const devices = await source("../src/deviceAccess.css");
  const consultation = await source("../src/phase4.css");

  assert.match(hours, /\.clinic-hours-row \{\s*padding-block: 8px;/);
  assert.match(hours, /\.clinic-hours-toggle \{\s*min-height: var\(--control-height-standard\);\s*width: 100%;/);
  assert.match(hours, /\.clinic-hours-times label \{\s*font-size: 14px;/);
  assert.match(hours, /\.clinic-hours-times input \{\s*min-height: var\(--control-height-standard\);/);
  assert.match(settings, /\.phase8-settings-tab \{\s*min-width: var\(--control-height-standard\);\s*min-height: var\(--control-height-standard\);\s*font-size: 15px;/);
  assert.match(devices, /\.device-icon-button \{[\s\S]*?width: var\(--control-height-standard\);\s*height: var\(--control-height-standard\);/);
  assert.match(consultation, /\.modal-close-button \{[\s\S]*?width: var\(--control-height-standard\);\s*height: var\(--control-height-standard\);/);
});

test("the private note starts below the workspace header and reserves the Undo lane", async () => {
  const sticky = await source("../src/PrivateSticky.jsx");
  const geometry = await source("../src/privateStickyGeometry.js");
  const stickyStyles = await source("../src/phase7.css");
  const base = await source("../src/styles.css");
  const queue = await source("../src/phase3.css");

  assert.match(sticky, /constrainPrivateStickyFrame/);
  assert.match(sticky, /constrainPrivateStickyMinimized/);
  assert.match(geometry, /STICKY_WORKSPACE_HEADER_HEIGHT = 76/);
  assert.match(geometry, /STICKY_UNDO_LANE_RESERVE = 104/);
  assert.match(geometry, /STICKY_WORKSPACE_HEADER_HEIGHT \+ STICKY_EDGE_MARGIN/);
  assert.match(geometry, /viewportHeight - STICKY_UNDO_LANE_RESERVE - STICKY_EDGE_MARGIN/);
  assert.match(geometry, /x: clamp\([^\n]+bounds\.left, bounds\.right - width\)/);
  assert.match(geometry, /y: clamp\([^\n]+bounds\.top, bounds\.bottom - height\)/);
  assert.doesNotMatch(sticky, /setMinimizedPosition\([^)]*\);\s*setMinimized\(true\)/);
  assert.match(stickyStyles, /\.private-sticky\{[^}]*z-index:4;/);
  assert.match(stickyStyles, /\.private-sticky--open\{[^}]*z-index:60;/);
  assert.match(base, /\.workspace-header \{[^}]*z-index: 20;/);
  assert.match(base, /\.workspace-account-menu__panel \{[^}]*z-index: 40;/);
  assert.match(queue, /\.undo-stack \{[\s\S]*?z-index: 110;/);
});

test("private-note documentation keeps the approved no-Reset safety contract", async () => {
  const phase7 = await source("../../docs/PHASE_7_PRIVATE_NOTES.md");
  const readme = await source("../../README.md");

  assert.doesNotMatch(phase7, /Reset returns position and size/);
  assert.doesNotMatch(readme, /Reset restores the safe default layout/);
  assert.match(phase7, /there is no Reset control/);
  assert.match(readme, /there is no Reset control/);
});
