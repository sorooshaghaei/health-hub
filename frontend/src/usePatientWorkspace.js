import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, apiRequest } from "./api.js";

export default function usePatientWorkspace({ user, staffToken }) {
  const doctorAccount = user.role === "doctor";
  const doctorWorkspace = user.workspace_role === "doctor";
  const assistantWorkspace = user.workspace_role === "assistant";
  const canEditPatient = assistantWorkspace || doctorWorkspace;
  const canCreateDeletePatients = assistantWorkspace;
  const canManageAppointments = assistantWorkspace;
  const [section, setSection] = useState(doctorWorkspace ? "patients" : "schedule");
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [patientView, setPatientView] = useState("list");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientVisits, setPatientVisits] = useState([]);
  const [requestedVisitId, setRequestedVisitId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [undoActions, setUndoActions] = useState([]);
  const [undoingId, setUndoingId] = useState(null);
  const [scheduleRefreshVersion, setScheduleRefreshVersion] = useState(0);
  const patientSearchRequest = useRef(0);

  async function loadPatients(query = search) {
    const requestId = patientSearchRequest.current + 1;
    patientSearchRequest.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const suffix = query.trim() ? `?search=${encodeURIComponent(query.trim())}` : "";
      const payload = await apiRequest(`/api/patients/${suffix}`, { staffToken });
      if (patientSearchRequest.current === requestId) setPatients(payload.patients);
    } catch (requestError) {
      if (patientSearchRequest.current === requestId) {
        setError(requestError instanceof ApiError ? requestError : new ApiError("Patients could not be loaded."));
      }
    } finally {
      if (patientSearchRequest.current === requestId) setLoading(false);
    }
  }

  async function loadPatientVisits(patientId) {
    setVisitsLoading(true);
    try {
      const payload = await apiRequest(`/api/visits/?patient=${encodeURIComponent(patientId)}`, { staffToken });
      setPatientVisits(payload.visits);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Appointment history could not be loaded."));
    } finally {
      setVisitsLoading(false);
    }
  }

  useEffect(() => {
    const timer = globalThis.setTimeout(
      () => loadPatients(search),
      search.trim() ? 220 : 0,
    );
    return () => globalThis.clearTimeout(timer);
  }, [search, staffToken]);

  async function openPatient(patientId) {
    setError(null);
    try {
      const patient = await apiRequest(`/api/patients/${patientId}/`, { staffToken });
      setSelectedPatient(patient);
      setPatientView("detail");
      setSection("patients");
      await loadPatientVisits(patientId);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Patient could not be opened."));
    }
  }

  async function savePatient(data) {
    const editing = patientView === "edit" && selectedPatient;
    if (editing && !canEditPatient) return;
    if (!editing && !canCreateDeletePatients) return;
    const patient = await apiRequest(editing ? `/api/patients/${selectedPatient.id}/` : "/api/patients/", {
      method: editing ? "PATCH" : "POST",
      data,
      staffToken,
    });
    setSelectedPatient(patient);
    setPatientView("detail");
    await Promise.all([loadPatients(search), loadPatientVisits(patient.id)]);
  }

  const registerUndo = useCallback((action) => {
    setUndoActions((current) => [...current.filter((item) => item.id !== action.id), action]);
  }, []);

  const expireUndo = useCallback((actionId) => {
    setUndoActions((current) => current.filter((item) => item.id !== actionId));
  }, []);

  async function undoAction(action) {
    setUndoingId(action.id);
    setError(null);
    let endpoint;
    if (action.kind === "check_in") endpoint = `/api/visits/${action.resourceId}/undo-check-in/`;
    else if (action.kind === "with_doctor") endpoint = `/api/visits/${action.resourceId}/undo-with-doctor/`;
    else if (action.kind === "room_ready") endpoint = "/api/visits/room-ready/undo/";
    else if (action.kind === "appointment_delete") endpoint = `/api/visits/${action.resourceId}/undo-delete/`;
    else endpoint = `/api/patients/${action.resourceId}/undo-delete/`;
    try {
      await apiRequest(endpoint, { method: "POST", staffToken });
      expireUndo(action.id);
      setScheduleRefreshVersion((value) => value + 1);
      await loadPatients(search);
      if (selectedPatient && action.kind !== "patient_delete") await loadPatientVisits(selectedPatient.id);
    } catch (requestError) {
      expireUndo(action.id);
      setError(requestError instanceof ApiError ? requestError : new ApiError("The action could not be undone."));
    } finally {
      setUndoingId(null);
    }
  }

  async function deletePatient() {
    if (!canCreateDeletePatients || !selectedPatient) return;
    setDeleting(true);
    setError(null);
    try {
      const patientName = selectedPatient.full_name;
      const deleted = await apiRequest(`/api/patients/${selectedPatient.id}/`, { method: "DELETE", staffToken });
      registerUndo({
        id: `patient-delete:${selectedPatient.id}:${Date.now()}`,
        kind: "patient_delete",
        resourceId: selectedPatient.id,
        message: `${patientName} deleted.`,
        undoUntil: deleted.undo_until,
      });
      setSelectedPatient(null);
      setPatientVisits([]);
      setPatientView("list");
      await loadPatients(search);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Patient could not be deleted."));
    } finally {
      setDeleting(false);
    }
  }

  async function deleteVisit(visit) {
    if (!canManageAppointments) return;
    setError(null);
    try {
      const deleted = await apiRequest(`/api/visits/${visit.id}/`, { method: "DELETE", staffToken });
      registerUndo({
        id: `appointment-delete:${visit.id}:${Date.now()}`,
        kind: "appointment_delete",
        resourceId: visit.id,
        message: `${visit.patient.full_name}'s appointment deleted.`,
        undoUntil: deleted.undo_until,
      });
      setScheduleRefreshVersion((value) => value + 1);
      if (selectedPatient) await loadPatientVisits(selectedPatient.id);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Appointment could not be deleted."));
    }
  }

  function editVisit(visitId) {
    if (!canManageAppointments) return;
    setRequestedVisitId(visitId);
    setSection("schedule");
  }

  const requestedHandled = useCallback(() => setRequestedVisitId(null), []);

  function clearSearch() {
    setSearch("");
  }

  return {
    doctorAccount, doctorWorkspace, assistantWorkspace, canEditPatient,
    canCreateDeletePatients, canManageAppointments, section, setSection, patients,
    search, setSearch, patientView, setPatientView, selectedPatient, setSelectedPatient,
    patientVisits, requestedVisitId, loading, visitsLoading, error, deleting,
    undoActions, undoingId, scheduleRefreshVersion, openPatient, savePatient,
    registerUndo, expireUndo, undoAction, deletePatient, deleteVisit, editVisit,
    requestedHandled, clearSearch, loadPatientVisits,
  };
}
