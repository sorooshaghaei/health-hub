import assert from "node:assert/strict";
import test from "node:test";

const {
  clearOnboardingHistory,
  onboardingHistoryScreen,
  primeFirstClinicHistory,
  replaceOnboardingHistory,
} = await import("../src/onboardingHistory.js");

test("first-clinic history keeps the first browser Back action inside Health Hub", () => {
  const originalWindow = globalThis.window;
  const entries = [];
  const history = {
    state: { preserved: true },
    replaceState(state) { this.state = state; entries.push(["replace", state]); },
    pushState(state) { this.state = state; entries.push(["push", state]); },
  };
  globalThis.window = { history, location: { href: "https://example.test/health-hub/" } };

  try {
    primeFirstClinicHistory("create-clinic");
    assert.equal(entries.length, 2);
    assert.equal(onboardingHistoryScreen(entries[0][1]), "account-settings");
    assert.equal(onboardingHistoryScreen(entries[1][1]), "create-clinic");
    assert.equal(entries[0][1].preserved, true);

    replaceOnboardingHistory("account-settings");
    assert.equal(onboardingHistoryScreen(history.state), "account-settings");

    clearOnboardingHistory();
    assert.equal(onboardingHistoryScreen(history.state), null);
    assert.equal(history.state.preserved, true);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
