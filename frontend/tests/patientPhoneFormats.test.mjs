import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  COUNTRY_CODES,
  normalizePatientPhone,
  patientPhoneParts,
  phonePlaceholderForCallingCode,
} from "../src/patientPhoneFormats.js";

const patientFormSource = await readFile(new URL("../src/patientForm.jsx", import.meta.url), "utf8");

test("phone placeholders follow the selected country and show a valid French domestic shape", () => {
  assert.equal(phonePlaceholderForCallingCode("+98"), "000 000 00 00");
  assert.equal(phonePlaceholderForCallingCode("+33"), "06 12 34 56 78");
  assert.equal(phonePlaceholderForCallingCode("+974"), "0000 0000");
  assert.equal(phonePlaceholderForCallingCode("+000"), "000 000 0000");

  for (const country of COUNTRY_CODES) {
    assert.match(country.region, /^[A-Z]{2}$/);
    assert.ok(country.placeholder.length >= 8);
  }
});

test("French domestic, national, and international inputs normalize to one E.164 value", () => {
  const expected = {
    country_calling_code: "+33",
    phone_number: "612345678",
    phone_e164: "+33612345678",
  };
  assert.deepEqual(normalizePatientPhone("+33", "06 12 34 56 78"), expected);
  assert.deepEqual(normalizePatientPhone("+33", "6 12 34 56 78"), expected);
  assert.deepEqual(normalizePatientPhone("+33", "+33 6 12 34 56 78"), expected);
});

test("selected country must match a full international Patient number", () => {
  assert.throws(
    () => normalizePatientPhone("+33", "+98 912 123 4567"),
    /must match the selected country or region/,
  );
});

test("Patient phone guidance names the selector and explains accepted normalization", () => {
  assert.match(patientFormSource, /Phone country or region/);
  assert.match(patientFormSource, /domestic number or a matching full international number/);
  assert.match(patientFormSource, /saves it in E\.164 format/);
});

test("country calling codes remain unique", () => {
  const codes = COUNTRY_CODES.map((country) => country.code);
  assert.equal(new Set(codes).size, codes.length);
});

test("legacy Patient phone values are reconstructed from E.164 for editing", () => {
  assert.deepEqual(
    patientPhoneParts({ phone_e164: "+989120000000" }),
    { country_calling_code: "+98", phone_number: "9120000000" },
  );
  assert.deepEqual(
    patientPhoneParts({ country_calling_code: "+33", phone_e164: "+33612345678" }),
    { country_calling_code: "+33", phone_number: "612345678" },
  );
  assert.deepEqual(
    patientPhoneParts({
      country_calling_code: "+98",
      phone_number: "9121111111",
      phone_e164: "+989120000000",
    }),
    { country_calling_code: "+98", phone_number: "9121111111" },
  );
});
