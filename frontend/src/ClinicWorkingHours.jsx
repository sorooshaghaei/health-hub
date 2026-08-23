import { useEffect, useState } from "react";

import { ApiError, apiRequest } from "./api.js";
import { WEEKDAYS } from "./clinicWorkingHours.js";
import { ErrorMessage } from "./ui.jsx";
import "./workingHours.css";

const DEFAULT_START = "09:00";
const DEFAULT_END = "17:00";

function emptyRows() {
  return WEEKDAYS.map((day) => ({
    ...day,
    enabled: false,
    start_time: DEFAULT_START,
    end_time: DEFAULT_END,
  }));
}

function rowsFromPayload(workingHours) {
  const byWeekday = new Map(workingHours.map((item) => [Number(item.weekday), item]));
  return WEEKDAYS.map((day) => {
    const saved = byWeekday.get(day.value);
    return {
      ...day,
      enabled: Boolean(saved),
      start_time: saved?.start_time ?? DEFAULT_START,
      end_time: saved?.end_time ?? DEFAULT_END,
    };
  });
}

export default function ClinicWorkingHours({ clinic, editable, staffToken }) {
  const [rows, setRows] = useState(emptyRows);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiRequest(`/api/clinics/${clinic.id}/working-hours/`, { staffToken })
      .then((payload) => {
        if (cancelled) return;
        setRows(rowsFromPayload(payload.working_hours));
        setConfigured(payload.configured);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof ApiError ? requestError : new ApiError("Working hours could not be loaded."));
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clinic.id, staffToken]);

  function updateRow(weekday, change) {
    setError(null);
    setSaved(false);
    setRows((current) => current.map((row) => row.value === weekday ? { ...row, ...change } : row));
  }

  async function save(event) {
    event.preventDefault();
    const enabled = rows.filter((row) => row.enabled);
    const invalid = enabled.find((row) => !row.start_time || !row.end_time || row.start_time >= row.end_time);
    if (invalid) {
      setError(new ApiError(`${invalid.label}: end time must be later than start time.`));
      return;
    }

    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const payload = await apiRequest(`/api/clinics/${clinic.id}/working-hours/`, {
        method: "PUT",
        staffToken,
        data: {
          working_hours: enabled.map((row) => ({
            weekday: row.value,
            start_time: row.start_time,
            end_time: row.end_time,
          })),
        },
      });
      setRows(rowsFromPayload(payload.working_hours));
      setConfigured(payload.configured);
      setSaved(true);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Working hours could not be saved."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="clinic-hours-loading"><div className="loader" aria-label="Loading working hours" /></div>;

  return (
    <section className="clinic-hours-section" aria-labelledby="working-hours-heading">
      <div className="clinic-hours-heading">
        <div>
          <p className="eyebrow">Clinic schedule</p>
          <h2 id="working-hours-heading">Working days and hours</h2>
          <p>{editable ? "Choose one working-time range for each day the clinic works." : "The clinic Doctor manages this weekly schedule."}</p>
        </div>
        {!editable && <span className="clinic-hours-readonly">Read only</span>}
      </div>

      <ErrorMessage error={error} focus={editable} />
      {!configured && !editable && <p className="clinic-hours-empty">The Doctor has not configured working days and hours yet.</p>}

      {editable ? (
        <form onSubmit={save}>
          <div className="clinic-hours-list">
            {rows.map((row) => (
              <div className={`clinic-hours-row${row.enabled ? " clinic-hours-row--enabled" : ""}`} key={row.value}>
                <label className="clinic-hours-toggle">
                  <input type="checkbox" checked={row.enabled} onChange={(event) => updateRow(row.value, { enabled: event.target.checked })} />
                  <strong>{row.label}</strong>
                </label>
                <div className="clinic-hours-times">
                  <label>
                    <span>From</span>
                    <input aria-label={`${row.label} start time`} type="time" value={row.start_time} disabled={!row.enabled} required={row.enabled} onChange={(event) => updateRow(row.value, { start_time: event.target.value })} />
                  </label>
                  <span aria-hidden="true">–</span>
                  <label>
                    <span>To</span>
                    <input aria-label={`${row.label} end time`} type="time" value={row.end_time} disabled={!row.enabled} required={row.enabled} onChange={(event) => updateRow(row.value, { end_time: event.target.value })} />
                  </label>
                </div>
              </div>
            ))}
          </div>
          <div className="clinic-hours-actions">
            {saved && <span role="status">Working hours saved.</span>}
            <button className="primary-button primary-button--compact" type="submit" disabled={saving}>{saving ? "Saving…" : "Save working hours"}</button>
          </div>
        </form>
      ) : configured ? (
        <div className="clinic-hours-list clinic-hours-list--readonly">
          {rows.map((row) => (
            <div className={`clinic-hours-row${row.enabled ? " clinic-hours-row--enabled" : ""}`} key={row.value}>
              <strong>{row.label}</strong>
              <span>{row.enabled ? `${row.start_time}–${row.end_time}` : "Not working"}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
