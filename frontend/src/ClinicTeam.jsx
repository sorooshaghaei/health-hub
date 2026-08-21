import { useEffect, useState } from "react";
import { ApiError, apiRequest } from "./api.js";
import Dialog from "./Dialog.jsx";
import { Button, ErrorMessage, SelectField } from "./ui.jsx";

function formatExpiry(value) {
  if (!value) return "an unknown time";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function ClinicTeam({ user, staffToken, onOpen }) {
  const [open, setOpen] = useState(false);
  const [assistant, setAssistant] = useState(null);
  const [activeSetup, setActiveSetup] = useState(null);
  const [setup, setSetup] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [copied, setCopied] = useState(false);
  const [channel, setChannel] = useState("email");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError(null);
    setSetup(null);
    setCopied(false);
    try {
      const [teamPayload, setupPayload] = await Promise.all([
        apiRequest("/api/clinic/assistant/", { staffToken }),
        apiRequest("/api/clinic/assistant/setup/", { staffToken }),
      ]);
      setAssistant(teamPayload.assistant);
      setActiveSetup(setupPayload.active_setup);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason : new ApiError("Clinic team could not be loaded."));
    }
  }

  useEffect(() => { if (open) load(); }, [open]);
  if (user.role !== "doctor") return null;

  function closeModal() {
    if (busy) return;
    setSetup(null);
    setCopied(false);
    setConfirming(null);
    setError(null);
    setOpen(false);
  }

  async function setupAssistant(replaceExisting) {
    setBusy(true); setError(null);
    try {
      const payload = await apiRequest("/api/clinic/assistant/setup/", { method: "POST", staffToken, data: { replace_existing: replaceExisting } });
      setSetup(payload);
      setActiveSetup(payload.active_setup);
      setAssistant(null);
      setCopied(false);
      setConfirming(null);
    } catch (reason) { setError(reason instanceof ApiError ? reason : new ApiError("Assistant setup could not be created.")); }
    finally { setBusy(false); }
  }

  function requestSetup() {
    setError(null);
    if (assistant) setConfirming("assistant");
    else if (activeSetup) setConfirming("code");
    else setupAssistant(false);
  }

  async function copySetupCode() {
    try {
      await navigator.clipboard.writeText(setup.setup_code);
      setCopied(true);
    } catch {
      setError(new ApiError("The setup code could not be copied. Select and copy it manually."));
    }
  }

  async function removeAssistant() {
    setBusy(true); setError(null);
    try { await apiRequest("/api/clinic/assistant/", { method: "DELETE", staffToken }); setAssistant(null); setSetup(null); setActiveSetup(null); }
    catch (reason) { setError(reason instanceof ApiError ? reason : new ApiError("Assistant could not be removed from this clinic.")); }
    finally { setBusy(false); }
  }

  async function recovery() {
    setBusy(true); setError(null);
    try { await apiRequest("/api/clinic/assistant/recovery/", { method: "POST", staffToken, data: { channel } }); }
    catch (reason) { setError(reason instanceof ApiError ? reason : new ApiError("Recovery could not be started.")); }
    finally { setBusy(false); }
  }

  const confirmationCopy = confirming === "assistant"
    ? "Replacing the current Assistant immediately deactivates their membership in this clinic and ends their clinic sessions. Their global account and other clinic memberships are not changed."
    : "Replacing this setup code immediately invalidates the current unclaimed code. Anyone holding it will no longer be able to use it.";

  const modal = <Dialog onClose={closeModal} returnFocusSelector="#clinic-team-trigger" ariaLabelledBy="clinic-team-title" ariaDescribedBy="clinic-team-description">
    <div className="device-modal__header"><div><p className="eyebrow">Current clinic</p><h2 id="clinic-team-title">Clinic team</h2><p id="clinic-team-description">This Doctor controls the Assistant membership for this clinic only. Removing or replacing an Assistant never deletes that person's global Assistant account or their access to other clinics.</p></div><button className="device-icon-button" type="button" disabled={busy} onClick={closeModal} aria-label="Close clinic team">×</button></div>
    <ErrorMessage error={error} />
    {assistant ? <div className="phase8-contact-card"><div><strong>{assistant.display_name}</strong><span>{assistant.email} · {assistant.phone}</span></div></div> : <p>No Assistant is currently assigned to this clinic.</p>}
    <div className="phase8-settings-section">
      <h3>{assistant ? "Replace Assistant" : "Add Assistant"}</h3>
      <p>A one-time setup code is valid for 24 hours. Replacing the current Assistant deactivates only this clinic membership and preserves historical attribution.</p>
      {setup ? <div className="assistant-setup-result">
        <div className="pairing-code">{setup.setup_code}</div>
        <Button type="button" disabled={busy} onClick={copySetupCode}>{copied ? "Copied" : "Copy setup code"}</Button>
        <p className="security-note">This code is shown once and expires at {formatExpiry(setup.active_setup?.expires_at)}. Copy it now and give it directly to the Assistant.</p>
      </div> : activeSetup && <p className="security-note">An active setup code exists and expires at {formatExpiry(activeSetup.expires_at)}. Its plaintext is no longer available.</p>}
      {confirming ? <div className="assistant-setup-confirmation" role="alert">
        <strong>{confirming === "assistant" ? "Replace the current Assistant?" : "Replace the active setup code?"}</strong>
        <p>{confirmationCopy}</p>
        <div className="phase8-inline-actions"><Button variant="danger" type="button" disabled={busy} onClick={() => setupAssistant(confirming === "assistant")}>{busy ? "Replacing…" : "Confirm replacement"}</Button><Button type="button" disabled={busy} onClick={() => setConfirming(null)}>Cancel</Button></div>
      </div> : <Button variant="primary" type="button" disabled={busy} onClick={requestSetup}>{assistant ? "Replace Assistant" : activeSetup ? "Replace setup code" : "Create one-time setup code"}</Button>}
    </div>
    {assistant && <div className="phase8-settings-section"><h3>Remove from this clinic</h3><p>This immediately ends the Assistant's membership in this clinic. Their global account and other clinics are unaffected.</p><Button variant="danger" type="button" disabled={busy} onClick={removeAssistant}>Remove Assistant from clinic</Button></div>}
    {assistant && <div className="phase8-settings-section"><h3>Help with normal password recovery</h3><p>Recovery is sent to the Assistant's own verified contact. If they have lost every personal recovery method, replace their clinic membership instead; the Doctor cannot take over the global account.</p><SelectField label="Recovery channel" value={channel} onChange={(event) => setChannel(event.target.value)}><option value="email">Verified email</option><option value="sms">Verified SMS</option></SelectField><Button type="button" disabled={busy} onClick={recovery}>Send recovery instructions</Button></div>}
  </Dialog>;
  return <>
    <Button id="clinic-team-trigger" type="button" disabled={open} onClick={() => { setOpen(true); onOpen?.(); }}>Clinic team</Button>
    {open && modal}
  </>;
}
