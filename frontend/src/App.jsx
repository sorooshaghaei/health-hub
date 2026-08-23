import { useEffect, useRef, useState } from "react";

import AccountSettings from "./AccountSettings.jsx";
import { ApiError, apiRequest } from "./api.js";
import ClinicWorkingHours from "./ClinicWorkingHours.jsx";
import { PasswordField, PasswordPair, useResendCountdown, verificationCodeComplete, verificationCodeValue } from "./credentialUi.jsx";
import { ACTIVE_DEVICE_TOKEN_KEY, clearActiveTrustedDevice, forgetTrustedDevice, refreshTrustedDeviceIdentity, rememberTrustedDevice, trustedDeviceTokenForIdentity } from "./deviceCredentials.js";
import { passwordRequirements } from "./passwordRules.js";
import PatientWorkspace from "./PatientWorkspace.jsx";
import { normalizeInternationalPhone } from "./phoneNumbers.js";
import { clearOnboardingHistory, onboardingHistoryScreen, primeFirstClinicHistory, replaceOnboardingHistory } from "./onboardingHistory.js";
import { getPasskey } from "./webauthn.js";
import { Brand, Button, ErrorMessage, Field, RadioCards, SelectField, TextLink } from "./ui.jsx";
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

function RoleChoice({ onChoose }) {
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
  </AuthShell>;
}

function RoleEntry({ role, onLogin, onCreate, onBack }) {
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
  </AuthShell>;
}

function LoginForm({ role, onSubmit, onPasskey, onBack, onRecovery }) {
  const [form, setForm] = useState({ identity: "", password: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const label = role === "doctor" ? "Doctor" : "Assistant";
  function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); setError(null); }
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
      <ErrorMessage error={error} focus />
      <Field label="Email or phone" name="identity" value={form.identity} onChange={update} autoComplete="username" required />
      <PasswordField label="Password" name="password" value={form.password} onChange={update} autoComplete="current-password" required />
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
  function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); setError(null); }
  const passwordValid = passwordRequirements(
    form.password,
    form.password_confirm,
    [form.first_name, form.last_name, form.email, form.phone],
  ).valid;
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      await onSubmit({ ...form, phone: normalizeInternationalPhone(form.phone) });
    } catch (reason) { setError(asError(reason, "Account could not be created.")); } finally { setBusy(false); }
  }
  return <AuthShell title={`Create your ${label} account.`} description="Your role is permanent. Both personal email and phone must be verified before clinic access." onBack={onBack}>
    <form className="form" onSubmit={submit}>
      <ErrorMessage error={error} focus />
      <div className="field-row">
        <Field label="First name" name="first_name" value={form.first_name} onChange={update} required />
        <Field label="Last name" name="last_name" value={form.last_name} onChange={update} required />
      </div>
      <Field label="Personal email" name="email" type="email" value={form.email} onChange={update} autoComplete="email" required />
      <Field label="Personal phone" name="phone" value={form.phone} onChange={update} placeholder="+33 6 12 34 56 78" hint="Use the full international format beginning with +." inputMode="tel" autoComplete="tel" required />
      <PasswordPair
        password={form.password}
        confirmation={form.password_confirm}
        onPasswordChange={update}
        onConfirmationChange={update}
        personalValues={[form.first_name, form.last_name, form.email, form.phone]}
      />
      <Button variant="primary" disabled={busy || !passwordValid}>{busy ? "Creating…" : `Create ${label} account`}</Button>
    </form>
  </AuthShell>;
}

function VerificationGate({ user, staffToken, onUser, onDone, onSignOut }) {
  const initialContactState = (value) => ({ sent: false, code: "", dev: "", editing: false, value, currentPassword: "" });
  const [email, setEmail] = useState(() => initialContactState(user.email));
  const [phone, setPhone] = useState(() => initialContactState(user.phone));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const emailResend = useResendCountdown();
  const phoneResend = useResendCountdown();

  useEffect(() => {
    setEmail((current) => current.editing ? current : { ...current, value: user.email });
    setPhone((current) => current.editing ? current : { ...current, value: user.phone });
  }, [user.email, user.phone]);

  useEffect(() => {
    let cancelled = false;
    apiRequest("/api/staff/verification-state/", { staffToken })
      .then((payload) => {
        if (cancelled) return;
        for (const [kind, setter, countdown] of [["email", setEmail, emailResend], ["phone", setPhone, phoneResend]]) {
          const challenge = payload[kind];
          if (!challenge) continue;
          setter((current) => ({ ...current, sent: true, code: "", dev: challenge.development_code ?? "", editing: false }));
          countdown.start(challenge);
        }
      })
      .catch((reason) => { if (!cancelled) setError(asError(reason, "Verification status could not be restored.")); })
      .finally(() => { if (!cancelled) setRestoring(false); });
    return () => { cancelled = true; };
  }, [staffToken]);

  async function request(kind) {
    setBusy(true); setError(null);
    try {
      const payload = await apiRequest(`/api/staff/verify/${kind}/request/`, { method: "POST", staffToken });
      const setter = kind === "email" ? setEmail : setPhone;
      setter((current) => ({ ...current, sent: true, code: "", dev: payload.development_code ?? "" }));
      (kind === "email" ? emailResend : phoneResend).start(payload);
    } catch (reason) { setError(asError(reason, "Verification code could not be sent.")); } finally { setBusy(false); }
  }

  async function confirm(kind, state) {
    setBusy(true); setError(null);
    try {
      const payload = await apiRequest(`/api/staff/verify/${kind}/confirm/`, { method: "POST", staffToken, data: { code: state.code } });
      onUser(payload.user);
      (kind === "email" ? setEmail : setPhone)(initialContactState(payload.user[kind]));
      (kind === "email" ? emailResend : phoneResend).reset();
      if (payload.user.account_ready) await onDone(payload.user);
    } catch (reason) { setError(asError(reason, "Verification code is invalid or expired.")); } finally { setBusy(false); }
  }

  async function saveContact(event, kind, state) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const value = kind === "phone" ? normalizeInternationalPhone(state.value) : state.value;
      const payload = await apiRequest("/api/staff/verification-contact/", {
        method: "PATCH",
        staffToken,
        data: { kind, value, current_password: state.currentPassword },
      });
      onUser(payload.user);
      (kind === "email" ? setEmail : setPhone)(initialContactState(payload.user[kind]));
      (kind === "email" ? emailResend : phoneResend).reset();
    } catch (reason) { setError(asError(reason, `${kind === "email" ? "Email" : "Phone"} could not be changed.`)); } finally { setBusy(false); }
  }

  function renderContact(kind, state, setter, countdown) {
    const label = kind === "email" ? "Email" : "Phone";
    const verified = user[`${kind}_verified`];
    return <>
      <div className="phase8-contact-card">
        <div><strong>{label}</strong><span>{user[kind]} · {verified ? "Verified" : "Verification required"}</span></div>
        <Button compact type="button" disabled={busy || restoring} onClick={() => { setError(null); setter((current) => ({ ...current, editing: true, sent: false, code: "", dev: "", value: user[kind] })); }}>Edit {kind}</Button>
      </div>
      {state.editing ? <form className="verification-contact-editor" onSubmit={(event) => saveContact(event, kind, state)}>
        <Field label={kind === "email" ? "New email" : "New phone number"} type={kind === "email" ? "email" : "tel"} value={state.value} onChange={(event) => { setter({ ...state, value: event.target.value }); setError(null); }} hint={kind === "phone" ? "Use the full international format beginning with +." : undefined} inputMode={kind === "phone" ? "tel" : undefined} autoComplete={kind === "email" ? "email" : "tel"} required />
        <PasswordField label="Current password" value={state.currentPassword} onChange={(event) => { setter({ ...state, currentPassword: event.target.value }); setError(null); }} autoComplete="current-password" required />
        <div className="phase8-inline-actions"><Button variant="primary" compact disabled={busy}>Save {kind}</Button><Button type="button" disabled={busy} onClick={() => { setError(null); setter(initialContactState(user[kind])); }}>Cancel</Button></div>
      </form> : !verified && (!state.sent ? <Button compact type="button" disabled={busy || restoring} onClick={() => request(kind)}>{kind === "email" ? "Send code" : "Send SMS code"}</Button> : <div className="verification-contact-editor">
        <Field label={`${label} verification code`} inputMode="numeric" autoComplete="one-time-code" value={state.code} onChange={(event) => { setter({ ...state, code: verificationCodeValue(event.target.value) }); setError(null); }} maxLength={6} required />
        <div className="verification-code-actions"><Button compact type="button" disabled={busy || !verificationCodeComplete(state.code)} onClick={() => confirm(kind, state)}>Verify</Button><Button variant="text" type="button" disabled={busy || countdown.seconds > 0} onClick={() => request(kind)}>{countdown.seconds > 0 ? `Resend code in ${countdown.seconds}s` : "Resend code"}</Button><Button variant="text" type="button" disabled={busy} onClick={() => { setError(null); setter({ ...state, editing: true, sent: false, code: "", dev: "", value: user[kind] }); }}>Change {kind}</Button></div>
      </div>)}
      {state.dev && <p className="security-note">Development code: {state.dev}</p>}
    </>;
  }

  return <AuthShell title="Verify your email and phone." description="Both contacts are required. Correct either contact here; only the contact you edit will need verification again.">
    <ErrorMessage error={error} focus />
    <div className="phase8-verification-grid">
      {renderContact("email", email, setEmail, emailResend)}
      {renderContact("phone", phone, setPhone, phoneResend)}
    </div>
    <div className="auth-form-links"><TextLink onClick={onSignOut}>Sign out</TextLink></div>
  </AuthShell>;
}

function DeviceAuthorization({ staffToken, onAuthorized, onBack }) {
  const [channel, setChannel] = useState("email");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [dev, setDev] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const resend = useResendCountdown();

  useEffect(() => {
    let cancelled = false;
    apiRequest("/api/staff/verification-state/", { staffToken })
      .then((payload) => {
        if (cancelled || !payload.device_authorize) return;
        setChannel(payload.device_authorize.channel);
        setSent(true);
        setDev(payload.device_authorize.development_code ?? "");
        resend.start(payload.device_authorize);
      })
      .catch((reason) => { if (!cancelled) setError(asError(reason, "Device verification status could not be restored.")); })
      .finally(() => { if (!cancelled) setRestoring(false); });
    return () => { cancelled = true; };
  }, [staffToken]);

  async function send() {
    setBusy(true); setError(null);
    try {
      const payload = await apiRequest("/api/devices/contact/request/", { method: "POST", staffToken, data: { channel } });
      setSent(true); setCode(""); setDev(payload.development_code ?? "");
      resend.start(payload);
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
    <ErrorMessage error={error} focus />
    <div className="phase8-settings-section">
      <SelectField label="Verification channel" value={channel} disabled={restoring} onChange={(event) => { setChannel(event.target.value); setSent(false); setCode(""); setDev(""); setError(null); }}>
        <option value="email">Verified email</option><option value="sms">Verified SMS</option>
      </SelectField>
      {!sent ? <Button variant="primary" type="button" disabled={busy || restoring || resend.seconds > 0} onClick={send}>{resend.seconds > 0 ? `Send another code in ${resend.seconds}s` : "Send verification code"}</Button> : <>
        <Field label="Verification code" value={code} onChange={(event) => { setCode(verificationCodeValue(event.target.value)); setError(null); }} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
        {dev && <p className="security-note">Development code: {dev}</p>}
        <Button variant="primary" type="button" disabled={busy || !verificationCodeComplete(code)} onClick={confirm}>Trust this browser</Button>
        <div className="resend-actions"><Button variant="text" type="button" disabled={busy || resend.seconds > 0} onClick={send}>{resend.seconds > 0 ? `Resend code in ${resend.seconds}s` : "Resend code"}</Button><Button variant="text" type="button" disabled={busy} onClick={() => { setSent(false); setCode(""); setDev(""); setError(null); }}>Use another channel</Button></div>
      </>}
    </div>
  </AuthShell>;
}

function ClinicCreateForm({ title = "Create your clinic.", onSubmit, onBack, onAccount, onSignOut }) {
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(null);
    try { await onSubmit(name); } catch (reason) { setError(asError(reason, "Clinic could not be created.")); } finally { setBusy(false); }
  }
  return <AuthShell title={title} description="Only a Doctor account can create a clinic. Your current browser becomes trusted automatically if this is your first clinic." onBack={onBack}>
    <form className="form" onSubmit={submit}><ErrorMessage error={error} focus /><Field label="Clinic name" value={name} onChange={(event) => { setName(event.target.value); setError(null); }} required /><Button variant="primary" disabled={busy}>{busy ? "Creating…" : "Create clinic"}</Button></form>
    {(onAccount || onSignOut) && <div className="auth-form-links">
      {onAccount && <TextLink onClick={onAccount}>Back to account</TextLink>}
      {onSignOut && <TextLink onClick={onSignOut}>Sign out</TextLink>}
    </div>}
  </AuthShell>;
}

function AssistantJoinForm({ onSubmit, onAccount, onClinics, onSignOut, additional = false }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError(null);
    try { await onSubmit(code); } catch (reason) { setError(asError(reason, "Clinic could not be joined.")); } finally { submitting.current = false; setBusy(false); }
  }
  return <AuthShell title={additional ? "Join another clinic." : "Join your clinic."} description="Enter the one-time setup code created by that clinic's Doctor. The code is valid for 24 hours.">
    <form className="form" onSubmit={submit}><ErrorMessage error={error} focus /><Field label="Assistant setup code" value={code} onChange={(event) => { setCode(event.target.value); setError(null); }} placeholder="ABCDE-12345" required /><Button variant="primary" disabled={busy}>{busy ? "Joining…" : "Join clinic"}</Button></form>
    <div className="auth-form-links">
      <TextLink onClick={onAccount}>Back to account</TextLink>
      {additional && <TextLink onClick={onClinics}>Your clinics</TextLink>}
      <TextLink onClick={onSignOut}>Sign out</TextLink>
    </div>
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

function ClinicDetails({ membership, user, staffToken, onBack, onOpenWorkspace }) {
  const clinic = membership.clinic;
  const editable = user.role === "doctor" && membership.is_clinic_admin;
  return <AuthShell title={clinic.name} description="Review this clinic before opening its workspace." onBack={onBack}>
    <div className="panel-heading"><p className="eyebrow">Selected clinic</p><h2>{clinic.name}</h2><p>{editable ? "Doctor · Administrator" : "Assistant · Read-only clinic settings"}</p></div>
    <div className="clinic-details-actions"><Button variant="primary" compact type="button" onClick={onOpenWorkspace}>Open clinic workspace</Button></div>
    <ClinicWorkingHours clinic={clinic} editable={editable} staffToken={staffToken} />
  </AuthShell>;
}

function RecoveryFlow({ role, onBack, onComplete }) {
  const [step, setStep] = useState("request"), [identity, setIdentity] = useState(""), [channel, setChannel] = useState("email"), [code, setCode] = useState(""), [recoveryToken, setRecoveryToken] = useState(""), [password, setPassword] = useState(""), [confirm, setConfirm] = useState(""), [error, setError] = useState(null), [busy, setBusy] = useState(false), [method, setMethod] = useState("contact"), [dev, setDev] = useState("");
  const resend = useResendCountdown();
  const doctorRecovery = role === "doctor";
  const resetPasswordValid = passwordRequirements(password, confirm, [identity]).valid;
  async function sendRecoveryCode() { const payload = await apiRequest("/api/recovery/request/", { method: "POST", data: { identity, channel } }); setDev(payload.development_code ?? ""); resend.start(payload); return payload; }
  async function request(event) { event.preventDefault(); setBusy(true); setError(null); try { if (doctorRecovery && method === "offline") { const payload = await apiRequest("/api/recovery/code/confirm/", { method: "POST", data: { identity, code } }); setRecoveryToken(payload.recovery_token); setStep("reset"); } else { await sendRecoveryCode(); setStep("confirm"); } } catch (reason) { setError(asError(reason, "Recovery could not be started.")); } finally { setBusy(false); } }
  async function resendCode() { setBusy(true); setError(null); try { await sendRecoveryCode(); } catch (reason) { setError(asError(reason, "Recovery code could not be resent.")); } finally { setBusy(false); } }
  async function verify(event) { event.preventDefault(); setBusy(true); setError(null); try { const payload = await apiRequest("/api/recovery/confirm/", { method: "POST", data: { identity, code } }); setRecoveryToken(payload.recovery_token); setStep("reset"); } catch (reason) { setError(asError(reason, "Recovery code is invalid or expired.")); } finally { setBusy(false); } }
  async function reset(event) { event.preventDefault(); setBusy(true); setError(null); try { await apiRequest("/api/recovery/reset/", { method: "POST", data: { recovery_token: recoveryToken, password, password_confirm: confirm } }); onComplete(); } catch (reason) { setError(asError(reason, "Password could not be reset.")); } finally { setBusy(false); } }
  return <AuthShell title="Recover your personal account." description={doctorRecovery ? "Use verified email or SMS, or one unused Doctor offline recovery code." : "Use your verified personal email address or phone number."} onBack={onBack}>
    <ErrorMessage error={error} focus />
    {step === "request" && <form className="form recovery-form" onSubmit={request}>
      <Field label="Email or phone" value={identity} onChange={(event) => { setIdentity(event.target.value); setError(null); }} required />
      {doctorRecovery && <RadioCards legend="Recovery method" name="recovery-method" value={method} onChange={(event) => { setMethod(event.target.value); setCode(""); setError(null); }} options={[{ value: "contact", label: "Email or SMS", hint: "Send a code to one verified personal contact." }, { value: "offline", label: "Doctor offline code", hint: "Use one unused code from a Doctor recovery-code set." }]} />}
      {doctorRecovery && method === "offline" ? <Field label="Offline recovery code" value={code} onChange={(event) => { setCode(event.target.value); setError(null); }} required /> : <SelectField label="Recovery channel" value={channel} onChange={(event) => { setChannel(event.target.value); setError(null); }}><option value="email">Email</option><option value="sms">SMS</option></SelectField>}
      <Button variant="primary" disabled={busy || ((!doctorRecovery || method === "contact") && resend.seconds > 0)}>{(!doctorRecovery || method === "contact") && resend.seconds > 0 ? `Send another code in ${resend.seconds}s` : "Continue"}</Button>
    </form>}
    {step === "confirm" && <form className="form" onSubmit={verify}><p className="security-note">If the account and chosen verified channel exist, a code has been sent.</p><Field label="Recovery code" value={code} onChange={(event) => { setCode(verificationCodeValue(event.target.value)); setError(null); }} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />{dev && <p className="security-note">Development code: {dev}</p>}<Button variant="primary" disabled={busy || !verificationCodeComplete(code)}>Verify code</Button><div className="resend-actions"><Button variant="text" type="button" disabled={busy || resend.seconds > 0} onClick={resendCode}>{resend.seconds > 0 ? `Resend code in ${resend.seconds}s` : "Resend code"}</Button><Button variant="text" type="button" disabled={busy} onClick={() => { setStep("request"); setCode(""); setDev(""); setError(null); }}>Change email, phone, or method</Button></div></form>}
    {step === "reset" && <form className="form" onSubmit={reset}><PasswordPair password={password} confirmation={confirm} onPasswordChange={(event) => { setPassword(event.target.value); setError(null); }} onConfirmationChange={(event) => { setConfirm(event.target.value); setError(null); }} personalValues={[identity]} passwordLabel="New password" confirmationLabel="Confirm new password" /><Button variant="primary" disabled={busy || !resetPasswordValid}>Reset password</Button></form>}
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
  const [selectedMembership, setSelectedMembership] = useState(null);
  const [accountSettingsReturnScreen, setAccountSettingsReturnScreen] = useState("clinics");

  useEffect(() => {
    if (user) refreshTrustedDeviceIdentity(user);
  }, [user?.id, user?.role, user?.email, user?.phone]);

  useEffect(() => {
    function restoreOnboardingScreen(event) {
      const nextScreen = onboardingHistoryScreen(event.state);
      if (!nextScreen || !user || !staffToken || !user.account_ready) return;
      if (user.memberships?.length) {
        setScreen(user.clinic && user.workspace_role ? "workspace" : "clinics");
        return;
      }
      const clinicScreen = user.role === "doctor" ? "create-clinic" : "join-clinic";
      if (nextScreen === "account-settings") {
        setAccountSettingsReturnScreen(clinicScreen);
        setScreen("account-settings");
      } else if (nextScreen === clinicScreen) {
        setScreen(clinicScreen);
      }
    }
    window.addEventListener("popstate", restoreOnboardingScreen);
    return () => window.removeEventListener("popstate", restoreOnboardingScreen);
  }, [staffToken, user]);

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
      const clinicScreen = nextUser.role === "doctor" ? "create-clinic" : "join-clinic";
      setAccountSettingsReturnScreen(clinicScreen);
      primeFirstClinicHistory(clinicScreen);
      setScreen(clinicScreen);
      return;
    }
    clearOnboardingHistory();
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
        const activeDeviceToken = localStorage.getItem(ACTIVE_DEVICE_TOKEN_KEY);
        if (payload.user.device_trusted && activeDeviceToken) rememberTrustedDevice(payload.user, activeDeviceToken);
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
    const deviceToken = trustedDeviceTokenForIdentity(role, form.identity);
    const payload = await apiRequest("/api/staff/login/", { method: "POST", deviceToken, data: { role, ...form } });
    if (payload.user.device_trusted && deviceToken) rememberTrustedDevice(payload.user, deviceToken);
    else { if (deviceToken) forgetTrustedDevice(payload.user.id); clearActiveTrustedDevice(); }
    saveSession(payload.session_token); await routeReady(payload.user, payload.session_token);
  }

  async function passkeyLogin(identity) {
    const begin = await apiRequest("/api/passkeys/auth/options/", { method: "POST", data: { role, identity } });
    const credential = await getPasskey(begin.public_key);
    const deviceToken = trustedDeviceTokenForIdentity(role, identity);
    const payload = await apiRequest("/api/passkeys/auth/complete/", { method: "POST", deviceToken, data: { role, identity, credential } });
    if (payload.user.device_trusted && deviceToken) rememberTrustedDevice(payload.user, deviceToken);
    else { if (deviceToken) forgetTrustedDevice(payload.user.id); clearActiveTrustedDevice(); }
    saveSession(payload.session_token); await routeReady(payload.user, payload.session_token);
  }

  async function createAccount(form) {
    clearActiveTrustedDevice();
    const payload = await apiRequest("/api/staff/register/", { method: "POST", data: { role, ...form } });
    saveSession(payload.session_token); setUser(payload.user); setScreen("verify");
  }

  async function verificationDone(nextUser) {
    await routeReady(nextUser, staffToken);
  }

  async function deviceAuthorized(deviceToken, nextUser) {
    rememberTrustedDevice(nextUser, deviceToken);
    await routeReady({ ...nextUser, device_trusted: true, has_trusted_devices: true }, staffToken);
  }

  async function createClinic(name) {
    const payload = await apiRequest("/api/clinics/", { method: "POST", staffToken, data: { name } });
    if (payload.device_token) rememberTrustedDevice(payload.user, payload.device_token);
    clearOnboardingHistory();
    setUser(payload.user); setScreen("workspace");
  }

  async function joinClinic(code) {
    const payload = await apiRequest("/api/clinic/assistant/setup/claim/", { method: "POST", staffToken, data: { code } });
    if (payload.device_token) rememberTrustedDevice(payload.user, payload.device_token);
    clearOnboardingHistory();
    setUser(payload.user); setScreen("workspace");
  }

  async function showClinics() {
    try {
      const payload = await apiRequest("/api/staff/leave-clinic/", { method: "POST", staffToken });
      setSelectedMembership(null); setUser(payload.user); setScreen("clinics");
    } catch { await signOut(); }
  }

  function openAccountSettings(returnScreen = "clinics") {
    setAccountSettingsReturnScreen(returnScreen);
    if (!user?.memberships?.length && ["create-clinic", "join-clinic"].includes(returnScreen)) {
      replaceOnboardingHistory("account-settings");
    }
    setScreen("account-settings");
  }

  function closeAccountSettings() {
    if (!user?.memberships?.length && ["create-clinic", "join-clinic"].includes(accountSettingsReturnScreen)) {
      replaceOnboardingHistory(accountSettingsReturnScreen);
    }
    setScreen(accountSettingsReturnScreen);
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
    clearOnboardingHistory();
    clearActiveTrustedDevice();
    setStaffToken(null); setUser(null); setRole(null); setScreen("role");
  }

  function accountDeleted() {
    localStorage.removeItem(STAFF_TOKEN_KEY);
    clearOnboardingHistory();
    forgetTrustedDevice(user?.id);
    clearActiveTrustedDevice();
    setStaffToken(null); setUser(null); setRole(null); setScreen("role");
  }

  if (screen === "loading") return <LoadingScreen />;
  if (screen === "role") return <RoleChoice onChoose={(value) => { setRole(value); setScreen("role-entry"); }} />;
  if (screen === "role-entry") return <RoleEntry role={role} onLogin={() => setScreen("login")} onCreate={() => setScreen("create-account")} onBack={() => setScreen("role")} />;
  if (screen === "login") return <LoginForm role={role} onSubmit={login} onPasskey={passkeyLogin} onBack={() => setScreen("role-entry")} onRecovery={() => setScreen("recovery")} />;
  if (screen === "create-account") return <AccountCreateForm role={role} onSubmit={createAccount} onBack={() => setScreen("role-entry")} />;
  if (screen === "recovery") return <RecoveryFlow role={role} onBack={() => setScreen(role ? "role-entry" : "role")} onComplete={() => setScreen(role ? "login" : "role")} />;
  if (screen === "verify" && user && staffToken) return <VerificationGate user={user} staffToken={staffToken} onUser={setUser} onDone={verificationDone} onSignOut={signOut} />;
  if (screen === "device-auth" && user && staffToken) return <DeviceAuthorization staffToken={staffToken} onAuthorized={deviceAuthorized} onBack={() => setScreen("role")} />;
  if (screen === "create-clinic" && user?.role === "doctor") return <ClinicCreateForm onSubmit={createClinic} onBack={user.memberships?.length ? () => setScreen("clinics") : undefined} onAccount={!user.memberships?.length ? () => openAccountSettings("create-clinic") : undefined} onSignOut={!user.memberships?.length ? signOut : undefined} />;
  if (screen === "join-clinic" && user?.role === "assistant") return <AssistantJoinForm onSubmit={joinClinic} additional={Boolean(user.memberships?.length)} onAccount={() => openAccountSettings("join-clinic")} onClinics={() => setScreen("clinics")} onSignOut={signOut} />;
  if (screen === "clinics" && user && staffToken) return <ClinicPicker user={user} onChoose={(membership) => { setSelectedMembership(membership); setScreen("clinic-details"); }} onCreate={() => setScreen("create-clinic")} onJoin={() => setScreen("join-clinic")} onSettings={() => openAccountSettings("clinics")} onSignOut={signOut} />;
  if (screen === "clinic-details" && user && staffToken && selectedMembership) return <ClinicDetails membership={selectedMembership} user={user} staffToken={staffToken} onBack={() => setScreen("clinics")} onOpenWorkspace={() => openMembership(selectedMembership)} />;
  if (screen === "account-settings" && user && staffToken) return <AccountSettingsStandalone user={user} staffToken={staffToken} onUserChange={setUser} onAccountDeleted={accountDeleted} onBack={closeAccountSettings} />;
  if (screen === "workspace" && user && staffToken) return <PatientWorkspace user={user} staffToken={staffToken} onSignOut={signOut} onSwitchClinic={showClinics} onSwitchWorkspace={switchWorkspace} onUserChange={setUser} onAccountDeleted={accountDeleted} />;
  return <LoadingScreen />;
}
