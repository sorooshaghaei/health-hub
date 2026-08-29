import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { checkInMinuteKey, sharedCheckInMinuteKeys } from "../src/queueCheckInTimes.js";

test("same-minute queue arrivals are identified without changing their order", () => {
  const first = { id: 1, checked_in_at: "2026-08-29T09:12:03.000Z" };
  const second = { id: 2, checked_in_at: "2026-08-29T09:12:48.000Z" };
  const third = { id: 3, checked_in_at: "2026-08-29T09:13:01.000Z" };
  const queue = [first, second, third];

  const sharedMinutes = sharedCheckInMinuteKeys(queue);

  assert.deepEqual(queue.map((item) => item.id), [1, 2, 3]);
  assert.equal(sharedMinutes.has(checkInMinuteKey(first.checked_in_at)), true);
  assert.equal(sharedMinutes.has(checkInMinuteKey(second.checked_in_at)), true);
  assert.equal(sharedMinutes.has(checkInMinuteKey(third.checked_in_at)), false);
});

test("missing and invalid check-in timestamps do not create a shared minute", () => {
  assert.equal(checkInMinuteKey(null), null);
  assert.equal(checkInMinuteKey("not-a-date"), null);
  assert.equal(sharedCheckInMinuteKeys([
    { checked_in_at: null },
    { checked_in_at: "not-a-date" },
  ]).size, 0);
});

test("queue rows request seconds only for a shared check-in minute", async () => {
  const source = await readFile(new URL("../src/ScheduleWorkspace.jsx", import.meta.url), "utf8");

  assert.match(source, /\.\.\.\(showSeconds \? \{ second: "2-digit" \} : \{\}\)/);
  assert.match(
    source,
    /showCheckInSeconds=\{sharedCheckInMinutes\.has\(checkInMinuteKey\(item\.checked_in_at\)\)\}/,
  );
  assert.match(source, /formatCheckInTime\(item\.checked_in_at, showCheckInSeconds\)/);
});
