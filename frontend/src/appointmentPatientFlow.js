export const PATIENT_SUGGESTION_MIN_CHARACTERS = 2;

export const PATIENT_PICKER_MODE = Object.freeze({
  SEARCH: "search",
  CREATE: "create",
});

export function shouldSuggestPatients(fullName) {
  return fullName.trim().length >= PATIENT_SUGGESTION_MIN_CHARACTERS;
}

export function appointmentPatientPayload({
  workflowStarted,
  visit,
  selectedPatient,
  patientChanged,
  patientPickerMode,
  patientDraft,
  confirmDuplicate = false,
}) {
  if (workflowStarted) return {};

  if (selectedPatient) {
    if (!visit || patientChanged) return { patient_id: selectedPatient.id };
    return {};
  }

  if (patientPickerMode !== PATIENT_PICKER_MODE.CREATE) return {};

  return {
    new_patient: {
      ...patientDraft,
      date_of_birth: patientDraft.date_of_birth || null,
      confirm_duplicate: Boolean(confirmDuplicate),
    },
  };
}
