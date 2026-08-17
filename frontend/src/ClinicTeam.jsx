import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ApiError, DEMO_MODE, apiRequest } from "./api.js";
import { ErrorMessage } from "./ui.jsx";

export default function ClinicTeam({ user, staffToken }) {
  const [open,setOpen]=useState(false),[assistant,setAssistant]=useState(null),[error,setError]=useState(null),[setup,setSetup]=useState(null),[channel,setChannel]=useState("email");
  async function load(){try{const p=await apiRequest("/api/clinic/assistant/",{staffToken});setAssistant(p.assistant);}catch(e){setError(e instanceof ApiError?e:new ApiError("Assistant could not be loaded."));}}
  useEffect(()=>{if(open&&!DEMO_MODE)load();},[open]);
  if(user.role!=="doctor") return null;
  if(!open) return <button type="button" onClick={()=>setOpen(true)}>Clinic team</button>;
  async function setupAssistant(replace){setError(null);try{const p=await apiRequest("/api/clinic/assistant/setup/",{method:"POST",staffToken,data:{replace_existing:replace}});setSetup(p);setAssistant(null);}catch(e){setError(e instanceof ApiError?e:new ApiError("Assistant setup could not be created."));}}
  async function recovery(){setError(null);try{await apiRequest("/api/clinic/assistant/recovery/",{method:"POST",staffToken,data:{channel}});}catch(e){setError(e instanceof ApiError?e:new ApiError("Recovery could not be started."));}}
  const modal=<div className="device-modal-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)setOpen(false)}}><section className="device-modal" role="dialog" aria-modal="true"><div className="device-modal__header"><div><p className="eyebrow">Current clinic</p><h2>Clinic team</h2><p>Each clinic has one Doctor slot and one Assistant slot. Personal profiles remain owned by each person.</p></div><button className="device-icon-button" onClick={()=>setOpen(false)}>×</button></div><ErrorMessage error={error}/>{DEMO_MODE?<p>Assistant replacement/recovery is simplified in the browser demo.</p>:<>{assistant?<div className="phase8-contact-card"><div><strong>{assistant.display_name}</strong><span>{assistant.email} · {assistant.phone}</span></div></div>:<p>No Assistant is currently assigned to this clinic.</p>}<div className="phase8-settings-section"><h3>{assistant?"Replace Assistant":"Add Assistant"}</h3><p>The setup code assigns a personal Assistant account to this clinic. Replacing an Assistant does not change their account or their work in other clinics.</p><button className="primary-button" type="button" onClick={()=>setupAssistant(Boolean(assistant))}>Create one-time setup code</button>{setup&&<div className="pairing-code">{setup.setup_code}</div>}</div>{assistant&&<div className="phase8-settings-section"><h3>Help current Assistant recover access</h3><select value={channel} onChange={(e)=>setChannel(e.target.value)}><option value="email">Verified email</option><option value="sms">Verified SMS</option></select><button type="button" onClick={recovery}>Send recovery instructions</button></div>}</>}</section></div>;
  return createPortal(modal,document.body);
}
