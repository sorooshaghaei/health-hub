const STORE_KEY = "health-hub.demo-store.v1";

function emptyStore() {
  return { clinic: null, staff: [], sessions: {} };
}

function loadStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY));
    return parsed && typeof parsed === "object" ? parsed : emptyStore();
  } catch {
    return emptyStore();
  }
}

function saveStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function fail(payload, status = 400) {
  const error = new Error("Demo API request failed.");
  error.payload = payload;
  error.status = status;
  throw error;
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function randomToken(prefix) {
  return `${prefix}:${crypto.randomUUID()}`;
}

async function hashSecret(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function publicClinic(clinic) {
  return {
    id: clinic.id,
    name: clinic.name,
    email: clinic.email,
    phone: clinic.phone,
  };
}

function publicUser(user, clinic) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    display_name: `${user.first_name} ${user.last_name}`.trim() || user.username,
    role: user.role,
    is_clinic_admin: user.role === "doctor",
    clinic: publicClinic(clinic),
  };
}

function rolePayload(store) {
  return {
    doctor: {
      exists: store.staff.some((user) => user.role === "doctor"),
      is_administrator: true,
    },
    assistant: {
      exists: store.staff.some((user) => user.role === "assistant"),
      is_administrator: false,
    },
  };
}

function resolveClinic(store, clinicToken) {
  if (!store.clinic || clinicToken !== `demo-clinic:${store.clinic.id}`) {
    fail({ detail: "Clinic access is invalid or expired." }, 403);
  }
  return store.clinic;
}

function resolveSession(store, staffToken) {
  const userId = store.sessions[staffToken];
  const user = store.staff.find((candidate) => candidate.id === userId);
  if (!user || !store.clinic) {
    fail({ detail: "Staff session is invalid or expired." }, 401);
  }
  return user;
}

async function createClinic(data) {
  const name = clean(data.name);
  const email = normalizeEmail(data.email);
  const phone = clean(data.phone);
  const password = data.password ?? "";

  if (!name || !email || !phone) fail({ detail: "Complete all clinic fields." });
  if (password !== data.password_confirm) fail({ password_confirm: ["Clinic passwords do not match."] });
  if (password.length < 10) fail({ password: ["Use at least 10 characters for the clinic password."] });

  const store = loadStore();
  if (store.clinic) {
    fail({ detail: "This browser demo already contains a clinic. Clear site data to start again." }, 409);
  }

  const clinic = {
    id: crypto.randomUUID(),
    name,
    email,
    phone,
    password_hash: await hashSecret(password),
  };
  store.clinic = clinic;
  saveStore(store);

  return {
    clinic: publicClinic(clinic),
    roles: rolePayload(store),
    clinic_access_token: `demo-clinic:${clinic.id}`,
  };
}

async function enterClinic(data) {
  const store = loadStore();
  const email = normalizeEmail(data.email);
  const passwordHash = await hashSecret(data.password ?? "");
  if (!store.clinic || store.clinic.email !== email || store.clinic.password_hash !== passwordHash) {
    fail({ non_field_errors: ["Clinic email or password is incorrect."] }, 400);
  }
  return {
    clinic: publicClinic(store.clinic),
    roles: rolePayload(store),
    clinic_access_token: `demo-clinic:${store.clinic.id}`,
  };
}

async function registerStaff(data, clinicToken) {
  const store = loadStore();
  const clinic = resolveClinic(store, clinicToken);
  const role = data.role;
  const username = clean(data.username);
  const email = normalizeEmail(data.email);
  const firstName = clean(data.first_name);
  const lastName = clean(data.last_name);
  const password = data.password ?? "";

  if (!["doctor", "assistant"].includes(role)) fail({ role: ["Choose Doctor or Assistant."] });
  if (store.staff.some((user) => user.role === role)) {
    fail({ role: ["This clinic already has an account for this role."] }, 409);
  }
  if (store.staff.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    fail({ username: ["This username is already in use."] });
  }
  if (store.staff.some((user) => user.email === email)) {
    fail({ email: ["This email is already in use."] });
  }
  if (!username || !email || !firstName || !lastName) fail({ detail: "Complete all staff fields." });
  if (password !== data.password_confirm) fail({ password_confirm: ["Staff passwords do not match."] });
  if (password.length < 8) fail({ password: ["Use at least 8 characters for the staff password."] });

  const user = {
    id: crypto.randomUUID(),
    username,
    email,
    first_name: firstName,
    last_name: lastName,
    role,
    password_hash: await hashSecret(password),
  };
  store.staff.push(user);
  const sessionToken = randomToken("demo-staff");
  store.sessions[sessionToken] = user.id;
  saveStore(store);

  return {
    user: publicUser(user, clinic),
    session_token: sessionToken,
    expires_at: null,
  };
}

async function loginStaff(data, clinicToken) {
  const store = loadStore();
  const clinic = resolveClinic(store, clinicToken);
  const username = clean(data.username).toLowerCase();
  const passwordHash = await hashSecret(data.password ?? "");
  const user = store.staff.find(
    (candidate) => candidate.role === data.role && candidate.username.toLowerCase() === username,
  );

  if (!user || user.password_hash !== passwordHash) {
    fail({ non_field_errors: ["Username or password is incorrect."] }, 400);
  }

  const sessionToken = randomToken("demo-staff");
  store.sessions[sessionToken] = user.id;
  saveStore(store);
  return {
    user: publicUser(user, clinic),
    session_token: sessionToken,
    expires_at: null,
  };
}

export async function demoApiRequest(path, { method = "GET", data = {}, clinicToken, staffToken } = {}) {
  await new Promise((resolve) => window.setTimeout(resolve, 120));

  if (path === "/api/clinics/" && method === "POST") return createClinic(data);
  if (path === "/api/clinics/enter/" && method === "POST") return enterClinic(data);

  if (path === "/api/clinic/context/" && method === "GET") {
    const store = loadStore();
    const clinic = resolveClinic(store, clinicToken);
    return { clinic: publicClinic(clinic), roles: rolePayload(store) };
  }

  if (path === "/api/staff/register/" && method === "POST") return registerStaff(data, clinicToken);
  if (path === "/api/staff/login/" && method === "POST") return loginStaff(data, clinicToken);

  if (path === "/api/staff/me/" && method === "GET") {
    const store = loadStore();
    const user = resolveSession(store, staffToken);
    return { user: publicUser(user, store.clinic) };
  }

  if (path === "/api/staff/logout/" && method === "POST") {
    const store = loadStore();
    if (staffToken) delete store.sessions[staffToken];
    saveStore(store);
    return null;
  }

  fail({ detail: "This API route is not available in the browser demo." }, 404);
}
