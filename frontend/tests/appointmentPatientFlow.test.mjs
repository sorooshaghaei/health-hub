import assert from "node:assert/strict";
import test from "node:test";

import {
  PATIENT_SUGGESTION_MIN_CHARACTERS,
  appointmentPatientPayload,
  shouldSuggestPatients,
} from "../src/appointmentPatientFlow.js";

const draft = {
  full_name: "Sara Ahmadi",
  gender: "Woman",
  country_calling_code: "+98",
  phone_number: "09121234567",
  date_of_birth: "",
  patient_note: "",
};

test("Patient suggestions start after two typed characters", () => {
  assert.equal(PATIENT_SUGGESTION_MIN_CHARACTERS, 2);
  assert.equal(shouldSuggestPatients("s"), false);
  assert.equal(shouldSuggestPatients(" sa "), true);
});

test("selected existing Patient produces patient_id only", () => {
  assert.deepEqual(
    appointmentPatientPayload({
      workflowStarted: false,
      visit: null,
      selectedPatient: { id: "patient-1" },
      patientChanged: true,
      patientDraft: draft,
    }),
    { patient_id: "patient-1" },
  );
});

test("unselected Patient continues as inline new-Patient creation", () => {
  assert.deepEqual(
    appointmentPatientPayload({
      workflowStarted: false,
      visit: null,
      selectedPatient: null,
      patientChanged: false,
      patientDraft: draft,
      confirmDuplicate: true,
    }),
    {
      new_patient: {
        ...draft,
        date_of_birth: null,
        confirm_duplicate: true,
      },
    },
  );
});
