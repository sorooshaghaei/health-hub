import { useEffect, useState } from "react";
import { ApiError, DEMO_MODE, apiRequest } from "./api.js";
import Dialog from "./Dialog.jsx";
import { Button, ErrorMessage } from "./ui.jsx";
import "./deviceAccess.css";

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "Unknown date";
}

function DeviceModal({ staffToken, onClose }) {
  const [devices, setDevices] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(null), [removing, setRemoving] = useState(null);
  async function load() {
    setLoading(true);
    try { const payload = await apiRequest("/api/devices/", { staffToken }); setDevices(payload.devices ?? []); }
    catch (reason) { setError(reason instanceof ApiError ? reason : new ApiError("Trusted devices could not be loaded.")); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  async function remove(device) {
    if (device.current) return;
    setRemoving(device.id); setError(null);
    try {
      await apiRequest(`/api/devices/${device.id}/`, { method: "DELETE", staffToken });
      setDevices((current) => current.filter((item) => item.id !== device.id));
    } catch (reason) { setError(reason instanceof ApiError ? reason : new ApiError("The device could not be removed.")); }
    finally { setRemoving(null); }
  }
  return <Dialog onClose={onClose} returnFocusSelector="#trusted-devices-trigger" ariaLabelledBy="trusted-devices-title" ariaDescribedBy="trusted-devices-description">
      <div className="device-modal__header"><div><p className="eyebrow">Personal account</p><h2 id="trusted-devices-title">Trusted devices</h2><p id="trusted-devices-description">A trusted browser works with every clinic connected to this account. Removing another device signs out its sessions across all clinics. The current device cannot be removed.</p></div><button className="device-icon-button" type="button" onClick={onClose} aria-label="Close trusted devices">×</button></div>
      <ErrorMessage error={error} />
      <div className="device-list">{loading && <p>Loading…</p>}{devices.map((device) => <div className="device-row" key={device.id}><div><strong>{device.browser} on {device.operating_system}</strong><span>Added {formatDate(device.created_at)} · Last used {formatDate(device.last_used_at)}{device.current ? " · Current device" : ""}</span></div><button className="device-remove-button" type="button" disabled={device.current || removing === device.id} onClick={() => remove(device)}>{device.current ? "Current device" : removing === device.id ? "Removing…" : "Remove"}</button></div>)}</div>
    </Dialog>;
}

export default function TrustedDevices({ staffToken, onOpen }) {
  const [open, setOpen] = useState(false);
  if (DEMO_MODE) return null;
  return <><Button id="trusted-devices-trigger" type="button" disabled={open} onClick={() => { setOpen(true); onOpen?.(); }}>Devices</Button>{open && <DeviceModal staffToken={staffToken} onClose={() => setOpen(false)} />}</>;
}
