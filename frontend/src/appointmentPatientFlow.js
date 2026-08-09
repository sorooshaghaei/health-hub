export const PATIENT_SUGGESTION_MIN_CHARACTERS = 2;

export function shouldSuggestPatients(fullName) {
  return fullName.trim().length >= PATIENT_SUGGESTION_MIN_CHARACTERS;
}

export function appointmentPatientPayload({
  workflowStarted,
  visit,
  selectedPatient,
  patientChanged,
  patientDraft,
  confirmDuplicate = false,
}) {
  if (workflowStarted) return {};

  if (selectedPatient) {
    if (!visit || patientChanged) return { patient_id: selectedPatient.id };
    return {};
  }

  return {
    new_patient: {
      ...patientDraft,
      date_of_birth: patientDraft.date_of_birth || null,
      confirm_duplicate: Boolean(confirmDuplicate),
    },
  };
}
