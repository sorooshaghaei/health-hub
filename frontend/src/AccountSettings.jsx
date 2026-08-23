import { useEffect, useState } from "react";
import { ApiError, DEMO_MODE, apiRequest } from "./api.js";
import { PasswordField, PasswordPair, useResendCountdown, verificationCodeComplete, verificationCodeValue } from "./credentialUi.jsx";
import { passwordRequirements } from "./passwordRules.js";
import { normalizeInternationalPhone } from "./phoneNumbers.js";
import Dialog from "./Dialog.jsx";
import { createPasskey, getPasskey } from "./webauthn.js";
import { Button, ErrorMessage, Field, SelectField } from "./ui.jsx";
import "./accountSettings.css";

function errorOf(error, fallback) {
  return error instanceof ApiError ? error : new ApiError(error?.message || fallback);
}

function emptyContactState(kind = "email") {
  return { kind, value: "", password: "", code: "", requested: false, devCode: "", passkeyReauthenticated: false };
}

export default function AccountSettings({ user, staffToken, onOpen, onUserChange, onAccountDeleted }) {
  const [open, setOpen] = useState(false), [tab, setTab] = useState("profile"), [error, setError] = useState(null);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [profile, setProfile] = useState({ first_name: user.first_name ?? "", last_name: user.last_name ?? "" });
  const [contact, setContact] = useState(() => emptyContactState());
  const [password, setPassword] = useState({ channel: "email", code: "", password: "", confirm: "", requested: false, devCode: "" });
  const [verificationState, setVerificationState] = useState({});
  const [passkeys, setPasskeys] = useState([]), [removePassword, setRemovePassword] = useState("");
  const [recovery, setRecovery] = useState({ remaining: 0, codes: [] });
  const [deletion, setDeletion] = useState({ clinics: [], password: "", confirmation: "", passkeyReauthenticated: false, loading: false, deleting: false });
  const contactResend = useResendCountdown();
  const passwordResend = useResendCountdown();

  useEffect(() => { setProfile({ first_name: user.first_name ?? "", last_name: user.last_name ?? "" }); }, [user]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    apiRequest("/api/staff/verification-state/", { staffToken })
      .then((payload) => {
        if (cancelled) return;
        setVerificationState(payload);
        const pendingKind = payload.email_change ? "email" : payload.phone_change ? "phone" : null;
        if (pendingKind) {
          const challenge = payload[`${pendingKind}_change`];
          setContact({
            ...emptyContactState(pendingKind),
            value: challenge.pending_value ?? "",
            requested: true,
            devCode: challenge.development_code ?? "",
          });
          contactResend.start(challenge);
        } else {
          setContact((current) => current.requested ? emptyContactState(current.kind) : current);
          contactResend.reset();
        }
        if (payload.password_change) {
          setPassword((current) => ({
            ...current,
            channel: payload.password_change.channel,
            code: "",
            requested: true,
            devCode: payload.password_change.development_code ?? "",
          }));
          passwordResend.start(payload.password_change);
        } else {
          setPassword((current) => current.requested
            ? { channel: current.channel, code: "", password: "", confirm: "", requested: false, devCode: "" }
            : current);
          passwordResend.reset();
        }
      })
      .catch((reason) => { if (!cancelled) setError(errorOf(reason, "Pending verification status could not be restored.")); });
    return () => { cancelled = true; };
  }, [open, staffToken]);
  useEffect(() => {
    if (!open) return;
    if (tab === "passkeys" && !DEMO_MODE) apiRequest("/api/passkeys/", { staffToken }).then((payload) => setPasskeys(payload.passkeys ?? [])).catch((reason) => setError(errorOf(reason, "Passkeys could not be loaded.")));
    if (tab === "recovery" && user.role === "doctor" && !DEMO_MODE) apiRequest("/api/staff/recovery-codes/", { staffToken }).then(setRecovery).catch((reason) => setError(errorOf(reason, "Recovery codes could not be loaded.")));
  }, [open, tab, staffToken, user.role]);

  useEffect(() => {
    if (!dangerOpen || user.role !== "doctor") return;
    setDeletion((current) => ({ ...current, loading: true }));
    apiRequest("/api/staff/account/", { staffToken })
      .then((payload) => setDeletion((current) => ({ ...current, clinics: payload.clinics ?? [], loading: false })))
      .catch((reason) => { setDeletion((current) => ({ ...current, loading: false })); setError(errorOf(reason, "Account deletion details could not be loaded.")); });
  }, [dangerOpen, staffToken, user.role]);

  async function saveProfile(event) {
    event.preventDefault(); setError(null);
    try { const payload = await apiRequest("/api/staff/profile/", { method: "PATCH", staffToken, data: profile }); onUserChange(payload.user); }
    catch (reason) { setError(errorOf(reason, "Profile could not be updated.")); }
  }

  async function explicitPasskeyReauth(forDeletion = false) {
    setError(null);
    try {
      const begin = await apiRequest("/api/passkeys/auth/options/", { method: "POST", data: { role: user.role, identity: user.email } });
      const credential = await getPasskey(begin.public_key);
      await apiRequest("/api/passkeys/reauthenticate/", { method: "POST", staffToken, data: { credential } });
      if (forDeletion) setDeletion((current) => ({ ...current, passkeyReauthenticated: true }));
      else setContact((current) => ({ ...current, passkeyReauthenticated: true }));
    } catch (reason) { setError(errorOf(reason, "Passkey reauthentication failed.")); }
  }

  async function requestContact(event) {
    event.preventDefault(); setError(null);
    try {
      const value = contact.kind === "phone" ? normalizeInternationalPhone(contact.value) : contact.value;
      const payload = await apiRequest(`/api/staff/${contact.kind}/change/request/`, {
        method: "POST", staffToken,
        data: { value, ...(contact.password ? { current_password: contact.password } : {}) },
      });
      setContact((current) => ({ ...current, value, requested: true, devCode: payload.development_code ?? "" }));
      setVerificationState((current) => ({ ...current, [`${contact.kind}_change`]: { ...payload, pending_value: value } }));
      contactResend.start(payload);
    } catch (reason) { setError(errorOf(reason, "Contact change could not be started. Reauthenticate with your current password or a passkey first.")); }
  }

  async function confirmContact(event) {
    event.preventDefault(); setError(null);
    try {
      const payload = await apiRequest(`/api/staff/${contact.kind}/change/confirm/`, { method: "POST", staffToken, data: { code: contact.code } });
      onUserChange(payload.user);
      setVerificationState((current) => ({ ...current, [`${contact.kind}_change`]: null }));
      setContact(emptyContactState(contact.kind));
      contactResend.reset();
    } catch (reason) { setError(errorOf(reason, "Contact change could not be confirmed.")); }
  }

  async function cancelContact() {
    setError(null);
    try {
      await apiRequest(`/api/staff/${contact.kind}/change/cancel/`, { method: "POST", staffToken });
      setVerificationState((current) => ({ ...current, [`${contact.kind}_change`]: null }));
      setContact(emptyContactState(contact.kind));
      contactResend.reset();
    } catch (reason) { setError(errorOf(reason, "Pending contact replacement could not be cancelled.")); }
  }

  function selectContactKind(kind) {
    const challenge = verificationState[`${kind}_change`];
    setError(null);
    if (!challenge) {
      setContact(emptyContactState(kind));
      contactResend.reset();
      return;
    }
    setContact({
      ...emptyContactState(kind),
      value: challenge.pending_value ?? "",
      requested: true,
      devCode: challenge.development_code ?? "",
    });
    contactResend.start(challenge);
  }

  async function requestPassword(event) {
    event.preventDefault(); setError(null);
    try {
      const payload = await apiRequest("/api/staff/password/change/request/", { method: "POST", staffToken, data: { channel: password.channel } });
      setPassword((current) => ({ ...current, requested: true, devCode: payload.development_code ?? "" }));
      setVerificationState((current) => ({ ...current, password_change: { ...payload, channel: password.channel } }));
      passwordResend.start(payload);
    } catch (reason) { setError(errorOf(reason, "Password verification could not be sent.")); }
  }

  async function confirmPassword(event) {
    event.preventDefault(); setError(null);
    try {
      await apiRequest("/api/staff/password/change/confirm/", { method: "POST", staffToken, data: { code: password.code, password: password.password, password_confirm: password.confirm } });
      setPassword({ channel: "email", code: "", password: "", confirm: "", requested: false, devCode: "" });
      setVerificationState((current) => ({ ...current, password_change: null }));
      passwordResend.reset();
    } catch (reason) { setError(errorOf(reason, "Password could not be changed.")); }
  }

  async function addPasskey() {
    setError(null);
    try {
      const begin = await apiRequest("/api/passkeys/register/options/", { method: "POST", staffToken });
      const credential = await createPasskey(begin.public_key);
      const passkey = await apiRequest("/api/passkeys/register/complete/", { method: "POST", staffToken, data: { credential, name: "Passkey" } });
      setPasskeys((current) => [passkey, ...current]);
    } catch (reason) { setError(errorOf(reason, "Passkey could not be added.")); }
  }

  async function removePasskey(id) {
    setError(null);
    try {
      await apiRequest(`/api/passkeys/${id}/`, { method: "DELETE", staffToken, data: removePassword ? { current_password: removePassword } : {} });
      setPasskeys((current) => current.filter((item) => item.id !== id));
    } catch (reason) { setError(errorOf(reason, "Passkey could not be removed.")); }
  }

  async function regenerateCodes() {
    setError(null);
    try { setRecovery(await apiRequest("/api/staff/recovery-codes/", { method: "POST", staffToken })); }
    catch (reason) { setError(errorOf(reason, "Recovery codes could not be generated.")); }
  }

  async function deleteDoctorAccount(event) {
    event.preventDefault(); setError(null); setDeletion((current) => ({ ...current, deleting: true }));
    try {
      await apiRequest("/api/staff/account/", {
        method: "DELETE", staffToken,
        data: { confirmation: deletion.confirmation, ...(deletion.password ? { current_password: deletion.password } : {}) },
      });
      setDangerOpen(false); setOpen(false); onAccountDeleted?.();
    } catch (reason) { setError(errorOf(reason, "Account could not be deleted.")); setDeletion((current) => ({ ...current, deleting: false })); }
  }

  function openSettings() {
    setDangerOpen(false);
    setOpen(true);
    setError(null);
    onOpen?.();
  }

  const tabs = ["profile", "security", "passkeys", "recovery"];
  const passwordValid = passwordRequirements(
    password.password,
    password.confirm,
    [user.first_name, user.last_name, user.email, user.phone],
  ).valid;
  return <>
    {open && <Dialog
      className="device-modal phase8-account-modal"
      onClose={() => setOpen(false)}
      returnFocusSelector="#workspace-account-trigger"
      ariaLabelledBy="account-settings-title"
      ariaDescribedBy="account-settings-description"
    >
      <div className="device-modal__header">
        <div>
          <p className="eyebrow">Personal {user.role === "doctor" ? "Doctor" : "Assistant"} account</p>
          <h2 id="account-settings-title">Account settings</h2>
          <p id="account-settings-description">Your personal profile, security, passkeys, and trusted devices follow you across your clinics.</p>
        </div>
        <button type="button" className="device-icon-button" aria-label="Close account settings" onClick={() => setOpen(false)}>×</button>
      </div>
      <nav className="phase8-settings-tabs" aria-label="Account settings sections">
        {tabs.map((name) => <button
          type="button"
          key={name}
          className={tab === name ? "phase8-settings-tab phase8-settings-tab--active" : "phase8-settings-tab"}
          aria-current={tab === name ? "page" : undefined}
          onClick={() => { setTab(name); setError(null); }}
        >{name[0].toUpperCase() + name.slice(1)}</button>)}
      </nav>
      <ErrorMessage error={error} focus />

      {tab === "profile" && <div className="phase8-settings-section">
        <form className="form" onSubmit={saveProfile}>
          <div className="field-row">
            <Field label="First name" value={profile.first_name} onChange={(event) => { setProfile({ ...profile, first_name: event.target.value }); setError(null); }} required />
            <Field label="Last name" value={profile.last_name} onChange={(event) => { setProfile({ ...profile, last_name: event.target.value }); setError(null); }} required />
          </div>
          <Button variant="primary">Save profile</Button>
        </form>
        <div className="phase8-contact-card"><strong>Email</strong><span>{user.email} · {user.email_verified ? "Verified" : "Not verified"}</span></div>
        <div className="phase8-contact-card"><strong>Phone</strong><span>{user.phone} · {user.phone_verified ? "Verified" : "Not verified"}</span></div>
        <form className="form" onSubmit={contact.requested ? confirmContact : requestContact}>
          <SelectField label="Change contact" value={contact.kind} onChange={(event) => selectContactKind(event.target.value)}>
            <option value="email">Email</option><option value="phone">Phone</option>
          </SelectField>
          {!contact.requested ? <>
            <Field label={contact.kind === "email" ? "New email" : "New phone number"} type={contact.kind === "email" ? "email" : "tel"} value={contact.value} onChange={(event) => { setContact({ ...contact, value: event.target.value }); setError(null); }} hint={contact.kind === "phone" ? "Use the full international format beginning with +." : undefined} inputMode={contact.kind === "phone" ? "tel" : undefined} autoComplete={contact.kind === "email" ? "email" : "tel"} required />
            <PasswordField label="Current password" value={contact.password} onChange={(event) => { setContact({ ...contact, password: event.target.value }); setError(null); }} autoComplete="current-password" />
            <Button type="button" onClick={() => explicitPasskeyReauth(false)}>Use passkey instead</Button>
            {contact.passkeyReauthenticated && <p className="device-success">Passkey reauthentication complete for the next 10 minutes.</p>}
            <Button variant="primary" disabled={contactResend.seconds > 0}>{contactResend.seconds > 0 ? `Send another code in ${contactResend.seconds}s` : "Send verification code"}</Button>
            {verificationState[`${contact.kind}_change`] && <Button variant="text" type="button" onClick={cancelContact}>Cancel pending replacement</Button>}
          </> : <>
            <p className="security-note">Pending {contact.kind}: {contact.value}</p>
            <Field label="Verification code" value={contact.code} onChange={(event) => { setContact({ ...contact, code: verificationCodeValue(event.target.value) }); setError(null); }} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
            {contact.devCode && <p className="security-note">Development code: {contact.devCode}</p>}
            <Button variant="primary" disabled={!verificationCodeComplete(contact.code)}>Confirm change</Button>
            <div className="resend-actions">
              <Button variant="text" type="button" disabled={contactResend.seconds > 0} onClick={requestContact}>{contactResend.seconds > 0 ? `Resend code in ${contactResend.seconds}s` : "Resend code"}</Button>
              <Button variant="text" type="button" onClick={() => { setContact({ ...contact, requested: false, code: "", devCode: "" }); setError(null); }}>Edit new {contact.kind}</Button>
              <Button variant="text" type="button" onClick={cancelContact}>Cancel replacement</Button>
            </div>
          </>}
        </form>
      </div>}

      {tab === "security" && <div className="phase8-settings-section">
        <h3>Change password</h3>
        <p>Confirm a password change through one of your verified contacts.</p>
        <form className="form" onSubmit={password.requested ? confirmPassword : requestPassword}>
          {!password.requested ? <>
            <SelectField label="Verification channel" value={password.channel} onChange={(event) => { setPassword({ ...password, channel: event.target.value }); setError(null); }}><option value="email">Email</option><option value="sms">SMS</option></SelectField>
            <Button variant="primary" disabled={passwordResend.seconds > 0}>{passwordResend.seconds > 0 ? `Send another code in ${passwordResend.seconds}s` : "Send code"}</Button>
          </> : <>
            <Field label="Verification code" value={password.code} onChange={(event) => { setPassword({ ...password, code: verificationCodeValue(event.target.value) }); setError(null); }} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required />
            {password.devCode && <p className="security-note">Development code: {password.devCode}</p>}
            <PasswordPair password={password.password} confirmation={password.confirm} onPasswordChange={(event) => { setPassword({ ...password, password: event.target.value }); setError(null); }} onConfirmationChange={(event) => { setPassword({ ...password, confirm: event.target.value }); setError(null); }} personalValues={[user.first_name, user.last_name, user.email, user.phone]} passwordLabel="New password" confirmationLabel="Confirm new password" />
            <Button variant="primary" disabled={!verificationCodeComplete(password.code) || !passwordValid}>Change password</Button>
            <div className="resend-actions">
              <Button variant="text" type="button" disabled={passwordResend.seconds > 0} onClick={requestPassword}>{passwordResend.seconds > 0 ? `Resend code in ${passwordResend.seconds}s` : "Resend code"}</Button>
              <Button variant="text" type="button" onClick={() => { setPassword({ ...password, requested: false, code: "", devCode: "" }); setError(null); }}>Change verification channel</Button>
            </div>
          </>}
        </form>
        <p className="security-note">Changing your password signs out your other sessions but keeps trusted devices.</p>
      </div>}

      {tab === "passkeys" && <div className="phase8-settings-section">{DEMO_MODE ? <p>Real passkey enrollment is unavailable in the browser-only demo.</p> : <><div className="phase8-settings-row"><div><h3>Passkeys</h3><p>Optional biometric/device sign-in. Up to five passkeys.</p></div><Button variant="primary" compact type="button" onClick={addPasskey}>Add passkey</Button></div><PasswordField label="Current password for removal (or reauthenticate with another passkey)" value={removePassword} onChange={(event) => setRemovePassword(event.target.value)} autoComplete="current-password" />{passkeys.map((item) => <div className="phase8-contact-card" key={item.id}><div><strong>{item.name}</strong><span>Added {new Date(item.created_at).toLocaleDateString()}</span></div><Button type="button" onClick={() => removePasskey(item.id)}>Remove</Button></div>)}</>}</div>}

      {tab === "recovery" && <div className="phase8-settings-section">{user.role === "doctor" ? <><h3>Doctor offline recovery codes</h3><p>{recovery.remaining ?? 0} unused codes. A new list invalidates every unused old code.</p><Button variant="primary" type="button" onClick={regenerateCodes}>Generate new codes</Button>{recovery.codes?.length > 0 && <pre className="phase8-recovery-codes">{recovery.codes.join("\n")}</pre>}</> : <><h3>Account recovery</h3><p>Your verified email, verified phone, and registered passkeys are your personal recovery methods. Clinic Doctors cannot reset or take over your global Assistant account.</p></>}</div>}

      {user.role === "doctor" && <section className="phase8-danger-zone" aria-labelledby="danger-zone-summary-title">
        <div>
          <p className="eyebrow">Danger zone</p>
          <h3 id="danger-zone-summary-title">Delete Doctor account</h3>
          <p>Account deletion is kept separate from everyday profile and security settings.</p>
        </div>
        <Button type="button" variant="danger" onClick={() => { setDangerOpen(true); setError(null); }}>Review account deletion</Button>
      </section>}
    </Dialog>}

    {dangerOpen && user.role === "doctor" && <Dialog
      className="device-modal phase8-danger-dialog"
      onClose={() => setDangerOpen(false)}
      canClose={!deletion.deleting}
      ariaLabelledBy="danger-zone-title"
      ariaDescribedBy="danger-zone-description"
    >
      <div className="device-modal__header">
        <div>
          <p className="eyebrow">Danger zone</p>
          <h2 id="danger-zone-title">Delete Doctor account</h2>
          <p id="danger-zone-description">Review every affected clinic before permanently deleting this account.</p>
        </div>
        <button type="button" className="device-icon-button" aria-label="Close account danger zone" disabled={deletion.deleting} onClick={() => setDangerOpen(false)}>×</button>
      </div>
      <ErrorMessage error={error} focus />
      <div className="phase8-settings-section">
        <p>This permanently deletes every clinic owned by this Doctor account and the Patient, appointment, queue, consultation, and task data inside those clinics. Connected Assistant memberships are removed, but Assistant personal accounts are not deleted.</p>
        {deletion.loading ? <p>Loading affected clinics…</p> : <div className="phase8-clinic-list">{deletion.clinics.map((clinic) => <div className="phase8-contact-card" key={clinic.id}><strong>{clinic.name}</strong><span>Clinic and clinic data will be permanently deleted.</span></div>)}</div>}
        <form className="form" onSubmit={deleteDoctorAccount}>
          <PasswordField label="Current password" value={deletion.password} onChange={(event) => { setDeletion({ ...deletion, password: event.target.value }); setError(null); }} autoComplete="current-password" />
          <Button type="button" onClick={() => explicitPasskeyReauth(true)}>Use passkey instead</Button>
          {deletion.passkeyReauthenticated && <p className="device-success">Passkey reauthentication complete for the next 10 minutes.</p>}
          <Field label="Type DELETE to confirm" value={deletion.confirmation} onChange={(event) => { setDeletion({ ...deletion, confirmation: event.target.value }); setError(null); }} required />
          <div className="phase8-danger-dialog__actions">
            <Button type="button" disabled={deletion.deleting} onClick={() => { setDangerOpen(false); setError(null); }}>Back to account settings</Button>
            <Button variant="danger" className="phase8-danger-action" disabled={deletion.deleting}>{deletion.deleting ? "Deleting…" : "Permanently delete account and clinics"}</Button>
          </div>
        </form>
      </div>
    </Dialog>}

    <Button id="account-settings-trigger" role="menuitem" type="button" onClick={openSettings} disabled={open || dangerOpen}>Account</Button>
  </>;
}
