import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiRequest } from "./api.js";

export default function usePatientWorkspace({ user, staffToken }) {
  const doctorAccount = user.role === "doctor", doctorWorkspace = user.workspace_role === "doctor", assistantWorkspace = user.workspace_role === "assistant";
  const canEditPatient = assistantWorkspace || doctorWorkspace, canCreateDeletePatients = assistantWorkspace, canManageAppointments = assistantWorkspace;
  const [section, setSectionState] = useState("schedule"), [patients, setPatients] = useState([]), [search, setSearch] = useState("");
  const [patientView, setPatientView] = useState("list"), [selectedPatient, setSelectedPatient] = useState(null), [patientVisits, setPatientVisits] = useState([]), [requestedVisitId, setRequestedVisitId] = useState(null);
  const [loading, setLoading] = useState(true), [visitsLoading, setVisitsLoading] = useState(false), [error, setError] = useState(null), [deleting, setDeleting] = useState(false);
  const [undoActions, setUndoActions] = useState([]), [undoingId, setUndoingId] = useState(null), [scheduleRefreshVersion, setScheduleRefreshVersion] = useState(0), [taskRefreshVersion, setTaskRefreshVersion] = useState(0), [taskAttention, setTaskAttention] = useState(false);
  const requestRef = useRef(0);
  const asError = (e, message) => e instanceof ApiError ? e : new ApiError(message);
  const setSection = useCallback((next) => { if (next === "tasks") setTaskAttention(false); setSectionState(next); }, []);

  async function loadPatients(query = search) {
    const id = ++requestRef.current; setLoading(true); setError(null);
    try { const suffix = query.trim() ? `?search=${encodeURIComponent(query.trim())}` : ""; const p = await apiRequest(`/api/patients/${suffix}`, { staffToken }); if (requestRef.current === id) setPatients(p.patients); }
    catch (e) { if (requestRef.current === id) setError(asError(e, "Patients could not be loaded.")); }
    finally { if (requestRef.current === id) setLoading(false); }
  }
  async function loadPatientVisits(id) {
    setVisitsLoading(true);
    try { setPatientVisits((await apiRequest(`/api/visits/?patient=${encodeURIComponent(id)}`, { staffToken })).visits); }
    catch (e) { setError(asError(e, "Appointment history could not be loaded.")); }
    finally { setVisitsLoading(false); }
  }
  useEffect(() => { const timer = setTimeout(() => loadPatients(search), search.trim() ? 220 : 0); return () => clearTimeout(timer); }, [search, staffToken]);
  useEffect(() => {
    let active = true;
    async function syncTaskAttention() {
      try {
        const payload = await apiRequest("/api/tasks/attention/", { method: section === "tasks" ? "POST" : "GET", staffToken });
        if (active) setTaskAttention(section === "tasks" ? false : Boolean(payload.attention_required));
      } catch { /* attention indicator is non-blocking */ }
    }
    syncTaskAttention();
    const timer = setInterval(syncTaskAttention, 3000);
    return () => {
      active = false;
      clearInterval(timer);
      if (section === "tasks") apiRequest("/api/tasks/attention/", { method: "POST", staffToken }).catch(() => {});
    };
  }, [section, staffToken]);

  async function openPatient(id) {
    setError(null);
    try { const p = await apiRequest(`/api/patients/${id}/`, { staffToken }); setSelectedPatient(p); setPatientView("detail"); setSection("patients"); await loadPatientVisits(id); }
    catch (e) { setError(asError(e, "Patient could not be opened.")); }
  }
  async function savePatient(data) {
    const editing = patientView === "edit" && selectedPatient;
    if ((editing && !canEditPatient) || (!editing && !canCreateDeletePatients)) return;
    const p = await apiRequest(editing ? `/api/patients/${selectedPatient.id}/` : "/api/patients/", { method: editing ? "PATCH" : "POST", data, staffToken });
    setSelectedPatient(p); setPatientView("detail"); await Promise.all([loadPatients(search), loadPatientVisits(p.id)]);
  }

  const registerUndo = useCallback((a) => setUndoActions((items) => [...items.filter((x) => x.id !== a.id), a]), []);
  const expireUndo = useCallback((id) => setUndoActions((items) => items.filter((x) => x.id !== id)), []);
  async function undoAction(a) {
    setUndoingId(a.id); setError(null);
    const map = { check_in: `/api/visits/${a.resourceId}/undo-check-in/`, with_doctor: `/api/visits/${a.resourceId}/undo-with-doctor/`, room_ready: "/api/visits/room-ready/undo/", appointment_delete: `/api/visits/${a.resourceId}/undo-delete/`, task_done: `/api/tasks/${a.resourceId}/undo-done/`, task_delete: `/api/tasks/${a.resourceId}/undo-delete/`, task_comment_delete: `/api/task-comments/${a.resourceId}/undo-delete/` };
    const endpoint = map[a.kind] ?? `/api/patients/${a.resourceId}/undo-delete/`;
    try {
      await apiRequest(endpoint, { method: "POST", staffToken }); expireUndo(a.id);
      if (a.kind.startsWith("task_")) setTaskRefreshVersion((v) => v + 1);
      else { setScheduleRefreshVersion((v) => v + 1); await loadPatients(search); if (selectedPatient && a.kind !== "patient_delete") await loadPatientVisits(selectedPatient.id); }
    } catch (e) { expireUndo(a.id); setError(asError(e, "The action could not be undone.")); }
    finally { setUndoingId(null); }
  }

  async function deletePatient() {
    if (!canCreateDeletePatients || !selectedPatient) return; setDeleting(true); setError(null);
    try { const p = selectedPatient, d = await apiRequest(`/api/patients/${p.id}/`, { method: "DELETE", staffToken }); registerUndo({ id: `patient-delete:${p.id}:${Date.now()}`, kind: "patient_delete", resourceId: p.id, message: `${p.full_name} deleted.`, undoUntil: d.undo_until }); setSelectedPatient(null); setPatientVisits([]); setPatientView("list"); await loadPatients(search); return null; }
    catch (e) { return asError(e, "Patient could not be deleted."); }
    finally { setDeleting(false); }
  }
  async function deleteVisit(visit) {
    if (!canManageAppointments) return; setError(null);
    try { const d = await apiRequest(`/api/visits/${visit.id}/`, { method: "DELETE", staffToken }); registerUndo({ id: `appointment-delete:${visit.id}:${Date.now()}`, kind: "appointment_delete", resourceId: visit.id, message: `${visit.patient.full_name}'s appointment deleted.`, undoUntil: d.undo_until }); setScheduleRefreshVersion((v) => v + 1); if (selectedPatient) await loadPatientVisits(selectedPatient.id); }
    catch (e) { setError(asError(e, "Appointment could not be deleted.")); }
  }
  function editVisit(id) { if (canManageAppointments) { setRequestedVisitId(id); setSection("schedule"); } }
  const requestedHandled = useCallback(() => setRequestedVisitId(null), []);
  const clearSearch = () => setSearch("");

  return { doctorAccount, doctorWorkspace, assistantWorkspace, canEditPatient, canCreateDeletePatients, canManageAppointments, section, setSection, patients, search, setSearch, patientView, setPatientView, selectedPatient, setSelectedPatient, patientVisits, requestedVisitId, loading, visitsLoading, error, deleting, undoActions, undoingId, scheduleRefreshVersion, taskRefreshVersion, taskAttention, openPatient, savePatient, registerUndo, expireUndo, undoAction, deletePatient, deleteVisit, editVisit, requestedHandled, clearSearch, loadPatientVisits };
}
