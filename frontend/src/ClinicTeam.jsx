import { useEffect, useState } from "react";
import { ApiError, DEMO_MODE, apiRequest } from "./api.js";
import Dialog from "./Dialog.jsx";
import { Button, ErrorMessage, SelectField } from "./ui.jsx";

export default function ClinicTeam({ user, staffToken, onOpen }) {
  const [open, setOpen] = useState(false), [assistant, setAssistant] = useState(null), [error, setError] = useState(null), [setup, setSetup] = useState(null), [channel, setChannel] = useState("email"), [busy, setBusy] = useState(false);
  async function load() {
    try { const payload = await apiRequest("/api/clinic/assistant/", { staffToken }); setAssistant(payload.assistant); }
    catch (reason) { setError(reason instanceof ApiError ? reason : new ApiError("Assistant could not be loaded.")); }
  }
  useEffect(() => { if (open && !DEMO_MODE) load(); }, [open]);
  if (user.role !== "doctor") return null;

  async function setupAssistant(replace) {
    setBusy(true); setError(null);
    try {
      const payload = await apiRequest("/api/clinic/assistant/setup/", { method: "POST", staffToken, data: { replace_existing: replace } });
      setSetup(payload); setAssistant(null);
    } catch (reason) { setError(reason instanceof ApiError ? reason : new ApiError("Assistant setup could not be created.")); }
    finally { setBusy(false); }
  }

  async function removeAssistant() {
    setBusy(true); setError(null);
    try { await apiRequest("/api/clinic/assistant/", { method: "DELETE", staffToken }); setAssistant(null); setSetup(null); }
    catch (reason) { setError(reason instanceof ApiError ? reason : new ApiError("Assistant could not be removed from this clinic.")); }
    finally { setBusy(false); }
  }

  async function recovery() {
    setBusy(true); setError(null);
    try { await apiRequest("/api/clinic/assistant/recovery/", { method: "POST", staffToken, data: { channel } }); }
    catch (reason) { setError(reason instanceof ApiError ? reason : new ApiError("Recovery could not be started.")); }
    finally { setBusy(false); }
  }

  const modal = <Dialog onClose={() => setOpen(false)} returnFocusSelector="#clinic-team-trigger" ariaLabelledBy="clinic-team-title" ariaDescribedBy="clinic-team-description">
    <div className="device-modal__header"><div><p className="eyebrow">Current clinic</p><h2 id="clinic-team-title">Clinic team</h2><p id="clinic-team-description">This Doctor controls the Assistant membership for this clinic only. Removing or replacing an Assistant never deletes that person's global Assistant account or their access to other clinics.</p></div><button className="device-icon-button" type="button" onClick={() => setOpen(false)} aria-label="Close clinic team">×</button></div>
    <ErrorMessage error={error} />
    {DEMO_MODE ? <p>Assistant membership management is simplified in the legacy browser demo.</p> : <>
      {assistant ? <div className="phase8-contact-card"><div><strong>{assistant.display_name}</strong><span>{assistant.email} · {assistant.phone}</span></div></div> : <p>No Assistant is currently assigned to this clinic.</p>}
      <div className="phase8-settings-section"><h3>{assistant ? "Replace Assistant" : "Add Assistant"}</h3><p>A one-time setup code is valid for 24 hours. Replacing the current Assistant deactivates only this clinic membership and preserves historical attribution.</p><Button variant="primary" type="button" disabled={busy} onClick={() => setupAssistant(Boolean(assistant))}>Create one-time setup code</Button>{setup && <><div className="pairing-code">{setup.setup_code}</div><p className="security-note">One-time code. Give it directly to the new Assistant.</p></>}</div>
      {assistant && <div className="phase8-settings-section"><h3>Remove from this clinic</h3><p>This immediately ends the Assistant's membership in this clinic. Their global account and other clinics are unaffected.</p><Button variant="danger" type="button" disabled={busy} onClick={removeAssistant}>Remove Assistant from clinic</Button></div>}
      {assistant && <div className="phase8-settings-section"><h3>Help with normal password recovery</h3><p>Recovery is sent to the Assistant's own verified contact. If they have lost every personal recovery method, replace their clinic membership instead; the Doctor cannot take over the global account.</p><SelectField label="Recovery channel" value={channel} onChange={(event) => setChannel(event.target.value)}><option value="email">Verified email</option><option value="sms">Verified SMS</option></SelectField><Button type="button" disabled={busy} onClick={recovery}>Send recovery instructions</Button></div>}
    </>}
  </Dialog>;
  return <>
    <Button id="clinic-team-trigger" type="button" disabled={open} onClick={() => { setOpen(true); onOpen?.(); }}>Clinic team</Button>
    {open && modal}
  </>;
}
