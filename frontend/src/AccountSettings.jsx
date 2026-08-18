import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ApiError, DEMO_MODE, apiRequest } from "./api.js";
import { createPasskey, getPasskey } from "./webauthn.js";
import { Button, ErrorMessage, Field, SelectField } from "./ui.jsx";

function errorOf(error, fallback) {
  return error instanceof ApiError ? error : new ApiError(error?.message || fallback);
}

export default function AccountSettings({ user, staffToken, onUserChange, onAccountDeleted }) {
  const [open, setOpen] = useState(false), [tab, setTab] = useState("profile"), [error, setError] = useState(null);
  const [profile, setProfile] = useState({ first_name: user.first_name ?? "", last_name: user.last_name ?? "" });
  const [contact, setContact] = useState({ kind: "email", value: "", password: "", code: "", requested: false, devCode: "", passkeyReauthenticated: false });
  const [password, setPassword] = useState({ channel: "email", code: "", password: "", confirm: "", requested: false, devCode: "" });
  const [passkeys, setPasskeys] = useState([]), [removePassword, setRemovePassword] = useState("");
  const [recovery, setRecovery] = useState({ remaining: 0, codes: [] });
  const [deletion, setDeletion] = useState({ clinics: [], password: "", confirmation: "", passkeyReauthenticated: false, loading: false, deleting: false });

  useEffect(() => { setProfile({ first_name: user.first_name ?? "", last_name: user.last_name ?? "" }); }, [user]);
  useEffect(() => {
    if (!open) return;
    if (tab === "passkeys" && !DEMO_MODE) apiRequest("/api/passkeys/", { staffToken }).then((payload) => setPasskeys(payload.passkeys ?? [])).catch((reason) => setError(errorOf(reason, "Passkeys could not be loaded.")));
    if (tab === "recovery" && user.role === "doctor" && !DEMO_MODE) apiRequest("/api/staff/recovery-codes/", { staffToken }).then(setRecovery).catch((reason) => setError(errorOf(reason, "Recovery codes could not be loaded.")));
    if (tab === "delete" && user.role === "doctor") {
      setDeletion((current) => ({ ...current, loading: true }));
      apiRequest("/api/staff/account/", { staffToken })
        .then((payload) => setDeletion((current) => ({ ...current, clinics: payload.clinics ?? [], loading: false })))
        .catch((reason) => { setDeletion((current) => ({ ...current, loading: false })); setError(errorOf(reason, "Account deletion details could not be loaded.")); });
    }
  }, [open, tab, staffToken, user.role]);

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
      const payload = await apiRequest(`/api/staff/${contact.kind}/change/request/`, {
        method: "POST", staffToken,
        data: { value: contact.value, ...(contact.password ? { current_password: contact.password } : {}) },
      });
      setContact((current) => ({ ...current, requested: true, devCode: payload.development_code ?? "" }));
    } catch (reason) { setError(errorOf(reason, "Contact change could not be started. Reauthenticate with your current password or a passkey first.")); }
  }

  async function confirmContact(event) {
    event.preventDefault(); setError(null);
    try {
      const payload = await apiRequest(`/api/staff/${contact.kind}/change/confirm/`, { method: "POST", staffToken, data: { code: contact.code } });
      onUserChange(payload.user);
      setContact({ kind: contact.kind, value: "", password: "", code: "", requested: false, devCode: "", passkeyReauthenticated: false });
    } catch (reason) { setError(errorOf(reason, "Contact change could not be confirmed.")); }
  }

  async function requestPassword(event) {
    event.preventDefault(); setError(null);
    try {
      const payload = await apiRequest("/api/staff/password/change/request/", { method: "POST", staffToken, data: { channel: password.channel } });
      setPassword((current) => ({ ...current, requested: true, devCode: payload.development_code ?? "" }));
    } catch (reason) { setError(errorOf(reason, "Password verification could not be sent.")); }
  }

  async function confirmPassword(event) {
    event.preventDefault(); setError(null);
    try {
      await apiRequest("/api/staff/password/change/confirm/", { method: "POST", staffToken, data: { code: password.code, password: password.password, password_confirm: password.confirm } });
      setPassword({ channel: "email", code: "", password: "", confirm: "", requested: false, devCode: "" });
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
      setOpen(false); onAccountDeleted?.();
    } catch (reason) { setError(errorOf(reason, "Account could not be deleted.")); setDeletion((current) => ({ ...current, deleting: false })); }
  }

  if (!open) return <Button type="button" onClick={() => setOpen(true)}>Account</Button>;
  const tabs = ["profile", "security", "passkeys", "recovery", ...(user.role === "doctor" ? ["delete"] : [])];
  const modal = <div className="device-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className="device-modal phase8-account-modal" role="dialog" aria-modal="true">
    <div className="device-modal__header"><div><p className="eyebrow">Personal {user.role === "doctor" ? "Doctor" : "Assistant"} account</p><h2>Account settings</h2><p>Your personal profile, security, passkeys, and trusted devices follow you across your clinics.</p></div><button className="device-icon-button" onClick={() => setOpen(false)}>×</button></div>
    <nav className="phase8-settings-tabs">{tabs.map((name) => <button key={name} className={tab === name ? "phase8-settings-tab phase8-settings-tab--active" : "phase8-settings-tab"} onClick={() => { setTab(name); setError(null); }}>{name === "delete" ? "Delete account" : name[0].toUpperCase() + name.slice(1)}</button>)}</nav>
    <ErrorMessage error={error} />

    {tab === "profile" && <div className="phase8-settings-section"><form className="form" onSubmit={saveProfile}><div className="field-row"><Field label="First name" value={profile.first_name} onChange={(event) => setProfile({ ...profile, first_name: event.target.value })} required /><Field label="Last name" value={profile.last_name} onChange={(event) => setProfile({ ...profile, last_name: event.target.value })} required /></div><Button variant="primary">Save profile</Button></form><div className="phase8-contact-card"><strong>Email</strong><span>{user.email} · {user.email_verified ? "Verified" : "Not verified"}</span></div><div className="phase8-contact-card"><strong>Phone</strong><span>{user.phone} · {user.phone_verified ? "Verified" : "Not verified"}</span></div><form className="form" onSubmit={contact.requested ? confirmContact : requestContact}><SelectField label="Change contact" value={contact.kind} onChange={(event) => setContact({ ...contact, kind: event.target.value, requested: false, passkeyReauthenticated: false })}><option value="email">Email</option><option value="phone">Phone</option></SelectField>{!contact.requested ? <><Field label={`New ${contact.kind}`} value={contact.value} onChange={(event) => setContact({ ...contact, value: event.target.value })} required /><Field label="Current password" type="password" value={contact.password} onChange={(event) => setContact({ ...contact, password: event.target.value })} /><Button type="button" onClick={() => explicitPasskeyReauth(false)}>Use passkey instead</Button>{contact.passkeyReauthenticated && <p className="device-success">Passkey reauthentication complete for the next 10 minutes.</p>}<Button variant="primary">Send verification code</Button></> : <><Field label="Verification code" value={contact.code} onChange={(event) => setContact({ ...contact, code: event.target.value })} required />{contact.devCode && <p className="security-note">Development code: {contact.devCode}</p>}<Button variant="primary">Confirm change</Button></>}</form></div>}

    {tab === "security" && <div className="phase8-settings-section"><h3>Change password</h3><p>Confirm a password change through one of your verified contacts.</p><form className="form" onSubmit={password.requested ? confirmPassword : requestPassword}>{!password.requested ? <><SelectField label="Verification channel" value={password.channel} onChange={(event) => setPassword({ ...password, channel: event.target.value })}><option value="email">Email</option><option value="sms">SMS</option></SelectField><Button variant="primary">Send code</Button></> : <><Field label="Verification code" value={password.code} onChange={(event) => setPassword({ ...password, code: event.target.value })} required />{password.devCode && <p className="security-note">Development code: {password.devCode}</p>}<Field label="New password" type="password" value={password.password} onChange={(event) => setPassword({ ...password, password: event.target.value })} required /><Field label="Confirm new password" type="password" value={password.confirm} onChange={(event) => setPassword({ ...password, confirm: event.target.value })} required /><Button variant="primary">Change password</Button></>}</form><p className="security-note">Changing your password signs out your other sessions but keeps trusted devices.</p></div>}

    {tab === "passkeys" && <div className="phase8-settings-section">{DEMO_MODE ? <p>Real passkey enrollment is unavailable in the browser-only demo.</p> : <><div className="phase8-settings-row"><div><h3>Passkeys</h3><p>Optional biometric/device sign-in. Up to five passkeys.</p></div><Button variant="primary" compact type="button" onClick={addPasskey}>Add passkey</Button></div><Field label="Current password for removal (or reauthenticate with another passkey)" type="password" value={removePassword} onChange={(event) => setRemovePassword(event.target.value)} />{passkeys.map((item) => <div className="phase8-contact-card" key={item.id}><div><strong>{item.name}</strong><span>Added {new Date(item.created_at).toLocaleDateString()}</span></div><Button type="button" onClick={() => removePasskey(item.id)}>Remove</Button></div>)}</>}</div>}

    {tab === "recovery" && <div className="phase8-settings-section">{user.role === "doctor" ? <><h3>Doctor offline recovery codes</h3><p>{recovery.remaining ?? 0} unused codes. A new list invalidates every unused old code.</p><Button variant="primary" type="button" onClick={regenerateCodes}>Generate new codes</Button>{recovery.codes?.length > 0 && <pre className="phase8-recovery-codes">{recovery.codes.join("\n")}</pre>}</> : <><h3>Account recovery</h3><p>Your verified email, verified phone, and registered passkeys are your personal recovery methods. Clinic Doctors cannot reset or take over your global Assistant account.</p></>}</div>}

    {tab === "delete" && user.role === "doctor" && <div className="phase8-settings-section"><h3>Delete Doctor account</h3><p>This permanently deletes every clinic owned by this Doctor account and the Patient, appointment, queue, consultation, and task data inside those clinics. Connected Assistant memberships are removed, but Assistant personal accounts are not deleted.</p>{deletion.loading ? <p>Loading affected clinics…</p> : <div className="phase8-clinic-list">{deletion.clinics.map((clinic) => <div className="phase8-contact-card" key={clinic.id}><strong>{clinic.name}</strong><span>Clinic and clinic data will be permanently deleted.</span></div>)}</div>}<form className="form" onSubmit={deleteDoctorAccount}><Field label="Current password" type="password" value={deletion.password} onChange={(event) => setDeletion({ ...deletion, password: event.target.value })} /><Button type="button" onClick={() => explicitPasskeyReauth(true)}>Use passkey instead</Button>{deletion.passkeyReauthenticated && <p className="device-success">Passkey reauthentication complete for the next 10 minutes.</p>}<Field label="Type DELETE to confirm" value={deletion.confirmation} onChange={(event) => setDeletion({ ...deletion, confirmation: event.target.value })} required /><Button variant="danger" className="phase8-danger-action" disabled={deletion.deleting}>{deletion.deleting ? "Deleting…" : "Permanently delete account and clinics"}</Button></form></div>}
  </section></div>;
  return <>{createPortal(modal, document.body)}<Button type="button" onClick={() => setOpen(true)}>Account</Button></>;
}
