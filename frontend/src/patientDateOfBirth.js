export const PATIENT_DATE_OF_BIRTH_FUTURE_ERROR = "Date of birth cannot be in the future.";

export function validatePatientDateOfBirth(value, clinicToday) {
  if (value && clinicToday && value > clinicToday) {
    throw new Error(PATIENT_DATE_OF_BIRTH_FUTURE_ERROR);
  }
}
