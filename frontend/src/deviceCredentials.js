import { tryNormalizeInternationalPhone } from "./phoneNumbers.js";

export const ACTIVE_DEVICE_TOKEN_KEY = "health-hub.active-device-token";
export const TRUSTED_DEVICE_REGISTRY_KEY = "health-hub.trusted-device-credentials.v1";

function storageAvailable() {
  return typeof localStorage !== "undefined";
}

function normalizeIdentity(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("@")) return normalized;
  return tryNormalizeInternationalPhone(normalized)
    ?? normalized.replace(/[ .()\-]/g, "").replace(/^00/, "+");
}

function readRegistry() {
  if (!storageAvailable()) return { accounts: {} };
  try {
    const parsed = JSON.parse(localStorage.getItem(TRUSTED_DEVICE_REGISTRY_KEY) || "null");
    return parsed?.accounts && typeof parsed.accounts === "object" ? parsed : { accounts: {} };
  } catch {
    return { accounts: {} };
  }
}

function writeRegistry(registry) {
  if (!storageAvailable()) return;
  localStorage.setItem(TRUSTED_DEVICE_REGISTRY_KEY, JSON.stringify(registry));
}

function accountAliases(user) {
  return [user?.email, user?.phone].map(normalizeIdentity).filter(Boolean);
}

export function trustedDeviceTokenForIdentity(role, identity) {
  const target = normalizeIdentity(identity);
  const accounts = Object.values(readRegistry().accounts);
  return accounts.find((account) => (
    account.role === role
    && Array.isArray(account.aliases)
    && account.aliases.includes(target)
  ))?.token ?? null;
}

export function rememberTrustedDevice(user, token) {
  if (!storageAvailable() || !user?.id || !token) return null;
  const registry = readRegistry();
  registry.accounts[user.id] = {
    token,
    role: user.role,
    aliases: accountAliases(user),
  };
  writeRegistry(registry);
  localStorage.setItem(ACTIVE_DEVICE_TOKEN_KEY, token);
  return token;
}

export function refreshTrustedDeviceIdentity(user) {
  if (!storageAvailable() || !user?.id) return;
  const registry = readRegistry();
  const current = registry.accounts[user.id];
  if (!current) return;
  registry.accounts[user.id] = { ...current, role: user.role, aliases: accountAliases(user) };
  writeRegistry(registry);
}

export function forgetTrustedDevice(userId) {
  if (!storageAvailable() || !userId) return;
  const registry = readRegistry();
  const removed = registry.accounts[userId];
  delete registry.accounts[userId];
  writeRegistry(registry);
  if (removed?.token === localStorage.getItem(ACTIVE_DEVICE_TOKEN_KEY)) {
    localStorage.removeItem(ACTIVE_DEVICE_TOKEN_KEY);
  }
}

export function clearActiveTrustedDevice() {
  if (storageAvailable()) localStorage.removeItem(ACTIVE_DEVICE_TOKEN_KEY);
}
