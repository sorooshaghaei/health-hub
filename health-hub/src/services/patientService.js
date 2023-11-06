import axios from "axios";

const SERVER_URL = "http://localhost:9000";

export const getAllPatients = () => {
  const url = `${SERVER_URL}/patients`;
  return axios.get(url);
};

export const getPatientInfo = (patientId) => {
  const url = `${SERVER_URL}/patients/${patientId}`;
  return axios.get(url);
};

export const createPatient = (patient) => {
  const url = `${SERVER_URL}/patients`;
  return axios.post(url, patient);
};

export const updatePatient = (patient, patientId) => {
  const url = `${SERVER_URL}/patients/${patientId}`;
  return axios.put(url, patient);
};

export const deletePatient = (patientId) => {
  const url = `${SERVER_URL}/patients/${patientId}`;
  return axios.delete(url);
};

// ------------------------------------------------------------------------------------------------------------------------

export const getAllGroups = () => {
  const url = `${SERVER_URL}/groups`;
  return axios.get(url);
};

export const getGroup = (groupId) => {
  const url = `${SERVER_URL}/groups/${groupId}`;
  return axios.get(url);
};

export const createGroup = (group) => {
  const url = `${SERVER_URL}/groups`;
  return axios.post(url, group);
};

export const updateGroup = (group, groupId) => {
  const url = `${SERVER_URL}/groups/${groupId}`;
  return axios.put(url, group);
};

export const deleteGroup = (groupId) => {
  const url = `${SERVER_URL}/groups/${groupId}`;
  return axios.delete(url);
};

// ----------------------------------------------------------------------------------------------------------------

export const getAllSicknesses = () => {
  const url = `${SERVER_URL}/sickness`;
  return axios.get(url);
};

export const getSickness = (sicknessId) => {
  const url = `${SERVER_URL}/sickness/${sicknessId}`;
  return axios.get(url);
};

export const createSickness = (sickness) => {
  const url = `${SERVER_URL}/sickness`;
  return axios.post(url, sickness);
};

export const updateSickness = (sickness, sicknessId) => {
  const url = `${SERVER_URL}/sickness/${sicknessId}`;
  return axios.put(url, sickness);
};

export const deleteSickness = (sicknessId) => {
  const url = `${SERVER_URL}/sickness/${sicknessId}`;
  return axios.delete(url);
};

// Update the saveRegistrationData function
export const saveRegistrationData = async (user) => {
  const url = `${SERVER_URL}/users`;
  const response = await axios.post(url, user);
  return response;
};