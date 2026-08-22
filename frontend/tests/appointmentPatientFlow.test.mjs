import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PATIENT_PICKER_MODE,
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
      patientPickerMode: PATIENT_PICKER_MODE.SEARCH,
      patientDraft: draft,
    }),
    { patient_id: "patient-1" },
  );
});

test("Patient search cannot implicitly create a new Patient", () => {
  assert.deepEqual(
    appointmentPatientPayload({
      workflowStarted: false,
      visit: null,
      selectedPatient: null,
      patientChanged: false,
      patientPickerMode: PATIENT_PICKER_MODE.SEARCH,
      patientDraft: draft,
    }),
    {},
  );
});

test("explicit new-Patient choice produces the nested Patient payload", () => {
  assert.deepEqual(
    appointmentPatientPayload({
      workflowStarted: false,
      visit: null,
      selectedPatient: null,
      patientChanged: false,
      patientPickerMode: PATIENT_PICKER_MODE.CREATE,
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

test("Appointment creation presents Patient search before the new-Patient form", async () => {
  const visitForm = await readFile(new URL("../src/VisitForm.jsx", import.meta.url), "utf8");

  assert.match(visitForm, /label="Search existing patients"/);
  assert.match(visitForm, />Select existing patient</);
  assert.match(visitForm, />\s*Create new patient\s*</);
  assert.match(
    visitForm,
    /patientPickerMode === PATIENT_PICKER_MODE\.CREATE \? \([\s\S]*?<PatientFields form=\{patientDraft\}/,
  );
  assert.match(visitForm, /<p className="eyebrow">\{visit \? "Edit appointment" : "Appointment details"\}<\/p>/);
  assert.match(visitForm, /\{visit \? "Edit appointment" : "New appointment"\}/);
  assert.match(visitForm, /visit \? "Save appointment" : "Create appointment"/);
  assert.match(visitForm, /disabled=\{submitting \|\| patientChoicePending\}/);
  assert.doesNotMatch(visitForm, /Continue below to create a new profile/);
});
