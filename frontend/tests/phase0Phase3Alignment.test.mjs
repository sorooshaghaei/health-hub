import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { dateValueInTimeZone, timeValueInTimeZone } = await import("../src/clinicTime.js");

test("clinic timezone helpers use the clinic day instead of the viewing browser day", () => {
  const instant = new Date("2026-01-01T12:30:00.000Z");
  assert.equal(dateValueInTimeZone("Pacific/Kiritimati", instant), "2026-01-02");
  assert.equal(timeValueInTimeZone("Pacific/Kiritimati", instant), "02:30");
  assert.equal(dateValueInTimeZone("Pacific/Honolulu", instant), "2026-01-01");
  assert.equal(timeValueInTimeZone("Pacific/Honolulu", instant), "02:30");
});

test("clinic creation captures browser timezone without adding a visible form field", async () => {
  const api = await readFile(new URL("../src/api.js", import.meta.url), "utf8");
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");

  assert.match(api, /path !== "\/api\/clinics\/"/);
  assert.match(api, /timezone: browserTimeZone\(\)/);
  assert.doesNotMatch(app, /Field label="(?:Clinic )?Timezone"/i);
});

test("current trusted device is not removable in the shared UI and demo transport", async () => {
  const devices = await readFile(new URL("../src/TrustedDevices.jsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../src/api.js", import.meta.url), "utf8");

  assert.match(devices, /disabled=\{device\.current \|\| removing === device\.id\}/);
  assert.match(devices, /Current device/);
  assert.match(api, /The current trusted device cannot be removed\./);
  assert.match(api, /session\?\.device_id === match\[1\]/);
});
