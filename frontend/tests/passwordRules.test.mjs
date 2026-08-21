import assert from "node:assert/strict";
import test from "node:test";

import { passwordRequirements } from "../src/passwordRules.js";

const personalValues = ["Demo", "Doctor", "doctor@example.com", "+33123456789"];

test("password strength is invalid whenever a displayed requirement fails", () => {
  const personal = passwordRequirements(
    "Strong-demo-password-123",
    "Strong-demo-password-123",
    personalValues,
  );
  assert.equal(personal.avoidsPersonal, false);
  assert.equal(personal.strength, "Invalid");
  assert.equal(personal.valid, false);

  const numeric = passwordRequirements("123456789", "123456789", personalValues);
  assert.equal(numeric.notNumeric, false);
  assert.equal(numeric.strength, "Invalid");
  assert.equal(numeric.valid, false);
});

test("password submission is enabled only for a matching pair that passes known checks", () => {
  const safe = passwordRequirements(
    "Strong-clinic-password-123!",
    "Strong-clinic-password-123!",
    personalValues,
  );
  assert.equal(safe.strength, "Strong");
  assert.equal(safe.valid, true);

  const mismatch = passwordRequirements(
    "Strong-clinic-password-123!",
    "different-password-123!",
    personalValues,
  );
  assert.equal(mismatch.matches, false);
  assert.equal(mismatch.valid, false);

  const common = passwordRequirements("password", "password", personalValues);
  assert.equal(common.notKnownCommon, false);
  assert.equal(common.strength, "Invalid");
  assert.equal(common.valid, false);
});
