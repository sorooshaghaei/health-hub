const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  constructor(message, fields = null, status = 0) {
    super(message);
    this.name = "ApiError";
    this.fields = fields;
    this.status = status;
  }
}

function firstError(payload) {
  if (!payload) return "The request could not be completed.";
  if (typeof payload === "string") return payload;
  if (payload.detail) return payload.detail;
  if (payload.non_field_errors?.length) return payload.non_field_errors[0];

  const firstValue = Object.values(payload)[0];
  if (Array.isArray(firstValue)) return firstValue[0];
  if (typeof firstValue === "string") return firstValue;
  return "The request could not be completed.";
}

export async function apiRequest(
  path,
  { method = "GET", data, clinicToken, staffToken } = {},
) {
  const headers = { Accept: "application/json" };
  if (data !== undefined) headers["Content-Type"] = "application/json";
  if (clinicToken) headers["X-Clinic-Token"] = clinicToken;
  if (staffToken) headers.Authorization = `Bearer ${staffToken}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  } catch {
    throw new ApiError("Health Hub could not reach the server.");
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = response.status === 204 ? null : isJson ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError(firstError(payload), payload, response.status);
  }

  return payload;
}
