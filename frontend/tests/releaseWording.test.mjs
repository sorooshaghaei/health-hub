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

  assert.match(readme, /The Phase 9 attachment contract is approved, and Part 1—the private backend storage\/API foundation—is implemented\./);
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

test("handoff documentation identifies the next Phase 9 part", async () => {
  const readme = await source("../../README.md");
  const plan = await source("../../docs/DEVELOPMENT_PLAN.md");
  const context = await source("../../docs/PROJECT_CONTEXT.md");

  assert.match(readme, /npx playwright install --with-deps chromium[\s\S]*npm run test:browser/);
  assert.match(plan, /\| 8 \| Authentication, administration, recovery, multi-clinic identity \| \*\*Implemented; release-audit remediation complete\*\* \|/);
  assert.match(plan, /\| 9 \| Secure Patient attachments \| \*\*In progress; approved contract and backend foundation complete\*\* \|/);
  assert.doesNotMatch(plan, /release-audit remediation in progress/);
  assert.match(context, /accounts\.0011_trusted_device_last_used_at/);
  assert.match(context, /Part 2 is the production Patient-profile attachment interface\./);
  assert.doesNotMatch(context, /Continue the approved release-readiness audit remediation/);
});
