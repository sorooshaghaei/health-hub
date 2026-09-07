import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("release-ready UI wording matches the approved replacement table", async () => {
  const readme = await source("../../README.md");
  const app = await source("../src/App.jsx");
  const account = await source("../src/AccountSettings.jsx");
  const patient = await source("../src/patientForm.jsx");
  const appointment = await source("../src/VisitForm.jsx");
  const schedule = await source("../src/ScheduleWorkspace.jsx");
  const hours = await source("../src/ClinicWorkingHours.jsx");
  const team = await source("../src/ClinicTeam.jsx");

  assert.match(readme, /Product Phases 0–9 and Design Steps 1–5 are implemented and reconciled on `main`\./);
  assert.match(app, /Sign in or create your \$\{label\} account\./);
  assert.match(app, /Use your email address or phone number with a password, or use a passkey\./);
  assert.match(app, /Verify both your personal email address and phone number before accessing a clinic\./);
  assert.match(app, /placeholder="\+33 6 12 34 56 78"/);
  assert.match(app, /const editLabel = kind === "email" \? "Edit email address" : "Edit phone number"/);
  assert.doesNotMatch(app, /Continue with your \$\{label\} personal account|Email or phone \+ password|Both personal email and phone must be verified before clinic access|>Change \{kind\}</);

  assert.match(account, />Account settings<\/Button>/);
  assert.match(account, />Profile saved\.<\/span>/);
  assert.match(patient, /<span>Phone country or region<\/span>/);
  assert.match(patient, /label="Date of birth \(optional\)"/);
  assert.match(patient, /label="Patient note \(optional\)"/);
  assert.match(appointment, /visit \? "Save appointment" : "Create appointment"/);
  assert.match(appointment, /visit \? "Edit appointment" : "Appointment details"/);
  assert.match(hours, /Set one working-hours range for each day the clinic is open\./);
  assert.match(schedule, /Complete Patient and signal room ready/);
  assert.match(schedule, /This completes the current Patient and signals that the room is ready for the next Patient\./);
  assert.match(team, /This code is shown once and expires at/);
  assert.match(team, /activeSetup \? "Replace setup code"/);
});

test("handoff documentation identifies Phase 10 as the next clarified unit", async () => {
  const readme = await source("../../README.md");
  const plan = await source("../../docs/DEVELOPMENT_PLAN.md");
  const context = await source("../../docs/PROJECT_CONTEXT.md");
  const phase9 = await source("../../docs/PHASE_9_PATIENT_ATTACHMENTS.md");
  const qualityWorkflow = await source("../../.github/workflows/quality.yml");
  const pagesWorkflow = await source("../../.github/workflows/pages.yml");

  assert.match(readme, /npx playwright install --with-deps chromium[\s\S]*npm run test:browser/);
  assert.match(plan, /\| 8 \| Authentication, administration, recovery, multi-clinic identity \| \*\*Implemented; release-audit remediation complete\*\* \|/);
  assert.match(plan, /\| 9 \| Secure Patient attachments \| \*\*Complete and reconciled\*\* \|/);
  assert.match(phase9, /\*\*Phase 9 is complete and reconciled\.\*\*/);
  assert.doesNotMatch(plan, /release-audit remediation in progress/);
  assert.match(context, /accounts\.0011_trusted_device_last_used_at/);
  assert.match(context, /Start Product Phase 10 by reading this context and `DEVELOPMENT_PLAN\.md`, then ask the product owner the production-infrastructure and security clarification questions before implementing anything\./);
  assert.doesNotMatch(context, /Continue the approved release-readiness audit remediation/);
  assert.match(qualityWorkflow, /run: npm ci/);
  assert.match(pagesWorkflow, /run: npm ci/);
  assert.doesNotMatch(`${qualityWorkflow}\n${pagesWorkflow}`, /run: npm install/);
});
