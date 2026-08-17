import { useEffect, useState } from "react";

import { ApiError, apiRequest } from "./api.js";
import PatientWorkspace from "./PatientWorkspace.jsx";
import { Brand, ErrorMessage, Field } from "./ui.jsx";

const STAFF_TOKEN_KEY = "health-hub.staff-token";
const DEMO_STORE_KEY = "health-hub.demo-store.v1";
const DEMO_CLINIC = {
  name: "Health Hub Demo",
  email: "demo@health-hub.local",
  phone: "+33 1 00 00 00 00",
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
  return <main className="auth-layout"><section className="auth-intro"><Brand /><div><p className="eyebrow">Browser-only demonstration</p><h1>{title}</h1><p>{description}</p></div></section><section className="auth-panel">{onBack&&<button className="back-button" type="button" onClick={onBack}>← Back</button>}{children}</section></main>;
}
function LoadingScreen(){return <div className="loading-screen"><Brand/><div className="loader" aria-label="Loading"/></div>}
function RoleSelection({context,onSelect}){return <AuthShell title={`Welcome to ${context.clinic.name}.`} description="The demo preserves the Doctor and Assistant workspaces but does not simulate real trusted-device, email/SMS, recovery-code, or passkey security."><div className="panel-heading"><p className="eyebrow">Demo clinic</p><h2>Which workspace?</h2></div><div className="choice-stack">{[["doctor","Doctor"],["assistant","Assistant"]].map(([role,title])=>{const exists=context.roles[role].exists;if(role==="assistant"&&!context.roles.doctor.exists)return null;return <button className="role-card" key={role} type="button" onClick={()=>onSelect(role)}><span className={`role-card__badge role-card__badge--${role}`}>{title[0]}</span><span className="role-card__content"><strong>{title}</strong><span>{exists?`Sign in to ${title} workspace`:`Create ${title} demo account`}</span></span><span>→</span></button>})}</div></AuthShell>}
function StaffForm({role,exists,onSubmit,onBack}){const[form,setForm]=useState(exists?{username:"",password:""}:EMPTY_STAFF),[error,setError]=useState(null),[busy,setBusy]=useState(false);const title=role==="doctor"?"Doctor":"Assistant";function update(e){setForm((x)=>({...x,[e.target.name]:e.target.value}))}async function submit(e){e.preventDefault();setBusy(true);setError(null);try{await onSubmit({...form,role})}catch(x){setError(x instanceof ApiError?x:new ApiError("Something went wrong."))}finally{setBusy(false)}}return <AuthShell title={`${title} demo ${exists?"sign in":"profile"}.`} description="Demo credentials exist only in this browser." onBack={onBack}><form className="form" onSubmit={submit}><ErrorMessage error={error}/>{!exists&&<div className="field-row"><Field label="First name" name="first_name" value={form.first_name} onChange={update} required/><Field label="Last name" name="last_name" value={form.last_name} onChange={update} required/></div>}<Field label="Username" name="username" value={form.username} onChange={update} required/>{!exists&&<Field label="Email" name="email" type="email" value={form.email} onChange={update} required/>}<Field label="Password" name="password" type="password" value={form.password} onChange={update} required/>{!exists&&<Field label="Confirm password" name="password_confirm" type="password" value={form.password_confirm} onChange={update} required/>}<button className="primary-button" disabled={busy}>{busy?"Please wait…":exists?`Open ${title} workspace`:`Create ${title} account`}</button></form></AuthShell>}

export default function DemoApp(){
  const[screen,setScreen]=useState("loading"),[context,setContext]=useState(null),[role,setRole]=useState(null),[token,setToken]=useState(null),[user,setUser]=useState(null);
  useEffect(()=>{async function restore(){const saved=localStorage.getItem(STAFF_TOKEN_KEY);if(saved){try{const p=await apiRequest("/api/staff/me/",{staffToken:saved});setToken(saved);setUser(p.user);setScreen("workspace");return}catch{localStorage.removeItem(STAFF_TOKEN_KEY)}}if(localStorage.getItem(DEMO_STORE_KEY)){try{const p=await apiRequest("/api/clinic/context/");setContext(p);setScreen("roles");return}catch{localStorage.removeItem(DEMO_STORE_KEY)}}setScreen("landing")}restore()},[]);
  async function openDemo(){let p;try{p=await apiRequest("/api/clinic/context/")}catch{localStorage.removeItem(DEMO_STORE_KEY);p=await apiRequest("/api/clinics/",{method:"POST",data:DEMO_CLINIC})}setContext({clinic:p.clinic,roles:p.roles});setScreen("roles")}
  async function submitStaff(form){const exists=context.roles[role].exists;const p=await apiRequest(exists?"/api/staff/login/":"/api/staff/register/",{method:"POST",data:form});localStorage.setItem(STAFF_TOKEN_KEY,p.session_token);setToken(p.session_token);setUser(p.user);setScreen("workspace")}
  async function signOut(){try{await apiRequest("/api/staff/logout/",{method:"POST",staffToken:token})}catch{}localStorage.removeItem(STAFF_TOKEN_KEY);setToken(null);setUser(null);const p=await apiRequest("/api/clinic/context/");setContext(p);setScreen("roles")}
  if(screen==="loading")return <LoadingScreen/>;
  if(screen==="landing")return <AuthShell title="A calmer clinic day." description="Open the browser-only Health Hub demo. Do not enter real Patient information."><div className="panel-heading"><p className="eyebrow">Browser demo</p><h2>Open Health Hub demo</h2></div><button className="primary-button" type="button" onClick={openDemo}>Open demo</button></AuthShell>;
  if(screen==="roles"&&context)return <RoleSelection context={context} onSelect={(value)=>{setRole(value);setScreen("staff")}}/>;
  if(screen==="staff"&&context&&role)return <StaffForm role={role} exists={context.roles[role].exists} onSubmit={submitStaff} onBack={()=>setScreen("roles")}/>;
  if(screen==="workspace"&&user&&token)return <PatientWorkspace user={user} staffToken={token} onSignOut={signOut} onCurrentDeviceRemoved={()=>{}} onSwitchClinic={()=>{}} onUserChange={setUser}/>;
  return <LoadingScreen/>;
}
