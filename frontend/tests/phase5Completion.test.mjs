import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Room ready discloses completion and preserves Patient context for Undo", async () => {
  const schedule = await source("../src/ScheduleWorkspace.jsx");
  const demo = await source("../src/demoApiCore.js");

  assert.match(schedule, /Complete Patient and signal room ready/);
  assert.match(
    schedule,
    /This completes the current Patient and signals that the room is ready for the next Patient\./,
  );
  assert.match(
    schedule,
    /Completed \$\{payload\.previous_visit\.patient\.full_name\} and signaled room ready for the next Patient\./,
  );
  assert.match(demo, /previous_visit: currentVisit \? publicVisit\(store, currentVisit\) : null/);
});

test("completion documentation describes the disclosed combined action", async () => {
  const readme = await source("../../README.md");
  const phase4 = await source("../../docs/PHASE_4_CONSULTATION.md");
  const phase5 = await source("../../docs/PHASE_5_COMPLETION.md");

  for (const document of [readme, phase4, phase5]) {
    assert.match(document, /\*\*Complete Patient and signal room ready\*\*/);
    assert.match(document, /Patient identity/);
  }
});
