import {
  API_BASE_URL,
  ApiError,
  BROWSER_DEMO_API,
  authenticatedApiHeaders,
  firstError,
} from "./api.js";

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function uploadPatientAttachment({
  patientId,
  file,
  documentName,
  staffToken,
  onProgress,
}) {
  if (BROWSER_DEMO_API) {
    try {
      const { demoUploadPatientAttachment } = await import("./demoAttachments.js");
      return await demoUploadPatientAttachment({
        patientId,
        file,
        documentName,
        staffToken,
        onProgress,
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(firstError(error?.payload), error?.payload ?? null, error?.status ?? 0);
    }
  }
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const form = new FormData();
    form.append("files", file);
    if (documentName) form.append("document_names", documentName);

    request.open(
      "POST",
      `${API_BASE_URL}/api/patients/${encodeURIComponent(patientId)}/attachments/`,
    );
    for (const [name, value] of Object.entries(authenticatedApiHeaders({ staffToken }))) {
      request.setRequestHeader(name, value);
    }
    request.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    });
    request.addEventListener("load", () => {
      const payload = parseJson(request.responseText);
      if (request.status < 200 || request.status >= 300) {
        reject(new ApiError(firstError(payload), payload, request.status));
        return;
      }
      const result = payload?.results?.[0];
      if (result?.status !== "uploaded" || !result.attachment) {
        const error = result?.error ?? payload;
        reject(new ApiError(firstError(error), error, request.status));
        return;
      }
      onProgress?.(100);
      resolve(result.attachment);
    });
    request.addEventListener("error", () => {
      reject(new ApiError("Health Hub could not reach the server."));
    });
    request.addEventListener("abort", () => {
      reject(new ApiError("The upload was cancelled."));
    });
    onProgress?.(0);
    request.send(form);
  });
}

export async function fetchPatientAttachmentContent(path, staffToken) {
  if (BROWSER_DEMO_API) {
    try {
      const { demoFetchPatientAttachmentContent } = await import("./demoAttachments.js");
      return await demoFetchPatientAttachmentContent(path, staffToken);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(firstError(error?.payload), error?.payload ?? null, error?.status ?? 0);
    }
  }
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
      headers: authenticatedApiHeaders({ staffToken }),
    });
  } catch {
    throw new ApiError("Health Hub could not reach the server.");
  }
  if (!response.ok) {
    const isJson = response.headers.get("content-type")?.includes("application/json");
    const payload = isJson ? await response.json() : null;
    throw new ApiError(firstError(payload), payload, response.status);
  }
  return response.blob();
}
