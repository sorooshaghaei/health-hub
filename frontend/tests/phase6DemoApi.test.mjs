import assert from "node:assert/strict";
import test from "node:test";
import { demoApiRequest as core } from "../src/demoApi.js";
import { demoTaskApiRequest as tasks } from "../src/demoTasks.js";

const storage = new Map();
globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k), clear: () => storage.clear() };

async function login() {
  const clinic = await core("/api/clinics/", { method: "POST", data: { name: "North Clinic", email: "clinic@example.com", phone: "+33 1 00 00 00 00", password: "clinic-password-123", password_confirm: "clinic-password-123" } });
  const reg = (role, username, email) => core("/api/staff/register/", { method: "POST", clinicToken: clinic.clinic_access_token, data: { role, username, email, first_name: "Test", last_name: role, password: "staff-password-123", password_confirm: "staff-password-123" } });
  const assistant = await reg("assistant", "assistant.one", "assistant@example.com"), doctor = await reg("doctor", "doctor.one", "doctor@example.com");
  const admin = await core("/api/staff/login/", { method: "POST", clinicToken: clinic.clinic_access_token, data: { role: "assistant", username: "doctor.one", password: "staff-password-123" } });
  return { assistant, doctor, admin };
}
async function patient(token) {
  return core("/api/patients/", { method: "POST", staffToken: token, data: { full_name: "Sara Ahmadi", gender: "Woman", country_calling_code: "+98", phone_number: "09121234567", date_of_birth: "1994-05-11", patient_note: "" } });
}

test("Phase 6 demo task permissions, history, Done Undo, and attention dots", async () => {
  localStorage.clear(); const { assistant, doctor, admin } = await login(), p = await patient(assistant.session_token);
  assert.equal((await tasks("/api/tasks/attention/", { staffToken: assistant.session_token })).attention_required, false);
  assert.equal((await tasks("/api/tasks/attention/", { staffToken: doctor.session_token })).attention_required, false);
  await assert.rejects(() => tasks("/api/tasks/", { method: "POST", staffToken: assistant.session_token, data: { title: "No" } }), (e) => e.status === 403);
  const first = await tasks("/api/tasks/", { method: "POST", staffToken: doctor.session_token, data: { title: "Call Patient", description: "Confirm arrival.", due_date: "2026-08-20", patient_id: p.id } });
  assert.equal((await tasks("/api/tasks/attention/", { staffToken: assistant.session_token })).attention_required, true);
  assert.equal((await tasks("/api/tasks/attention/", { staffToken: doctor.session_token })).attention_required, false);
  assert.equal((await tasks("/api/tasks/attention/", { method: "POST", staffToken: assistant.session_token })).attention_required, false);
  const second = await tasks("/api/tasks/", { method: "POST", staffToken: admin.session_token, data: { title: "Prepare form" } });
  let list = await tasks("/api/tasks/", { staffToken: assistant.session_token });
  assert.deepEqual(list.open_tasks.map((t) => t.id), [first.id, second.id]); assert.equal(list.open_tasks[0].patient.full_name, "Sara Ahmadi");
  const done = await tasks(`/api/tasks/${first.id}/done/`, { method: "POST", staffToken: assistant.session_token }); assert.equal(done.task.status, "done"); assert.ok(done.undo_until);
  assert.equal((await tasks("/api/tasks/attention/", { staffToken: doctor.session_token })).attention_required, true);
  assert.equal((await tasks("/api/tasks/attention/", { method: "POST", staffToken: doctor.session_token })).attention_required, false);
  list = await tasks("/api/tasks/", { staffToken: doctor.session_token }); assert.deepEqual(list.open_tasks.map((t) => t.id), [second.id]); assert.equal(list.completed_tasks[0].id, first.id);
  assert.equal((await tasks(`/api/tasks/${first.id}/undo-done/`, { method: "POST", staffToken: assistant.session_token })).status, "open");
});

test("Phase 6 demo comment ownership, Edited, and delete Undo", async () => {
  localStorage.clear(); const { assistant, doctor } = await login();
  const task = await tasks("/api/tasks/", { method: "POST", staffToken: doctor.session_token, data: { title: "Follow up" } });
  const c = await tasks(`/api/tasks/${task.id}/comments/`, { method: "POST", staffToken: assistant.session_token, data: { body: "Called once." } });
  await assert.rejects(() => tasks(`/api/task-comments/${c.id}/`, { method: "PATCH", staffToken: doctor.session_token, data: { body: "Rewrite" } }), (e) => e.status === 403);
  const edited = await tasks(`/api/task-comments/${c.id}/`, { method: "PATCH", staffToken: assistant.session_token, data: { body: "Called twice." } }); assert.equal(edited.body, "Called twice."); assert.ok(edited.edited_at);
  assert.ok((await tasks(`/api/task-comments/${c.id}/`, { method: "DELETE", staffToken: assistant.session_token })).undo_until);
  assert.equal((await tasks(`/api/task-comments/${c.id}/undo-delete/`, { method: "POST", staffToken: assistant.session_token })).body, "Called twice.");
});
