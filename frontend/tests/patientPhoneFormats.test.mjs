import assert from "node:assert/strict";
import test from "node:test";

import {
  COUNTRY_CODES,
  phonePlaceholderForCallingCode,
} from "../src/patientPhoneFormats.js";

test("phone placeholders follow the selected country and never contain sample personal digits", () => {
  assert.equal(phonePlaceholderForCallingCode("+98"), "000 000 00 00");
  assert.equal(phonePlaceholderForCallingCode("+33"), "0 00 00 00 00");
  assert.equal(phonePlaceholderForCallingCode("+974"), "0000 0000");
  assert.equal(phonePlaceholderForCallingCode("+000"), "000 000 0000");

  for (const country of COUNTRY_CODES) {
    assert.match(country.placeholder, /^[0 ]+$/);
    assert.ok(country.placeholder.replaceAll(" ", "").length >= 8);
  }
});

test("country calling codes remain unique", () => {
  const codes = COUNTRY_CODES.map((country) => country.code);
  assert.equal(new Set(codes).size, codes.length);
});
