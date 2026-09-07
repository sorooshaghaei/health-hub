import { browserTimeZone } from "./clinicTime.js";
import { demoPhase8ApiRequest } from "./demoPhase8Api.js";
import { ACTIVE_DEVICE_TOKEN_KEY } from "./deviceCredentials.js";

export const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? "";
const DEMO_AUTH_STORE_KEY = "health-hub.demo-auth.v2";
const DEMO_OPERATIONAL_STORE_KEY = "health-hub.demo-store.v1";
export const DEMO_MODE = import.meta.env?.VITE_DEMO_MODE === "true";
export const BROWSER_DEMO_API = import.meta.env?.VITE_DEMO_API === "true";

export class ApiError extends Error {
  constructor(message, fields = null, status = 0) { super(message); this.name = "ApiError"; this.fields = fields; this.status = status; }
}
export function firstError(payload) {
  if (!payload) return "The request could not be completed.";
  if (typeof payload === "string") return payload;
  if (payload.detail) return payload.detail;
  if (payload.non_field_errors?.length) return payload.non_field_errors[0];
  const firstValue = Object.values(payload)[0];
  if (Array.isArray(firstValue)) return firstValue[0];
  if (typeof firstValue === "string") return firstValue;
  return "The request could not be completed.";
}

export function authenticatedApiHeaders({ deviceToken, staffToken } = {}) {
  const headers = { Accept: "application/json" };
  const storedDeviceToken = staffToken && typeof localStorage !== "undefined" ? localStorage.getItem(ACTIVE_DEVICE_TOKEN_KEY) : null;
  const activeDeviceToken = deviceToken ?? storedDeviceToken;
  if (activeDeviceToken) headers["X-Device-Token"] = activeDeviceToken;
  if (staffToken) headers.Authorization = `Bearer ${staffToken}`;
  return headers;
}

function withClinicTimezone(path, method, data) {
  if (path !== "/api/clinics/" || method !== "POST" || data === undefined || data?.timezone) {
    return data;
  }
  return { ...data, timezone: browserTimeZone() };
}

function readDemoStore(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function protectCurrentDemoDevice(path, method, staffToken) {
  if (method !== "DELETE") return;
  const match = path.match(/^\/api\/devices\/([0-9a-f-]+)\/$/i);
  if (!match || typeof localStorage === "undefined") return;
  const authStore = readDemoStore(DEMO_AUTH_STORE_KEY);
  const session = staffToken ? authStore?.sessions?.[staffToken] : null;
  if (session?.device_id === match[1]) {
    const fields = { detail: "The current trusted device cannot be removed." };
    throw new ApiError(fields.detail, fields, 400);
  }
}

function syncDemoClinicTimezone(path, method, requestData, payload) {
  if (typeof localStorage === "undefined") return payload;

  const authStore = readDemoStore(DEMO_AUTH_STORE_KEY);
  if (!authStore) return payload;

  if (path === "/api/clinics/" && method === "POST" && payload?.clinic?.id) {
    const clinic = authStore.clinics?.find((item) => item.id === payload.clinic.id);
    if (clinic) {
      clinic.timezone = requestData?.timezone || browserTimeZone();
      localStorage.setItem(DEMO_AUTH_STORE_KEY, JSON.stringify(authStore));
    }
  }

  const operationalStore = readDemoStore(DEMO_OPERATIONAL_STORE_KEY);
  if (operationalStore?.clinic?.id) {
    const clinic = authStore.clinics?.find((item) => item.id === operationalStore.clinic.id);
    if (clinic?.timezone) {
      operationalStore.clinic.timezone = clinic.timezone;
      localStorage.setItem(DEMO_OPERATIONAL_STORE_KEY, JSON.stringify(operationalStore));
    }
  }

  return payload;
}

export async function apiRequest(path, { method = "GET", data, deviceToken, staffToken } = {}) {
  const requestData = withClinicTimezone(path, method, data);
  if (BROWSER_DEMO_API) {
    protectCurrentDemoDevice(path, method, staffToken);
    try {
      const payload = await demoPhase8ApiRequest(path, { method, data: requestData, deviceToken, staffToken });
      return syncDemoClinicTimezone(path, method, requestData, payload);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(firstError(error.payload), error.payload ?? null, error.status ?? 0);
    }
  }
  const headers = authenticatedApiHeaders({ deviceToken, staffToken });
  if (requestData !== undefined) headers["Content-Type"] = "application/json";
  let response;
  try { response = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: requestData === undefined ? undefined : JSON.stringify(requestData) }); }
  catch { throw new ApiError("Health Hub could not reach the server."); }
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = response.status === 204 ? null : isJson ? await response.json() : null;
  if (!response.ok) throw new ApiError(firstError(payload), payload, response.status);
  return payload;
}

export { ACTIVE_DEVICE_TOKEN_KEY };
