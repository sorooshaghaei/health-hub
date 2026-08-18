import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ApiError, DEMO_MODE, apiRequest } from "./api.js";
import { ErrorMessage } from "./ui.jsx";
import "./deviceAccess.css";

function formatAdded(value) {
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
  return createPortal(<div className="device-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="device-modal" role="dialog" aria-modal="true">
      <div className="device-modal__header"><div><p className="eyebrow">Personal account</p><h2>Trusted devices</h2><p>A trusted browser works with every clinic connected to this account. Removing another device signs out its sessions across all clinics. The current device cannot be removed.</p></div><button className="device-icon-button" onClick={onClose}>×</button></div>
      <ErrorMessage error={error} />
      <div className="device-list">{loading && <p>Loading…</p>}{devices.map((device) => <div className="device-row" key={device.id}><div><strong>{device.browser} on {device.operating_system}</strong><span>Added {formatAdded(device.created_at)}{device.current ? " · Current device" : ""}</span></div><button className="device-remove-button" disabled={device.current || removing === device.id} onClick={() => remove(device)}>{device.current ? "Current device" : removing === device.id ? "Removing…" : "Remove"}</button></div>)}</div>
    </section>
  </div>, document.body);
}

export default function TrustedDevices({ staffToken }) {
  const [open, setOpen] = useState(false);
  if (DEMO_MODE) return null;
  return <><button type="button" onClick={() => setOpen(true)}>Devices</button>{open && <DeviceModal staffToken={staffToken} onClose={() => setOpen(false)} />}</>;
}
