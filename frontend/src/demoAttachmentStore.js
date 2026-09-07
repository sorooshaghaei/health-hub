const DATABASE_NAME = "health-hub.demo-attachments.v1";
const DATABASE_VERSION = 1;
const STORE_NAME = "attachments";

let databasePromise = null;

function indexedDbApi() {
  if (!globalThis.indexedDB) {
    throw new Error("IndexedDB is unavailable in this browser.");
  }
  return globalThis.indexedDB;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
}

function transactionCompletion(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error), { once: true });
  });
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    let request;
    try {
      request = indexedDbApi().open(DATABASE_NAME, DATABASE_VERSION);
    } catch (error) {
      reject(error);
      return;
    }
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
      store.createIndex("by_patient", "patient_id", { unique: false });
      store.createIndex("by_clinic", "clinic_id", { unique: false });
      store.createIndex(
        "unique_patient_name",
        ["patient_id", "normalized_document_name"],
        { unique: true },
      );
      store.createIndex(
        "unique_patient_content",
        ["patient_id", "source_sha256"],
        { unique: true },
      );
    });
    request.addEventListener("success", () => {
      const database = request.result;
      database.addEventListener("versionchange", () => {
        database.close();
        databasePromise = null;
      });
      resolve(database);
    }, { once: true });
    request.addEventListener("error", () => {
      databasePromise = null;
      reject(request.error);
    }, { once: true });
    request.addEventListener("blocked", () => {
      databasePromise = null;
      reject(new Error("The attachment database is blocked by another tab."));
    }, { once: true });
  });
  return databasePromise;
}

async function withStore(mode, operation) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, mode);
  const completed = transactionCompletion(transaction);
  try {
    const result = await operation(transaction.objectStore(STORE_NAME));
    await completed;
    return result;
  } catch (error) {
    try {
      transaction.abort();
    } catch {
      // A failed request may already have aborted the transaction.
    }
    await completed.catch(() => {});
    throw error;
  }
}

export function getDemoAttachment(id) {
  return withStore("readonly", (store) => requestResult(store.get(id)));
}

export function listDemoAttachmentsForPatient(patientId) {
  return withStore("readonly", (store) => (
    requestResult(store.index("by_patient").getAll(patientId))
  ));
}

export function addDemoAttachment(attachment) {
  return withStore("readwrite", (store) => requestResult(store.add(attachment)));
}

export function putDemoAttachment(attachment) {
  return withStore("readwrite", (store) => requestResult(store.put(attachment)));
}

export function deleteDemoAttachment(id) {
  return withStore("readwrite", (store) => requestResult(store.delete(id)));
}

export function deleteDemoAttachmentsForClinics(clinicIds) {
  const ids = new Set(clinicIds);
  if (!ids.size || !globalThis.indexedDB) return Promise.resolve(0);
  return withStore("readwrite", async (store) => {
    const attachments = await requestResult(store.getAll());
    const matches = attachments.filter((attachment) => ids.has(attachment.clinic_id));
    await Promise.all(matches.map((attachment) => requestResult(store.delete(attachment.id))));
    return matches.length;
  });
}

export function purgeDemoAttachments(shouldDelete) {
  if (!globalThis.indexedDB) return Promise.resolve(0);
  return withStore("readwrite", async (store) => {
    const attachments = await requestResult(store.getAll());
    const matches = attachments.filter(shouldDelete);
    await Promise.all(matches.map((attachment) => requestResult(store.delete(attachment.id))));
    return matches.length;
  });
}

export async function resetDemoAttachmentDatabase() {
  if (databasePromise) {
    try {
      const database = await databasePromise;
      database.close();
    } catch {
      // A failed open has nothing to close.
    }
    databasePromise = null;
  }
  if (!globalThis.indexedDB) return;
  await requestResult(indexedDbApi().deleteDatabase(DATABASE_NAME));
}
