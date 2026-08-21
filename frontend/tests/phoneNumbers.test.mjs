import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeInternationalPhone,
  tryNormalizeInternationalPhone,
} from "../src/phoneNumbers.js";

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");

test("staff phones normalize formatted and 00-prefixed international input to E.164", () => {
  assert.equal(normalizeInternationalPhone("+33 6 12 34 56 78"), "+33612345678");
  assert.equal(normalizeInternationalPhone("0033 6 12 34 56 78"), "+33612345678");
});

test("staff phone normalization rejects national-only and invalid values", () => {
  assert.throws(() => normalizeInternationalPhone("06 12 34 56 78"), /beginning with \+/);
  assert.equal(tryNormalizeInternationalPhone("+33 1 23"), null);
});

test("staff registration shows complete international phone guidance", () => {
  assert.match(appSource, /placeholder="\+33 6 12 34 56 78"/);
  assert.match(appSource, /full international format beginning with \+/);
});
