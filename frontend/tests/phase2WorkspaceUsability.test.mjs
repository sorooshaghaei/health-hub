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
});

test("shared form controls and operational metadata meet the corrected type scale", async () => {
  const base = await source("../src/styles.css");
  const appointments = await source("../src/phase2.css");
  const queue = await source("../src/phase3.css");
  const workspaceUsability = await source("../src/workspaceUsability.css");

  assert.match(base, /input, select, textarea \{ font-size: 15px; \}/);
  assert.match(base, /@media \(max-width: 680px\)[\s\S]*?input, select, textarea \{ font-size: 16px; \}/);
  assert.match(base, /--control-height-standard: 44px;/);
  assert.match(appointments, /\.visit-time small,[\s\S]*?font-size: 12px;/);
  assert.match(queue, /\.status-chip \{[\s\S]*?font-size: 12px;/);
  assert.match(queue, /\.queue-fact small,[\s\S]*?font-size: 12px;/);
  assert.match(workspaceUsability, /\.task-status,[\s\S]*?font-size: 12px;/);
  assert.match(workspaceUsability, /\.task-field \{\s*font-size: 14px;/);
});

test("the private note reserves the Undo lane and Undo stays on top", async () => {
  const sticky = await source("../src/PrivateSticky.jsx");
  const queue = await source("../src/phase3.css");

  assert.match(sticky, /const UNDO_LANE_RESERVE = 104;/);
  assert.match(sticky, /viewport\.height - MINIMIZED_HEIGHT - EDGE_MARGIN - UNDO_LANE_RESERVE/);
  assert.match(sticky, /availableHeight = Math\.max\(0, viewport\.height - UNDO_LANE_RESERVE\)/);
  assert.match(queue, /\.undo-stack \{[\s\S]*?z-index: 110;/);
});
