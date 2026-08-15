import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ApiError, DEMO_MODE, apiRequest } from "./api.js";
import { ErrorMessage } from "./ui.jsx";
import "./deviceAccess.css";

function formatAdded(value) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function DeviceModal({ staffToken, onClose, onCurrentDeviceRemoved }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pairingCode, setPairingCode] = useState("");
  const [approving, setApproving] = useState(false);
  const [approvedDevice, setApprovedDevice] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const currentDevice = useMemo(
    () => devices.find((device) => device.current) ?? null,
    [devices],
  );

  async function loadDevices() {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequest("/api/devices/", { staffToken });
      setDevices(payload.devices ?? []);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Trusted devices could not be loaded."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function approvePairing(event) {
    event.preventDefault();
    setError(null);
    setApprovedDevice(null);
    setApproving(true);
    try {
      const payload = await apiRequest("/api/devices/pairing/approve/", {
        method: "POST",
        staffToken,
        data: { code: pairingCode },
      });
      setPairingCode("");
      setApprovedDevice(`${payload.browser} on ${payload.operating_system}`);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("The device could not be approved."));
    } finally {
      setApproving(false);
    }
  }

  async function removeDevice(device) {
    setError(null);
    setRemovingId(device.id);
    try {
      await apiRequest(`/api/devices/${device.id}/`, {
        method: "DELETE",
        staffToken,
      });
      if (device.current) {
        onCurrentDeviceRemoved?.();
        return;
      }
      setDevices((current) => current.filter((candidate) => candidate.id !== device.id));
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("The device could not be removed."));
    } finally {
      setRemovingId(null);
    }
  }

  return createPortal(
    <div className="device-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="device-modal" role="dialog" aria-modal="true" aria-labelledby="trusted-devices-title">
        <div className="device-modal__header">
          <div>
            <p className="eyebrow">Clinic access</p>
            <h2 id="trusted-devices-title">Trusted devices</h2>
            <p>Only trusted browsers can open this clinic. Removing a device also ends staff sessions created on that device.</p>
          </div>
          <button className="device-icon-button" type="button" onClick={onClose} aria-label="Close trusted devices">×</button>
        </div>

        <ErrorMessage error={error} />

        <div className="device-list" aria-live="polite">
          {loading && <p className="muted-text">Loading trusted devices…</p>}
          {!loading && devices.map((device) => {
            const isLastDevice = devices.length <= 1;
            return (
              <div className="device-row" key={device.id}>
                <div>
                  <strong>{device.browser} on {device.operating_system}</strong>
                  <span>
                    Added {formatAdded(device.created_at)}
                    {device.current ? " · Current device" : ""}
                  </span>
                </div>
                <button
                  className="device-remove-button"
                  type="button"
                  onClick={() => removeDevice(device)}
                  disabled={removingId === device.id || isLastDevice}
                  title={isLastDevice ? "At least one trusted device must remain for the clinic." : undefined}
                >
                  {removingId === device.id ? "Removing…" : "Remove"}
                </button>
              </div>
            );
          })}
        </div>

        {currentDevice && devices.length === 1 && (
          <p className="device-help">This is the clinic&apos;s only trusted device, so it cannot be removed until another device has been paired.</p>
        )}

        <div className="device-pair-panel">
          <div>
            <p className="eyebrow">Add device</p>
            <h3>Approve a pairing code</h3>
            <p>On the new browser, choose <strong>Use another device</strong>. Enter the six-digit code shown there.</p>
          </div>
          {approvedDevice && <p className="device-success">{approvedDevice} approved. The new browser will finish pairing automatically.</p>}
          <form className="device-pair-form" onSubmit={approvePairing}>
            <label htmlFor="device-pairing-code">Pairing code</label>
            <div>
              <input
                id="device-pairing-code"
                value={pairingCode}
                onChange={(event) => setPairingCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123 456"
                maxLength={7}
                required
              />
              <button className="primary-button" type="submit" disabled={approving}>
                {approving ? "Approving…" : "Approve device"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export default function TrustedDevices({ staffToken, onCurrentDeviceRemoved }) {
  const [open, setOpen] = useState(false);

  if (DEMO_MODE) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Devices</button>
      {open && (
        <DeviceModal
          staffToken={staffToken}
          onClose={() => setOpen(false)}
          onCurrentDeviceRemoved={onCurrentDeviceRemoved}
        />
      )}
    </>
  );
}
