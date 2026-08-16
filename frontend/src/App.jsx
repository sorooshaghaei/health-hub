import { useEffect, useState } from "react";

import { ApiError, DEMO_MODE, apiRequest } from "./api.js";
import PatientWorkspace from "./PatientWorkspace.jsx";
import { Brand, ErrorMessage, Field } from "./ui.jsx";
import "./deviceAccess.css";

const DEVICE_TOKEN_KEY = "health-hub.device-token";
const STAFF_TOKEN_KEY = "health-hub.staff-token";
const DEMO_STORE_KEY = "health-hub.demo-store.v1";
const DEMO_CLINIC = {
  name: "Health Hub Demo",
  email: "demo@health-hub.local",
  phone: "+33 1 00 00 00 00",
};

const EMPTY_CLINIC = {
  name: "",
  email: "",
  phone: "",
};

const EMPTY_STAFF = {
  first_name: "",
  last_name: "",
  username: "",
  email: "",
  password: "",
  password_confirm: "",
};

function AuthShell({ title, description, children, onBack }) {
  return (
    <main className="auth-layout">
      <section className="auth-intro">
        <Brand />
        <div>
          <p className="eyebrow">One clinic. Two clear workspaces.</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </section>
      <section className="auth-panel">
        {onBack && <button className="back-button" type="button" onClick={onBack}>← Back</button>}
        {children}
      </section>
    </main>
  );
}

function Landing({ onCreate, onPair, onDemo }) {
  if (DEMO_MODE) {
    return (
      <AuthShell title="A calmer clinic day." description="The public demo uses the same Health Hub interface but does not simulate production trusted-device security.">
        <div className="panel-heading">
          <p className="eyebrow">Browser demo</p>
          <h2>Open Health Hub demo</h2>
          <p>Demo data stays only in this browser. Do not enter real Patient information.</p>
        </div>
        <button className="primary-button" type="button" onClick={onDemo}>Open demo</button>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="A calmer clinic day." description="Health Hub only opens clinic data on devices that the clinic has trusted.">
      <div className="panel-heading">
        <p className="eyebrow">Start</p>
        <h2>Open your clinic</h2>
        <p>Create a new clinic on this device, or pair this browser with an existing clinic.</p>
      </div>
      <div className="choice-stack">
        <button className="choice-card" type="button" onClick={onCreate}>
          <span className="choice-card__icon">+</span>
          <span><strong>Create clinic</strong><small>This browser becomes the clinic&apos;s first trusted device automatically.</small></span>
          <span aria-hidden="true">→</span>
        </button>
        <button className="choice-card" type="button" onClick={onPair}>
          <span className="choice-card__icon">↳</span>
          <span><strong>Use another device</strong><small>Pair this browser from a device that is already trusted for the clinic.</small></span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </AuthShell>
  );
}

function ClinicForm({ onSubmit, onBack }) {
  const [form, setForm] = useState(EMPTY_CLINIC);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Something went wrong."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create the clinic."
      description="Health Hub will register this browser automatically as the clinic's first trusted device so you cannot accidentally create a clinic and lose access to it."
      onBack={onBack}
    >
      <form className="form" onSubmit={submit}>
        <div className="panel-heading">
          <p className="eyebrow">New clinic</p>
          <h2>Clinic information</h2>
        </div>
        <ErrorMessage error={error} />
        <Field label="Clinic name" name="name" value={form.name} onChange={update} autoComplete="organization" required />
        <Field label="Clinic phone" name="phone" value={form.phone} onChange={update} autoComplete="tel" required />
        <Field label="Clinic email" name="email" type="email" value={form.email} onChange={update} autoComplete="email" required />
        <button className="primary-button" disabled={submitting}>{submitting ? "Please wait…" : "Create clinic"}</button>
      </form>
    </AuthShell>
  );
}

function FirstDeviceNotice({ clinic, onContinue }) {
  return (
    <AuthShell
      title="This device is trusted."
      description={`Health Hub only allows clinic access from trusted devices. This browser is now the first trusted device for ${clinic.name}.`}
    >
      <div className="panel-heading">
        <p className="eyebrow">Device registered</p>
        <h2>Clinic access is protected</h2>
        <p>When another computer needs access, it must be approved from a device that is already trusted. You can review and remove trusted devices after signing in.</p>
      </div>
      <button className="primary-button" type="button" onClick={onContinue}>Continue</button>
    </AuthShell>
  );
}

function PairDeviceForm({ onSubmit, onBack }) {
  const [clinicEmail, setClinicEmail] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ clinic_email: clinicEmail });
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Pairing could not be started."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Trust this device."
      description="An existing trusted Health Hub device must approve this browser before any clinic or Patient data can be opened here."
      onBack={onBack}
    >
      <form className="form" onSubmit={submit}>
        <div className="panel-heading">
          <p className="eyebrow">New device</p>
          <h2>Find your clinic</h2>
          <p>Enter the clinic email to create a short pairing code.</p>
        </div>
        <ErrorMessage error={error} />
        <Field label="Clinic email" name="clinic_email" type="email" value={clinicEmail} onChange={(event) => setClinicEmail(event.target.value)} autoComplete="email" required />
        <button className="primary-button" disabled={submitting}>{submitting ? "Please wait…" : "Create pairing code"}</button>
      </form>
    </AuthShell>
  );
}

function PairingWaiting({ pairing, error, onCancel }) {
  const code = pairing.pairing_code;
  const displayCode = `${code.slice(0, 3)} ${code.slice(3)}`;
  return (
    <AuthShell
      title="Approve this browser."
      description="Keep this page open while somebody signed in on an already trusted clinic device approves the code."
      onBack={onCancel}
    >
      <div className="panel-heading">
        <p className="eyebrow">Waiting for approval</p>
        <h2>Enter this code on a trusted device</h2>
        <p>On an already trusted Health Hub device, open <strong>Devices</strong> and enter this code under <strong>Add device</strong>.</p>
      </div>
      <ErrorMessage error={error} />
      <div className="pairing-code" aria-label={`Pairing code ${displayCode}`}>{displayCode}</div>
      <p className="security-note">No clinic or Patient data is available on this browser until approval succeeds. The code expires automatically.</p>
      <div className="loader" aria-label="Waiting for device approval" />
    </AuthShell>
  );
}

function RoleSelection({ context, onSelect }) {
  const roleCard = (role, title, description) => {
    const exists = context.roles[role].exists;
    return (
      <button className="role-card" type="button" onClick={() => onSelect(role)}>
        <span className={`role-card__badge role-card__badge--${role}`}>{title[0]}</span>
        <span className="role-card__content">
          <span className="role-card__title-row"><strong>{title}</strong>{role === "doctor" && <small>Administrator</small>}</span>
          <span>{description}</span>
          <em>{exists ? `Sign in to ${title} workspace` : `Create ${title} account`}</em>
        </span>
        <span aria-hidden="true">→</span>
      </button>
    );
  };

  return (
    <AuthShell title={`Welcome to ${context.clinic.name}.`} description="This device is trusted. Choose the workspace you need, then sign in with the individual staff account.">
      <div className="panel-heading"><p className="eyebrow">Trusted clinic device</p><h2>Which workspace?</h2><p>{context.clinic.email}</p></div>
      <div className="choice-stack">
        {roleCard("doctor", "Doctor", "Use Room ready, review appointments and the queue, and update Patient information.")}
        {context.roles.doctor.exists && roleCard("assistant", "Assistant", "Manage Patients, appointments, check-in, and the live queue. Doctor administrator credentials are also accepted.")}
      </div>
      <p className="security-note">The Doctor is the clinic administrator but management tools remain inside the Assistant workspace.</p>
    </AuthShell>
  );
}

function StaffForm({ role, exists, onSubmit, onBack }) {
  const [form, setForm] = useState(exists ? { username: "", password: "" } : EMPTY_STAFF);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const title = role === "doctor" ? "Doctor" : "Assistant";

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ ...form, role });
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Something went wrong."));
    } finally {
      setSubmitting(false);
    }
  }

  const description = exists
    ? role === "assistant"
      ? "Use the Assistant credentials, or the Doctor administrator username and password, to open the Assistant workspace."
      : "Use the individual Doctor username and password."
    : `This account belongs only to the clinic's ${title}.`;

  return (
    <AuthShell title={exists ? `${title} workspace sign in.` : `Create the ${title} account.`} description={description} onBack={onBack}>
      <form className="form" onSubmit={submit}>
        <div className="panel-heading">
          <p className="eyebrow">{title}{role === "doctor" ? " · Administrator" : ""}</p>
          <h2>{exists ? "Individual sign in" : "Individual profile"}</h2>
          {exists && role === "assistant" && <p>Doctor credentials grant administrator access here without adding management controls to the Doctor workspace.</p>}
        </div>
        <ErrorMessage error={error} />
        {!exists && <div className="field-row"><Field label="First name" name="first_name" value={form.first_name} onChange={update} autoComplete="given-name" required /><Field label="Last name" name="last_name" value={form.last_name} onChange={update} autoComplete="family-name" required /></div>}
        <Field label="Username" name="username" value={form.username} onChange={update} autoComplete="username" required />
        {!exists && <Field label="Individual email" name="email" type="email" value={form.email} onChange={update} autoComplete="email" required />}
        <Field label="Individual password" name="password" type="password" value={form.password} onChange={update} autoComplete={exists ? "current-password" : "new-password"} required />
        {!exists && <Field label="Confirm individual password" name="password_confirm" type="password" value={form.password_confirm} onChange={update} autoComplete="new-password" required />}
        <button className="primary-button" disabled={submitting}>{submitting ? "Please wait…" : exists ? `Open ${title} workspace` : `Create ${title} account`}</button>
      </form>
    </AuthShell>
  );
}

function LoadingScreen() {
  return <div className="loading-screen"><Brand /><div className="loader" aria-label="Loading" /></div>;
}

export default function App() {
  const [screen, setScreen] = useState("loading");
  const [deviceToken, setDeviceToken] = useState(null);
  const [staffToken, setStaffToken] = useState(null);
  const [clinicContext, setClinicContext] = useState(null);
  const [staffUser, setStaffUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [pairing, setPairing] = useState(null);
  const [pairingError, setPairingError] = useState(null);
  const [firstClinicSetup, setFirstClinicSetup] = useState(false);

  useEffect(() => {
    async function restore() {
      const storedStaffToken = localStorage.getItem(STAFF_TOKEN_KEY);
      const storedDeviceToken = DEMO_MODE ? null : localStorage.getItem(DEVICE_TOKEN_KEY);
      const hasClinicAccess = DEMO_MODE || Boolean(storedDeviceToken);

      if (storedStaffToken && hasClinicAccess) {
        try {
          const payload = await apiRequest("/api/staff/me/", { staffToken: storedStaffToken });
          setStaffToken(storedStaffToken);
          setStaffUser(payload.user);
          if (!DEMO_MODE) setDeviceToken(storedDeviceToken);
          setScreen("workspace");
          return;
        } catch {
          localStorage.removeItem(STAFF_TOKEN_KEY);
        }
      } else if (storedStaffToken) {
        localStorage.removeItem(STAFF_TOKEN_KEY);
      }

      if (DEMO_MODE && localStorage.getItem(DEMO_STORE_KEY)) {
        try {
          const payload = await apiRequest("/api/clinic/context/");
          setClinicContext(payload);
          setScreen("roles");
          return;
        } catch {
          localStorage.removeItem(DEMO_STORE_KEY);
        }
      }

      if (!DEMO_MODE && storedDeviceToken) {
        try {
          const payload = await apiRequest("/api/clinic/context/", { deviceToken: storedDeviceToken });
          setDeviceToken(storedDeviceToken);
          setClinicContext(payload);
          if (!payload.roles.doctor.exists) {
            setSelectedRole("doctor");
            setFirstClinicSetup(true);
            setScreen("staff");
          } else {
            setScreen("roles");
          }
          return;
        } catch {
          localStorage.removeItem(DEVICE_TOKEN_KEY);
        }
      }
      setScreen("landing");
    }
    restore();
  }, []);

  useEffect(() => {
    if (screen !== "pairing-waiting" || !pairing?.request_token) return undefined;
    let cancelled = false;

    async function checkStatus() {
      try {
        const payload = await apiRequest("/api/devices/pairing/status/", {
          method: "POST",
          data: { request_token: pairing.request_token },
        });
        if (cancelled || payload.status !== "approved") return;
        localStorage.setItem(DEVICE_TOKEN_KEY, payload.device_token);
        setDeviceToken(payload.device_token);
        setClinicContext({ clinic: payload.clinic, roles: payload.roles });
        setPairing(null);
        setPairingError(null);
        setScreen("roles");
      } catch (requestError) {
        if (!cancelled) {
          setPairingError(requestError instanceof ApiError ? requestError : new ApiError("Device approval could not be checked."));
        }
      }
    }

    checkStatus();
    const timer = globalThis.setInterval(checkStatus, 2000);
    return () => {
      cancelled = true;
      globalThis.clearInterval(timer);
    };
  }, [pairing, screen]);

  async function createClinic(form) {
    const payload = await apiRequest("/api/clinics/", { method: "POST", data: form });
    localStorage.setItem(DEVICE_TOKEN_KEY, payload.device_token);
    setDeviceToken(payload.device_token);
    setClinicContext({ clinic: payload.clinic, roles: payload.roles });
    setSelectedRole("doctor");
    setFirstClinicSetup(true);
    setScreen("staff");
  }

  async function startPairing(form) {
    const payload = await apiRequest("/api/devices/pairing/", { method: "POST", data: form });
    setPairing(payload);
    setPairingError(null);
    setScreen("pairing-waiting");
  }

  async function openDemo() {
    let payload;
    try {
      payload = await apiRequest("/api/clinic/context/");
    } catch {
      localStorage.removeItem(DEMO_STORE_KEY);
      payload = await apiRequest("/api/clinics/", { method: "POST", data: DEMO_CLINIC });
    }
    setClinicContext({ clinic: payload.clinic, roles: payload.roles });
    setScreen("roles");
  }

  function selectRole(role) {
    setSelectedRole(role);
    setScreen("staff");
  }

  async function submitStaff(form) {
    const exists = clinicContext.roles[selectedRole].exists;
    const payload = await apiRequest(exists ? "/api/staff/login/" : "/api/staff/register/", {
      method: "POST",
      data: form,
      deviceToken: DEMO_MODE ? undefined : deviceToken,
    });
    localStorage.setItem(STAFF_TOKEN_KEY, payload.session_token);
    setStaffToken(payload.session_token);
    setStaffUser(payload.user);
    if (firstClinicSetup && selectedRole === "doctor" && !exists) {
      setClinicContext((current) => ({
        ...current,
        roles: { ...current.roles, doctor: { ...current.roles.doctor, exists: true } },
      }));
      setScreen("first-device");
      return;
    }
    setScreen("workspace");
  }

  async function signOut() {
    if (staffToken) {
      try {
        await apiRequest("/api/staff/logout/", { method: "POST", staffToken });
      } catch {
        // Local sign-out must still complete if the server session already expired.
      }
    }
    localStorage.removeItem(STAFF_TOKEN_KEY);
    setStaffToken(null);
    setStaffUser(null);

    try {
      if (DEMO_MODE) {
        const payload = await apiRequest("/api/clinic/context/");
        setClinicContext(payload);
        setScreen("roles");
        return;
      }
      if (deviceToken) {
        const payload = await apiRequest("/api/clinic/context/", { deviceToken });
        setClinicContext(payload);
        setScreen("roles");
        return;
      }
    } catch {
      // Fall through to local access reset.
    }
    resetLocalAccess();
  }

  function resetLocalAccess() {
    localStorage.removeItem(STAFF_TOKEN_KEY);
    localStorage.removeItem(DEVICE_TOKEN_KEY);
    setStaffToken(null);
    setDeviceToken(null);
    setStaffUser(null);
    setClinicContext(null);
    setSelectedRole(null);
    setPairing(null);
    setPairingError(null);
    setFirstClinicSetup(false);
    setScreen("landing");
  }

  function currentDeviceRemoved() {
    resetLocalAccess();
  }

  if (screen === "loading") return <LoadingScreen />;
  if (screen === "landing") return <Landing onCreate={() => setScreen("create-clinic")} onPair={() => setScreen("pair-device")} onDemo={openDemo} />;
  if (screen === "create-clinic") return <ClinicForm onSubmit={createClinic} onBack={() => setScreen("landing")} />;
  if (screen === "first-device" && clinicContext) return <FirstDeviceNotice clinic={clinicContext.clinic} onContinue={() => { setFirstClinicSetup(false); setScreen("workspace"); }} />;
  if (screen === "pair-device") return <PairDeviceForm onSubmit={startPairing} onBack={() => setScreen("landing")} />;
  if (screen === "pairing-waiting" && pairing) return <PairingWaiting pairing={pairing} error={pairingError} onCancel={resetLocalAccess} />;
  if (screen === "roles" && clinicContext) return <RoleSelection context={clinicContext} onSelect={selectRole} />;
  if (screen === "staff" && clinicContext && selectedRole) return <StaffForm role={selectedRole} exists={clinicContext.roles[selectedRole].exists} onSubmit={submitStaff} onBack={firstClinicSetup ? undefined : () => setScreen("roles")} />;
  if (screen === "workspace" && staffUser && staffToken) return <PatientWorkspace user={staffUser} staffToken={staffToken} onSignOut={signOut} onCurrentDeviceRemoved={currentDeviceRemoved} />;
  return <LoadingScreen />;
}