import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ApiError, DEMO_MODE, apiRequest } from "./api.js";
import { ErrorMessage } from "./ui.jsx";

export default function ClinicTeam({ user, staffToken }) {
  const [open, setOpen] = useState(false), [assistant, setAssistant] = useState(null), [error, setError] = useState(null), [setup, setSetup] = useState(null), [channel, setChannel] = useState("email"), [busy, setBusy] = useState(false);
  async function load() {
    try { const payload = await apiRequest("/api/clinic/assistant/", { staffToken }); setAssistant(payload.assistant); }
    catch (reason) { setError(reason instanceof ApiError ? reason : new ApiError("Assistant could not be loaded.")); }
  }
  useEffect(() => { if (open && !DEMO_MODE) load(); }, [open]);
  if (user.role !== "doctor") return null;
  if (!open) return <button type="button" onClick={() => setOpen(true)}>Clinic team</button>;

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

  const modal = <div className="device-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className="device-modal" role="dialog" aria-modal="true">
    <div className="device-modal__header"><div><p className="eyebrow">Current clinic</p><h2>Clinic team</h2><p>This Doctor controls the Assistant membership for this clinic only. Removing or replacing an Assistant never deletes that person's global Assistant account or their access to other clinics.</p></div><button className="device-icon-button" onClick={() => setOpen(false)}>×</button></div>
    <ErrorMessage error={error} />
    {DEMO_MODE ? <p>Assistant membership management is simplified in the legacy browser demo.</p> : <>
      {assistant ? <div className="phase8-contact-card"><div><strong>{assistant.display_name}</strong><span>{assistant.email} · {assistant.phone}</span></div></div> : <p>No Assistant is currently assigned to this clinic.</p>}
      <div className="phase8-settings-section"><h3>{assistant ? "Replace Assistant" : "Add Assistant"}</h3><p>A one-time setup code is valid for 24 hours. Replacing the current Assistant deactivates only this clinic membership and preserves historical attribution.</p><button className="primary-button" type="button" disabled={busy} onClick={() => setupAssistant(Boolean(assistant))}>Create one-time setup code</button>{setup && <><div className="pairing-code">{setup.setup_code}</div><p className="security-note">One-time code. Give it directly to the new Assistant.</p></>}</div>
      {assistant && <div className="phase8-settings-section"><h3>Remove from this clinic</h3><p>This immediately ends the Assistant's membership in this clinic. Their global account and other clinics are unaffected.</p><button type="button" disabled={busy} onClick={removeAssistant}>Remove Assistant from clinic</button></div>}
      {assistant && <div className="phase8-settings-section"><h3>Help with normal password recovery</h3><p>Recovery is sent to the Assistant's own verified contact. If they have lost every personal recovery method, replace their clinic membership instead; the Doctor cannot take over the global account.</p><select value={channel} onChange={(event) => setChannel(event.target.value)}><option value="email">Verified email</option><option value="sms">Verified SMS</option></select><button type="button" disabled={busy} onClick={recovery}>Send recovery instructions</button></div>}
    </>}
  </section></div>;
  return createPortal(modal, document.body);
}
