import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const scheduleWorkspace = await readFile(new URL("../src/ScheduleWorkspace.jsx", import.meta.url), "utf8");
const visitForm = await readFile(new URL("../src/VisitForm.jsx", import.meta.url), "utf8");
const phase2Styles = await readFile(new URL("../src/phase2.css", import.meta.url), "utf8");
const appointmentFlowStyles = await readFile(new URL("../src/appointmentFlowRefresh.css", import.meta.url), "utf8");

test("Appointment and queue Patient names retain the complete value for pointer and assistive access", () => {
  assert.match(
    scheduleWorkspace,
    /<strong title=\{patient\.full_name\}>\{patient\.full_name\}<\/strong>/,
  );
  assert.match(
    visitForm,
    /<strong title=\{patient\.full_name\}>\{patient\.full_name\}<\/strong>/,
  );
});

test("Appointment and queue Patient names wrap to two lines before truncation", () => {
  assert.match(
    phase2Styles,
    /\.patient-context strong \{[\s\S]*?display: -webkit-box;[\s\S]*?-webkit-line-clamp: 2;[\s\S]*?white-space: normal;/,
  );
  assert.match(
    appointmentFlowStyles,
    /\.patient-suggestion__identity strong \{[\s\S]*?display: -webkit-box;[\s\S]*?-webkit-line-clamp: 2;[\s\S]*?white-space: normal;/,
  );
});
