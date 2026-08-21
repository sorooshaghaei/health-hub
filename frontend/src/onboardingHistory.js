const ONBOARDING_HISTORY_KEY = "healthHubOnboardingScreen";
const ONBOARDING_SCREENS = new Set(["account-settings", "create-clinic", "join-clinic"]);

function historyAvailable() {
  return typeof window !== "undefined" && Boolean(window.history?.replaceState && window.history?.pushState);
}

function currentHistoryState() {
  const state = window.history.state;
  return state && typeof state === "object" ? state : {};
}

function stateFor(screen) {
  return { ...currentHistoryState(), [ONBOARDING_HISTORY_KEY]: screen };
}

export function onboardingHistoryScreen(state) {
  const screen = state && typeof state === "object" ? state[ONBOARDING_HISTORY_KEY] : null;
  return ONBOARDING_SCREENS.has(screen) ? screen : null;
}

export function primeFirstClinicHistory(screen) {
  if (!historyAvailable() || !ONBOARDING_SCREENS.has(screen)) return;
  if (onboardingHistoryScreen(window.history.state) === screen) return;
  window.history.replaceState(stateFor("account-settings"), "", window.location.href);
  window.history.pushState(stateFor(screen), "", window.location.href);
}

export function replaceOnboardingHistory(screen) {
  if (!historyAvailable() || !ONBOARDING_SCREENS.has(screen)) return;
  window.history.replaceState(stateFor(screen), "", window.location.href);
}

export function clearOnboardingHistory() {
  if (!historyAvailable() || !onboardingHistoryScreen(window.history.state)) return;
  const { [ONBOARDING_HISTORY_KEY]: _removed, ...state } = currentHistoryState();
  window.history.replaceState(state, "", window.location.href);
}
