import { useEffect, useState } from "react";

import AccountSettings from "./AccountSettings.jsx";
import { ACTIVE_DEVICE_TOKEN_KEY, ApiError, apiRequest } from "./api.js";
import PatientWorkspace from "./PatientWorkspace.jsx";
import { getPasskey } from "./webauthn.js";
import { Brand, Button, Checkbox, ErrorMessage, Field, SelectField, TextLink } from "./ui.jsx";
import "./deviceAccess.css";
import "./phase8.css";

const STAFF_TOKEN_KEY = "health-hub.staff-token";

function asError(error, fallback) {
  return error instanceof ApiError ? error : new ApiError(error?.message || fallback);
}

function AuthShell({ title, description, children, onBack, aside }) {
  return <main className="auth-layout">
    <section className="auth-intro">
      <Brand />
      <div>
        <p className="eyebrow">Health Hub</p>
        <h1>{title}</h1>
        <p>{description}</p>
        {aside}
      </div>
    </section>
    <section className="auth-panel">
      {onBack && <button className="back-button" type="button" onClick={onBack}>← Back</button>}
      {children}
    </section>
  </main>;
}

function LoadingScreen() {
  return <div className="loading-screen"><Brand /><div className="loader" aria-label="Loading" /></div>;
}

function RoleChoice({ onChoose, onRecovery }) {
  return <AuthShell title="How do you use Health Hub?" description="Choose your permanent account role. Doctor and Assistant accounts are separate and cannot change into one another.">
    <div className="panel-heading">
      <p className="eyebrow">Continue</p>
      <h2>Choose your role</h2>
    </div>
    <div className="choice-stack">
      <button className="role-card" type="button" onClick={() => onChoose("doctor")}>
        <span className="role-card__badge role-card__badge--doctor">D</span>
        <span className="role-card__content"><strong>Doctor</strong><span>Create and manage your clinics.</span></span><span>→</span>
      </button>
      <button className="role-card" type="button" onClick={() => onChoose("assistant")}>
        <span className="role-card__badge role-card__badge--assistant">A</span>
        <span className="role-card__content"><strong>Assistant</strong><span>Join clinics using a Doctor setup code.</span></span><span>→</span>
      </button>
    </div>
    <div className="auth-form-links"><TextLink onClick={onRecovery}>Forgot password?</TextLink></div>
  </AuthShell>;
}

function RoleEntry({ role, onLogin, onCreate, onBack, onRecovery }) {
  const label = role === "doctor" ? "Doctor" : "Assistant";
  return <AuthShell title={`${label} account`} description={`Continue with your ${label} personal account.`} onBack={onBack}>
    <div className="choice-stack">
      <button className="choice-card" type="button" onClick={onLogin}>
        <span className="choice-card__icon">→</span><span><strong>Sign in</strong><small>Email or phone + password, or a passkey.</small></span><span>→</span>
      </button>
      <button className="choice-card" type="button" onClick={onCreate}>
        <span className="choice-card__icon">+</span><span><strong>Create {label} account</strong><small>Both email and phone will be verified.</small></span><span>→</span>
      </button>
    </div>
    <div className="auth-form-links"><TextLink onClick={onRecovery}>Forgot password?</TextLink></div>
  </AuthShell>;
}

function LoginForm({ role, onSubmit, onPasskey, onBack, onRecovery }) {
  const [form, setForm] = useState({ identity: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const label = role === "doctor" ? "Doctor" : "Assistant";
  function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await onSubmit(form); } catch (reason) { setError(asError(reason, "Sign in failed.")); } finally { setBusy(false); }
  }
  async function passkey() {
    setBusy(true); setError(null);
    try { await onPasskey(form.identity); } catch (reason) { setError(asError(reason, "Passkey sign in failed.")); } finally { setBusy(false); }
  }
  return <AuthShell title={`Sign in as ${label}.`} description="Use your personal email or phone and password. A trusted browser does not require another verification code." onBack={onBack}>
    <form className="form" onSubmit={submit}>
      <ErrorMessage error={error} />
      <Field label="Email or phone" name="identity" value={form.identity} onChange={update} autoComplete="username" required />
      <Field label="Password" name="password" type="password" value={form.password} onChange={update} autoComplete="current-password" required />
      <Button variant="primary" disabled={busy}>{busy ? "Please wait…" : "Sign in"}</Button>
      <Button className="auth-secondary-action" type="button" disabled={busy || !form.identity.trim()} onClick={passkey}>Use passkey instead</Button>
    </form>
    <div className="auth-form-links"><TextLink onClick={onRecovery}>Forgot password?</TextLink></div>
  </AuthShell>;
}

function AccountCreateForm({ role, onSubmit, onBack }) {
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", password: "", password_confirm: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const label = role === "doctor" ? "Doctor" : "Assistant";
  function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await onSubmit(form); } catch (reason) { setError(asError(reason, "Account could not be created.")); } finally { setBusy(false); }
  }
  return <AuthShell title={`Create your ${label} account.`} description="Your role is permanent. Both personal email and phone must be verified before clinic access." onBack={onBack}>
    <form className="form" onSubmit={submit}>
      <ErrorMessage error={error} />
      <div className="field-row">
        <Field label="First name" name="first_name" value={form.first_name} onChange={update} required />
        <Field label="Last name" name="last_name" value={form.last_name} onChange={update} required />
      </div>
      <Field label="Personal email" name="email" type="email" value={form.email} onChange={update} autoComplete="email" required />
      <Field label="Personal phone" name="phone" value={form.phone} onChange={update} placeholder="+33…" autoComplete="tel" required />
      <Field label="Password" name="password" type="password" value={form.password} onChange={update} autoComplete="new-password" required />
      <Field label="Confirm password" name="password_confirm" type="password" value={form.password_confirm} onChange={update} autoComplete="new-password" required />
      <Button variant="primary" disabled={busy}>{busy ? "Creating…" : `Create ${label} account`}</Button>
    </form>
  </AuthShell>;
}

function VerificationGate({ user, staffToken, onUser, onDone }) {
  const [email, setEmail] = useState({ sent: false, code: "", dev: "" });
  const [phone, setPhone] = useState({ sent: false, code: "", dev: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function request(kind) {
    setBusy(true); setError(null);
    try {
      const payload = await apiRequest(`/api/staff/verify/${kind}/request/`, { method: "POST", staffToken });
      const setter = kind === "email" ? setEmail : setPhone;
      setter((current) => ({ ...current, sent: true, dev: payload.development_code ?? "" }));
    } catch (reason) { setError(asError(reason, "Verification code could not be sent.")); } finally { setBusy(false); }
  }

  async function confirm(kind, state) {
    setBusy(true); setError(null);
    try {
      const payload = await apiRequest(`/api/staff/verify/${kind}/confirm/`, { method: "POST", staffToken, data: { code: state.code } });
      onUser(payload.user);
      (kind === "email" ? setEmail : setPhone)({ sent: false, code: "", dev: "" });
      if (payload.user.account_ready) await onDone(payload.user);
    } catch (reason) { setError(asError(reason, "Verification code is invalid or expired.")); } finally { setBusy(false); }
  }

  return <AuthShell title="Verify your email and phone." description="Both contacts are required. This protects account recovery and new-device authorization.">
    <ErrorMessage error={error} />
    <div className="phase8-verification-grid">
      <div className="phase8-contact-card"><div><strong>Email</strong><span>{user.email} · {user.email_verified ? "Verified" : "Verification required"}</span></div>
        {!user.email_verified && (!email.sent ? <Button compact type="button" disabled={busy} onClick={() => request("email")}>Send code</Button> : <div className="phase8-inline-actions"><input value={email.code} onChange={(event) => setEmail({ ...email, code: event.target.value })} placeholder="6-digit code" /><Button compact type="button" disabled={busy} onClick={() => confirm("email", email)}>Verify</Button></div>)}
      </div>
      {email.dev && <p className="security-note">Development code: {email.dev}</p>}
      <div className="phase8-contact-card"><div><strong>Phone</strong><span>{user.phone} · {user.phone_verified ? "Verified" : "Verification required"}</span></div>
        {!user.phone_verified && (!phone.sent ? <Button compact type="button" disabled={busy} onClick={() => request("phone")}>Send SMS code</Button> : <div className="phase8-inline-actions"><input value={phone.code} onChange={(event) => setPhone({ ...phone, code: event.target.value })} placeholder="6-digit code" /><Button compact type="button" disabled={busy} onClick={() => confirm("phone", phone)}>Verify</Button></div>)}
      </div>
      {phone.dev && <p className="security-note">Development code: {phone.dev}</p>}
    </div>
  </AuthShell>;
}

function DeviceAuthorization({ staffToken, onAuthorized, onBack }) {
  const [channel, setChannel] = useState("email");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [dev, setDev] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true); setError(null);
    try {
      const payload = await apiRequest("/api/devices/contact/request/", { method: "POST", staffToken, data: { channel } });
      setSent(true); setDev(payload.development_code ?? "");
    } catch (reason) { setError(asError(reason, "Device verification could not be sent.")); } finally { setBusy(false); }
  }

  async function confirm() {
    setBusy(true); setError(null);
    try {
      const payload = await apiRequest("/api/devices/contact/confirm/", { method: "POST", staffToken, data: { code } });
      await onAuthorized(payload.device_token, payload.user);
    } catch (reason) { setError(asError(reason, "Device verification failed.")); } finally { setBusy(false); }
  }

  return <AuthShell title="Verify this new device." description="Choose either verified email or SMS. After one successful code, this browser is trusted for your account across all of your clinics." onBack={onBack}>
    <ErrorMessage error={error} />
    <div className="phase8-settings-section">
      <SelectField label="Verification channel" value={channel} onChange={(event) => { setChannel(event.target.value); setSent(false); setCode(""); }}>
        <option value="email">Verified email</option><option value="sms">Verified SMS</option>
      </SelectField>
      {!sent ? <Button variant="primary" type="button" disabled={busy} onClick={send}>Send verification code</Button> : <>
        <Field label="Verification code" value={code} onChange={(event) => setCode(event.target.value)} required />
        {dev && <p className="security-note">Development code: {dev}</p>}
        <Button variant="primary" type="button" disabled={busy} onClick={confirm}>Trust this browser</Button>
      </>}
    </div>
  </AuthShell>;
}

function ClinicCreateForm({ title = "Create your clinic.", onSubmit, onBack }) {
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await onSubmit(name); } catch (reason) { setError(asError(reason, "Clinic could not be created.")); } finally { setBusy(false); }
  }
  return <AuthShell title={title} description="Only a Doctor account can create a clinic. Your current browser becomes trusted automatically if this is your first clinic." onBack={onBack}>
    <form className="form" onSubmit={submit}><ErrorMessage error={error} /><Field label="Clinic name" value={name} onChange={(event) => setName(event.target.value)} required /><Button variant="primary" disabled={busy}>{busy ? "Creating…" : "Create clinic"}</Button></form>
  </AuthShell>;
}

function AssistantJoinForm({ onSubmit, onBack, additional = false }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await onSubmit(code); } catch (reason) { setError(asError(reason, "Clinic could not be joined.")); } finally { setBusy(false); }
  }
  return <AuthShell title={additional ? "Join another clinic." : "Join your clinic."} description="Enter the one-time setup code created by that clinic's Doctor. The code is valid for 24 hours." onBack={onBack}>
    <form className="form" onSubmit={submit}><ErrorMessage error={error} /><Field label="Assistant setup code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="ABCDE-12345" required /><Button variant="primary" disabled={busy}>{busy ? "Joining…" : "Join clinic"}</Button></form>
  </AuthShell>;
}

function ClinicPicker({ user, onChoose, onCreate, onJoin, onSettings, onSignOut }) {
  return <AuthShell title="Your clinics" description="Your account and trusted devices are global. Patient, appointment, queue, and task data remain isolated inside each clinic.">
    <div className="panel-heading"><p className="eyebrow">{user.display_name} · {user.role === "doctor" ? "Doctor" : "Assistant"}</p><h2>Choose a clinic</h2></div>
    <div className="phase8-clinic-list">
      {user.memberships?.map((membership) => <button className="choice-card phase8-clinic-button" key={membership.id} type="button" onClick={() => onChoose(membership)}>
        <span className={`role-card__badge role-card__badge--${user.role}`}>{user.role[0].toUpperCase()}</span><span><strong>{membership.clinic.name}</strong><small>{user.role === "doctor" ? "Doctor · Administrator" : "Assistant"}</small></span><span>→</span>
      </button>)}
    </div>
    <div className="phase8-inline-actions">
      {user.role === "doctor" ? <Button type="button" onClick={onCreate}>Create another clinic</Button> : <Button type="button" onClick={onJoin}>Join another clinic</Button>}
      <Button type="button" onClick={onSettings}>Account settings</Button><Button type="button" onClick={onSignOut}>Sign out</Button>
    </div>
  </AuthShell>;
}

function RecoveryFlow({ onBack, onComplete }) {
  const [step, setStep] = useState("request"), [identity, setIdentity] = useState(""), [channel, setChannel] = useState("email"), [code, setCode] = useState(""), [recoveryToken, setRecoveryToken] = useState(""), [password, setPassword] = useState(""), [confirm, setConfirm] = useState(""), [error, setError] = useState(null), [busy, setBusy] = useState(false), [offline, setOffline] = useState(false);
  async function request(event) { event.preventDefault(); setBusy(true); setError(null); try { if (offline) { const payload = await apiRequest("/api/recovery/code/confirm/", { method: "POST", data: { identity, code } }); setRecoveryToken(payload.recovery_token); setStep("reset"); } else { await apiRequest("/api/recovery/request/", { method: "POST", data: { identity, channel } }); setStep("confirm"); } } catch (reason) { setError(asError(reason, "Recovery could not be started.")); } finally { setBusy(false); } }
  async function verify(event) { event.preventDefault(); setBusy(true); setError(null); try { const payload = await apiRequest("/api/recovery/confirm/", { method: "POST", data: { identity, code } }); setRecoveryToken(payload.recovery_token); setStep("reset"); } catch (reason) { setError(asError(reason, "Recovery code is invalid or expired.")); } finally { setBusy(false); } }
  async function reset(event) { event.preventDefault(); setBusy(true); setError(null); try { await apiRequest("/api/recovery/reset/", { method: "POST", data: { recovery_token: recoveryToken, password, password_confirm: confirm } }); onComplete(); } catch (reason) { setError(asError(reason, "Password could not be reset.")); } finally { setBusy(false); } }
  return <AuthShell title="Recover your personal account." description="Use verified email or SMS. Doctor accounts may alternatively use one unused offline recovery code." onBack={onBack}>
    <ErrorMessage error={error} />
    {step === "request" && <form className="form recovery-form" onSubmit={request}>
      <Field label="Email or phone" value={identity} onChange={(event) => setIdentity(event.target.value)} required />
      <Checkbox label="Use a Doctor offline recovery code" checked={offline} onChange={(event) => { setOffline(event.target.checked); setCode(""); }} />
      {offline ? <Field label="Offline recovery code" value={code} onChange={(event) => setCode(event.target.value)} required /> : <SelectField label="Recovery channel" value={channel} onChange={(event) => setChannel(event.target.value)}><option value="email">Email</option><option value="sms">SMS</option></SelectField>}
      <Button variant="primary" disabled={busy}>Continue</Button>
    </form>}
    {step === "confirm" && <form className="form" onSubmit={verify}><p className="security-note">If the account and chosen verified channel exist, a code has been sent.</p><Field label="Recovery code" value={code} onChange={(event) => setCode(event.target.value)} required /><Button variant="primary" disabled={busy}>Verify code</Button></form>}
    {step === "reset" && <form className="form" onSubmit={reset}><Field label="New password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /><Field label="Confirm new password" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required /><Button variant="primary" disabled={busy}>Reset password</Button></form>}
  </AuthShell>;
}

function AccountSettingsStandalone({ user, staffToken, onUserChange, onAccountDeleted, onBack }) {
  return <AuthShell title="Account settings" description="These settings follow your personal account across every clinic." onBack={onBack}><div className="panel-heading"><h2>{user.display_name}</h2><p>{user.email} · {user.phone}</p></div><AccountSettings user={user} staffToken={staffToken} onUserChange={onUserChange} onAccountDeleted={onAccountDeleted} /></AuthShell>;
}

export default function ProductionApp() {
  const [screen, setScreen] = useState("loading");
  const [role, setRole] = useState(null);
  const [staffToken, setStaffToken] = useState(null);
  const [user, setUser] = useState(null);

  function saveSession(token) {
    localStorage.setItem(STAFF_TOKEN_KEY, token);
    setStaffToken(token);
  }

  async function openMembership(membership, currentUser = user, token = staffToken) {
    const deviceToken = localStorage.getItem(ACTIVE_DEVICE_TOKEN_KEY);
    const payload = await apiRequest("/api/staff/select-clinic/", {
      method: "POST",
      staffToken: token,
      deviceToken,
      data: { clinic_id: membership.clinic.id, workspace_role: currentUser.role },
    });
    setUser(payload.user); setScreen("workspace");
  }

  async function routeReady(nextUser, token = staffToken, { forcePicker = false } = {}) {
    setUser(nextUser);
    if (!nextUser.account_ready) { setScreen("verify"); return; }
    if (nextUser.clinic && nextUser.workspace_role) { setScreen("workspace"); return; }

    const memberships = nextUser.memberships ?? [];

    // A brand-new account has no trusted devices yet and gets its first device
    // automatically when the first clinic is created/joined. A dormant or
    // otherwise existing account that already has trusted devices must prove
    // identity again before a new browser can rejoin a clinic.
    if (!nextUser.device_trusted && nextUser.has_trusted_devices) {
      setScreen("device-auth");
      return;
    }
    if (!memberships.length) {
      setScreen(nextUser.role === "doctor" ? "create-clinic" : "join-clinic");
      return;
    }
    if (!nextUser.device_trusted) {
      setScreen("device-auth");
      return;
    }
    if (!forcePicker && memberships.length === 1) {
      await openMembership(memberships[0], nextUser, token);
      return;
    }
    setScreen("clinics");
  }

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const token = localStorage.getItem(STAFF_TOKEN_KEY);
      if (!token) { if (!cancelled) setScreen("role"); return; }
      try {
        const payload = await apiRequest("/api/staff/me/", { staffToken: token });
        if (cancelled) return;
        setRole(payload.user.role); setStaffToken(token); await routeReady(payload.user, token);
      } catch {
        if (cancelled) return;
        localStorage.removeItem(STAFF_TOKEN_KEY);
        setStaffToken(null); setUser(null); setScreen("role");
      }
    }
    restore();
    return () => { cancelled = true; };
  }, []);

  async function login(form) {
    const deviceToken = localStorage.getItem(ACTIVE_DEVICE_TOKEN_KEY);
    const payload = await apiRequest("/api/staff/login/", { method: "POST", deviceToken, data: { role, ...form } });
    saveSession(payload.session_token); await routeReady(payload.user, payload.session_token);
  }

  async function passkeyLogin(identity) {
    const begin = await apiRequest("/api/passkeys/auth/options/", { method: "POST", data: { role, identity } });
    const credential = await getPasskey(begin.public_key);
    const deviceToken = localStorage.getItem(ACTIVE_DEVICE_TOKEN_KEY);
    const payload = await apiRequest("/api/passkeys/auth/complete/", { method: "POST", deviceToken, data: { role, identity, credential } });
    saveSession(payload.session_token); await routeReady(payload.user, payload.session_token);
  }

  async function createAccount(form) {
    const payload = await apiRequest("/api/staff/register/", { method: "POST", data: { role, ...form } });
    saveSession(payload.session_token); setUser(payload.user); setScreen("verify");
  }

  async function verificationDone(nextUser) {
    await routeReady(nextUser, staffToken);
  }

  async function deviceAuthorized(deviceToken, nextUser) {
    localStorage.setItem(ACTIVE_DEVICE_TOKEN_KEY, deviceToken);
    await routeReady({ ...nextUser, device_trusted: true, has_trusted_devices: true }, staffToken);
  }

  async function createClinic(name) {
    const payload = await apiRequest("/api/clinics/", { method: "POST", staffToken, data: { name } });
    if (payload.device_token) localStorage.setItem(ACTIVE_DEVICE_TOKEN_KEY, payload.device_token);
    setUser(payload.user); setScreen("workspace");
  }

  async function joinClinic(code) {
    const payload = await apiRequest("/api/clinic/assistant/setup/claim/", { method: "POST", staffToken, data: { code } });
    if (payload.device_token) localStorage.setItem(ACTIVE_DEVICE_TOKEN_KEY, payload.device_token);
    setUser(payload.user); setScreen("workspace");
  }

  async function showClinics() {
    try {
      const payload = await apiRequest("/api/staff/leave-clinic/", { method: "POST", staffToken });
      setUser(payload.user); setScreen("clinics");
    } catch { await signOut(); }
  }

  async function switchWorkspace() {
    if (!user?.clinic || user.role !== "doctor") return;
    const target = user.workspace_role === "doctor" ? "assistant" : "doctor";
    const payload = await apiRequest("/api/staff/select-clinic/", {
      method: "POST",
      staffToken,
      data: { clinic_id: user.clinic.id, workspace_role: target },
    });
    setUser(payload.user);
  }

  async function signOut() {
    try { if (staffToken) await apiRequest("/api/staff/logout/", { method: "POST", staffToken }); } catch { /* local sign-out still proceeds */ }
    localStorage.removeItem(STAFF_TOKEN_KEY);
    setStaffToken(null); setUser(null); setRole(null); setScreen("role");
  }

  function accountDeleted() {
    localStorage.removeItem(STAFF_TOKEN_KEY);
    localStorage.removeItem(ACTIVE_DEVICE_TOKEN_KEY);
    setStaffToken(null); setUser(null); setRole(null); setScreen("role");
  }

  if (screen === "loading") return <LoadingScreen />;
  if (screen === "role") return <RoleChoice onChoose={(value) => { setRole(value); setScreen("role-entry"); }} onRecovery={() => setScreen("recovery")} />;
  if (screen === "role-entry") return <RoleEntry role={role} onLogin={() => setScreen("login")} onCreate={() => setScreen("create-account")} onBack={() => setScreen("role")} onRecovery={() => setScreen("recovery")} />;
  if (screen === "login") return <LoginForm role={role} onSubmit={login} onPasskey={passkeyLogin} onBack={() => setScreen("role-entry")} onRecovery={() => setScreen("recovery")} />;
  if (screen === "create-account") return <AccountCreateForm role={role} onSubmit={createAccount} onBack={() => setScreen("role-entry")} />;
  if (screen === "recovery") return <RecoveryFlow onBack={() => setScreen(role ? "role-entry" : "role")} onComplete={() => setScreen(role ? "login" : "role")} />;
  if (screen === "verify" && user && staffToken) return <VerificationGate user={user} staffToken={staffToken} onUser={setUser} onDone={verificationDone} />;
  if (screen === "device-auth" && user && staffToken) return <DeviceAuthorization staffToken={staffToken} onAuthorized={deviceAuthorized} onBack={() => setScreen("role")} />;
  if (screen === "create-clinic" && user?.role === "doctor") return <ClinicCreateForm onSubmit={createClinic} onBack={user.memberships?.length ? () => setScreen("clinics") : undefined} />;
  if (screen === "join-clinic" && user?.role === "assistant") return <AssistantJoinForm onSubmit={joinClinic} additional={Boolean(user.memberships?.length)} onBack={user.memberships?.length ? () => setScreen("clinics") : undefined} />;
  if (screen === "clinics" && user && staffToken) return <ClinicPicker user={user} onChoose={(membership) => openMembership(membership)} onCreate={() => setScreen("create-clinic")} onJoin={() => setScreen("join-clinic")} onSettings={() => setScreen("account-settings")} onSignOut={signOut} />;
  if (screen === "account-settings" && user && staffToken) return <AccountSettingsStandalone user={user} staffToken={staffToken} onUserChange={setUser} onAccountDeleted={accountDeleted} onBack={() => setScreen("clinics")} />;
  if (screen === "workspace" && user && staffToken) return <PatientWorkspace user={user} staffToken={staffToken} onSignOut={signOut} onSwitchClinic={showClinics} onSwitchWorkspace={switchWorkspace} onUserChange={setUser} onAccountDeleted={accountDeleted} />;
  return <LoadingScreen />;
}
