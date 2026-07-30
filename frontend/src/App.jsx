import { useEffect, useState } from "react";

import { ApiError, apiRequest } from "./api.js";

const CLINIC_TOKEN_KEY = "health-hub.clinic-token";
const STAFF_TOKEN_KEY = "health-hub.staff-token";

const EMPTY_CLINIC = {
  name: "",
  email: "",
  phone: "",
  password: "",
  password_confirm: "",
};

const EMPTY_STAFF = {
  first_name: "",
  last_name: "",
  username: "",
  email: "",
  password: "",
  password_confirm: "",
};

function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`}>
      <div className="brand__mark" aria-hidden="true">H</div>
      <div>
        <strong>Health Hub</strong>
        {!compact && <span>Simple clinic workflow</span>}
      </div>
    </div>
  );
}

function ErrorMessage({ error }) {
  if (!error) return null;
  return <div className="alert alert--error" role="alert">{error.message}</div>;
}

function Field({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

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

function Landing({ onCreate, onEnter }) {
  return (
    <AuthShell title="A calmer clinic day." description="Health Hub keeps the Doctor and Assistant in separate, focused workspaces without unnecessary clinic-software complexity.">
      <div className="panel-heading">
        <p className="eyebrow">Start</p>
        <h2>Open your clinic</h2>
        <p>Create Health Hub for a new clinic or enter an existing clinic.</p>
      </div>
      <div className="choice-stack">
        <button className="choice-card" type="button" onClick={onCreate}>
          <span className="choice-card__icon">+</span>
          <span><strong>Create clinic</strong><small>Set up the clinic's shared first-level access.</small></span>
          <span aria-hidden="true">→</span>
        </button>
        <button className="choice-card" type="button" onClick={onEnter}>
          <span className="choice-card__icon">↳</span>
          <span><strong>Enter clinic</strong><small>Use the clinic email and clinic password.</small></span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </AuthShell>
  );
}

function ClinicForm({ mode, onSubmit, onBack }) {
  const [form, setForm] = useState(mode === "create" ? EMPTY_CLINIC : { email: "", password: "" });
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

  const creating = mode === "create";
  return (
    <AuthShell
      title={creating ? "Create the clinic." : "Enter the clinic."}
      description={creating ? "The clinic password is shared first-level access. Each staff member will still have a separate individual account." : "First enter the clinic. Then choose Doctor or Assistant and use the individual staff account."}
      onBack={onBack}
    >
      <form className="form" onSubmit={submit}>
        <div className="panel-heading">
          <p className="eyebrow">{creating ? "New clinic" : "Existing clinic"}</p>
          <h2>{creating ? "Clinic information" : "Clinic access"}</h2>
        </div>
        <ErrorMessage error={error} />
        {creating && <><Field label="Clinic name" name="name" value={form.name} onChange={update} autoComplete="organization" required /><Field label="Clinic phone" name="phone" value={form.phone} onChange={update} autoComplete="tel" required /></>}
        <Field label="Clinic email" name="email" type="email" value={form.email} onChange={update} autoComplete="email" required />
        <Field label="Clinic password" name="password" type="password" value={form.password} onChange={update} autoComplete={creating ? "new-password" : "current-password"} required />
        {creating && <Field label="Confirm clinic password" name="password_confirm" type="password" value={form.password_confirm} onChange={update} autoComplete="new-password" required />}
        <button className="primary-button" disabled={submitting}>{submitting ? "Please wait…" : creating ? "Create clinic" : "Enter clinic"}</button>
      </form>
    </AuthShell>
  );
}

function RoleSelection({ context, onSelect, onLeave }) {
  const roleCard = (role, title, description) => {
    const exists = context.roles[role].exists;
    return (
      <button className="role-card" type="button" onClick={() => onSelect(role)}>
        <span className={`role-card__badge role-card__badge--${role}`}>{title[0]}</span>
        <span className="role-card__content">
          <span className="role-card__title-row"><strong>{title}</strong>{role === "doctor" && <small>Administrator</small>}</span>
          <span>{description}</span>
          <em>{exists ? `Sign in as ${title}` : `Create ${title} account`}</em>
        </span>
        <span aria-hidden="true">→</span>
      </button>
    );
  };

  return (
    <AuthShell title={`Welcome to ${context.clinic.name}.`} description="Choose the workspace you use. Doctor and Assistant accounts remain separate." onBack={onLeave}>
      <div className="panel-heading"><p className="eyebrow">Clinic entered</p><h2>Who are you?</h2><p>{context.clinic.email}</p></div>
      <div className="choice-stack">
        {roleCard("doctor", "Doctor", "Consultation workflow, shared tasks, and private Doctor notes.")}
        {roleCard("assistant", "Assistant", "Patient administration, live queue, checkout, and shared tasks.")}
      </div>
      <p className="security-note">The Doctor is always the clinic administrator.</p>
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

  return (
    <AuthShell title={exists ? `${title} sign in.` : `Create the ${title} account.`} description={exists ? `Use the individual ${title} username and password.` : `This account belongs only to the clinic's ${title}.`} onBack={onBack}>
      <form className="form" onSubmit={submit}>
        <div className="panel-heading"><p className="eyebrow">{title}{role === "doctor" ? " · Administrator" : ""}</p><h2>{exists ? "Individual sign in" : "Individual profile"}</h2></div>
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

function EmptyState({ title, description }) {
  return <div className="empty-state"><div className="empty-state__dot" /><strong>{title}</strong><span>{description}</span></div>;
}

function Workspace({ user, onSignOut, onLeaveClinic }) {
  const doctor = user.role === "doctor";
  return (
    <div className="workspace">
      <header className="workspace-header">
        <Brand compact />
        <div className="workspace-header__clinic"><span>{user.clinic.name}</span><strong>{doctor ? "Doctor workspace" : "Assistant workspace"}</strong></div>
        <div className="user-menu"><div><strong>{user.display_name}</strong><span>{doctor ? "Doctor · Administrator" : "Assistant"}</span></div><button type="button" onClick={onSignOut}>Sign out</button></div>
      </header>
      <main className="workspace-main">
        <section className="workspace-title">
          <div><p className="eyebrow">Foundation ready</p><h1>{doctor ? "Doctor workspace" : "Assistant workspace"}</h1><p>The account and role boundary are active. Patient workflow will be added as the next isolated product task.</p></div>
          <div className="status-pill"><span /> Clinic access active</div>
        </section>
        <section className="workspace-grid">
          <article className="workspace-card workspace-card--wide">
            <div className="card-heading"><div><p className="eyebrow">Today</p><h2>{doctor ? "Patient flow" : "Clinic queue"}</h2></div><span className="count-badge">0</span></div>
            <EmptyState title="No patient workflow data yet" description="Patient records, appointments, check-in, With doctor, Doctor finished, and Checkout are intentionally reserved for the next implementation task." />
          </article>
          <article className="workspace-card">
            <div className="card-heading"><div><p className="eyebrow">Access</p><h2>Role boundary</h2></div></div>
            <dl className="access-list"><div><dt>Clinic</dt><dd>{user.clinic.name}</dd></div><div><dt>Role</dt><dd>{doctor ? "Doctor" : "Assistant"}</dd></div><div><dt>Administrator</dt><dd>{user.is_clinic_admin ? "Yes" : "No"}</dd></div></dl>
          </article>
          <article className="workspace-card">
            <div className="card-heading"><div><p className="eyebrow">Account</p><h2>Individual access</h2></div></div>
            <p className="card-copy">This workspace is protected by the individual staff account after the clinic-level sign in.</p>
            <button className="secondary-button" type="button" onClick={onLeaveClinic}>Leave clinic completely</button>
          </article>
        </section>
      </main>
    </div>
  );
}

function LoadingScreen() {
  return <div className="loading-screen"><Brand /><div className="loader" aria-label="Loading" /></div>;
}

export default function App() {
  const [screen, setScreen] = useState("loading");
  const [clinicToken, setClinicToken] = useState(null);
  const [staffToken, setStaffToken] = useState(null);
  const [clinicContext, setClinicContext] = useState(null);
  const [staffUser, setStaffUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);

  useEffect(() => {
    async function restore() {
      const storedStaffToken = localStorage.getItem(STAFF_TOKEN_KEY);
      const storedClinicToken = localStorage.getItem(CLINIC_TOKEN_KEY);
      if (storedStaffToken) {
        try {
          const payload = await apiRequest("/api/staff/me/", { staffToken: storedStaffToken });
          setStaffToken(storedStaffToken);
          setStaffUser(payload.user);
          setScreen("workspace");
          return;
        } catch {
          localStorage.removeItem(STAFF_TOKEN_KEY);
        }
      }
      if (storedClinicToken) {
        try {
          const payload = await apiRequest("/api/clinic/context/", { clinicToken: storedClinicToken });
          setClinicToken(storedClinicToken);
          setClinicContext(payload);
          setScreen("roles");
          return;
        } catch {
          localStorage.removeItem(CLINIC_TOKEN_KEY);
        }
      }
      setScreen("landing");
    }
    restore();
  }, []);

  async function createClinic(form) {
    const payload = await apiRequest("/api/clinics/", { method: "POST", data: form });
    localStorage.setItem(CLINIC_TOKEN_KEY, payload.clinic_access_token);
    setClinicToken(payload.clinic_access_token);
    setClinicContext({ clinic: payload.clinic, roles: payload.roles });
    setScreen("roles");
  }

  async function enterClinic(form) {
    const payload = await apiRequest("/api/clinics/enter/", { method: "POST", data: form });
    localStorage.setItem(CLINIC_TOKEN_KEY, payload.clinic_access_token);
    setClinicToken(payload.clinic_access_token);
    setClinicContext({ clinic: payload.clinic, roles: payload.roles });
    setScreen("roles");
  }

  function selectRole(role) {
    setSelectedRole(role);
    setScreen("staff");
  }

  async function submitStaff(form) {
    const exists = clinicContext.roles[selectedRole].exists;
    const payload = await apiRequest(exists ? "/api/staff/login/" : "/api/staff/register/", { method: "POST", data: form, clinicToken });
    localStorage.setItem(STAFF_TOKEN_KEY, payload.session_token);
    setStaffToken(payload.session_token);
    setStaffUser(payload.user);
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
    if (clinicToken) {
      try {
        const payload = await apiRequest("/api/clinic/context/", { clinicToken });
        setClinicContext(payload);
        setScreen("roles");
        return;
      } catch {
        leaveClinic();
      }
    }
  }

  async function leaveClinicCompletely() {
    if (staffToken) {
      try {
        await apiRequest("/api/staff/logout/", { method: "POST", staffToken });
      } catch {
        // Clearing local access remains valid when the server session has expired.
      }
    }
    leaveClinic();
  }

  function leaveClinic() {
    localStorage.removeItem(STAFF_TOKEN_KEY);
    localStorage.removeItem(CLINIC_TOKEN_KEY);
    setStaffToken(null);
    setClinicToken(null);
    setStaffUser(null);
    setClinicContext(null);
    setSelectedRole(null);
    setScreen("landing");
  }

  if (screen === "loading") return <LoadingScreen />;
  if (screen === "landing") return <Landing onCreate={() => setScreen("create-clinic")} onEnter={() => setScreen("enter-clinic")} />;
  if (screen === "create-clinic") return <ClinicForm mode="create" onSubmit={createClinic} onBack={() => setScreen("landing")} />;
  if (screen === "enter-clinic") return <ClinicForm mode="enter" onSubmit={enterClinic} onBack={() => setScreen("landing")} />;
  if (screen === "roles" && clinicContext) return <RoleSelection context={clinicContext} onSelect={selectRole} onLeave={leaveClinic} />;
  if (screen === "staff" && clinicContext && selectedRole) return <StaffForm role={selectedRole} exists={clinicContext.roles[selectedRole].exists} onSubmit={submitStaff} onBack={() => setScreen("roles")} />;
  if (screen === "workspace" && staffUser) return <Workspace user={staffUser} onSignOut={signOut} onLeaveClinic={leaveClinicCompletely} />;
  return <LoadingScreen />;
}
