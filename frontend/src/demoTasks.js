import { UNDO_WINDOW_MS as U, addMilliseconds as plus, fail, loadStore, resolveSession, saveStore } from "./demoApiCore.js";

const trim = (v) => typeof v === "string" ? v.trim() : "";
const now = () => new Date().toISOString();

function init(s) {
  if (!Array.isArray(s.tasks)) s.tasks = [];
  s.tasks.forEach((t) => {
    t.comments ??= [];
    t.status = t.status === "done" ? "done" : "open";
    t.description ??= ""; t.due_date ??= null; t.patient_id ??= null;
    t.completed_at ??= null; t.completed_by_id ??= null; t.deleted_at ??= null;
    t.comments.forEach((c) => { c.edited_at ??= null; c.deleted_at ??= null; });
  });
}
function doctor(session) {
  if (session.user.role !== "doctor") fail({ detail: "Only the Doctor can create, edit, or remove shared tasks." }, 403);
}
function staff(s, id) {
  const u = id && s.staff.find((x) => x.id === id);
  return u ? { id: u.id, display_name: `${u.first_name} ${u.last_name}`.trim() || u.username, role: u.role } : null;
}
function patient(s, id) {
  const p = id && s.patients.find((x) => x.id === id && !x.deleted_at);
  return p ? { id: p.id, full_name: p.full_name } : null;
}
function pubComment(s, c) {
  return { id: c.id, body: c.body, author: staff(s, c.author_id), created_at: c.created_at, edited_at: c.edited_at };
}
function pub(s, t) {
  return {
    id: t.id, title: t.title, description: t.description, due_date: t.due_date, status: t.status,
    patient: patient(s, t.patient_id), created_by: staff(s, t.created_by_id), completed_at: t.completed_at,
    completed_by: staff(s, t.completed_by_id), created_at: t.created_at, updated_at: t.updated_at,
    comments: t.comments.filter((c) => !c.deleted_at).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((c) => pubComment(s, c)),
  };
}
function task(s, id, deleted = false) {
  const t = s.tasks.find((x) => x.id === id && (deleted ? Boolean(x.deleted_at) : !x.deleted_at));
  if (!t) fail({ detail: deleted ? "Deleted task not found." : "Task not found." }, 404);
  return t;
}
function comment(s, id, deleted = false) {
  for (const t of s.tasks) if (!t.deleted_at) {
    const c = t.comments.find((x) => x.id === id && (deleted ? Boolean(x.deleted_at) : !x.deleted_at));
    if (c) return [t, c];
  }
  fail({ detail: deleted ? "Deleted comment not found." : "Comment not found." }, 404);
}
function due(v) {
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) fail({ due_date: ["Enter a valid date."] });
  return v;
}
function patientId(s, id) {
  if (!id) return null;
  if (!patient(s, id)) fail({ patient_id: ["Patient not found."] }, 404);
  return id;
}
function patch(s, data, old) {
  const out = {};
  if (!old || Object.hasOwn(data, "title")) { out.title = trim(data.title ?? old?.title); if (!out.title) fail({ title: ["Title is required."] }); }
  if (!old || Object.hasOwn(data, "description")) out.description = trim(data.description ?? old?.description ?? "");
  if (!old || Object.hasOwn(data, "due_date")) out.due_date = due(data.due_date ?? old?.due_date);
  if (!old || Object.hasOwn(data, "patient_id")) out.patient_id = patientId(s, data.patient_id ?? old?.patient_id);
  return out;
}
function body(data) { const value = trim(data.body); if (!value) fail({ body: ["Comment cannot be empty."] }); return value; }
function expired(at) { return Date.now() > new Date(plus(at, U)).getTime(); }

export async function demoTaskApiRequest(path, { method = "GET", data = {}, staffToken } = {}) {
  await new Promise((r) => globalThis.setTimeout(r, 20));
  const pathname = new URL(path, "https://health-hub.demo").pathname;
  const s = loadStore(); const session = resolveSession(s, staffToken); init(s);

  if (pathname === "/api/tasks/" && method === "GET") {
    const active = s.tasks.filter((t) => !t.deleted_at);
    return {
      open_tasks: active.filter((t) => t.status === "open").sort((a, b) => a.created_at.localeCompare(b.created_at)).map((t) => pub(s, t)),
      completed_tasks: active.filter((t) => t.status === "done").sort((a, b) => b.completed_at.localeCompare(a.completed_at)).map((t) => pub(s, t)),
    };
  }
  if (pathname === "/api/tasks/" && method === "POST") {
    doctor(session); const at = now();
    const t = { id: crypto.randomUUID(), clinic_id: s.clinic.id, created_by_id: session.user.id, ...patch(s, data), status: "open", completed_at: null, completed_by_id: null, deleted_at: null, created_at: at, updated_at: at, comments: [] };
    s.tasks.push(t); saveStore(s); return pub(s, t);
  }

  let m = pathname.match(/^\/api\/tasks\/([0-9a-f-]+)\/undo-done\/$/i);
  if (m && method === "POST") {
    const t = task(s, m[1]); if (t.status !== "done" || !t.completed_at) fail({ code: "task_not_done", detail: "This task is not done." });
    if (expired(t.completed_at)) fail({ code: "undo_expired", detail: "The five-second Undo period has expired." });
    t.status = "open"; t.completed_at = null; t.completed_by_id = null; t.updated_at = now(); saveStore(s); return pub(s, t);
  }
  m = pathname.match(/^\/api\/tasks\/([0-9a-f-]+)\/done\/$/i);
  if (m && method === "POST") {
    const t = task(s, m[1]); if (t.status !== "open") fail({ code: "task_already_done", detail: "This task is already done." }, 409);
    const at = now(); t.status = "done"; t.completed_at = at; t.completed_by_id = session.user.id; t.updated_at = at; saveStore(s);
    return { code: "task_done", detail: "Task marked done.", task: pub(s, t), undo_until: plus(at, U) };
  }
  m = pathname.match(/^\/api\/tasks\/([0-9a-f-]+)\/undo-delete\/$/i);
  if (m && method === "POST") {
    doctor(session); const t = task(s, m[1], true); if (expired(t.deleted_at)) fail({ code: "undo_expired", detail: "The five-second Undo period has expired." });
    t.deleted_at = null; t.updated_at = now(); saveStore(s); return pub(s, t);
  }
  m = pathname.match(/^\/api\/tasks\/([0-9a-f-]+)\/comments\/$/i);
  if (m && method === "POST") {
    const t = task(s, m[1]); const at = now(); const c = { id: crypto.randomUUID(), author_id: session.user.id, body: body(data), created_at: at, updated_at: at, edited_at: null, deleted_at: null };
    t.comments.push(c); t.updated_at = at; saveStore(s); return pubComment(s, c);
  }
  m = pathname.match(/^\/api\/tasks\/([0-9a-f-]+)\/$/i);
  if (m) {
    const t = task(s, m[1]);
    if (method === "GET") return pub(s, t);
    if (method === "PATCH") { doctor(session); if (t.created_by_id !== session.user.id) fail({ detail: "Only the Doctor who created this task can edit it." }, 403); Object.assign(t, patch(s, data, t)); t.updated_at = now(); saveStore(s); return pub(s, t); }
    if (method === "DELETE") { doctor(session); const at = now(); t.deleted_at = at; t.updated_at = at; saveStore(s); return { code: "task_deleted", detail: "Task deleted.", task_id: t.id, undo_until: plus(at, U) }; }
  }

  m = pathname.match(/^\/api\/task-comments\/([0-9a-f-]+)\/undo-delete\/$/i);
  if (m && method === "POST") {
    const [t, c] = comment(s, m[1], true); if (c.author_id !== session.user.id) fail({ detail: "You can undo only your own comment deletion." }, 403);
    if (expired(c.deleted_at)) fail({ code: "undo_expired", detail: "The five-second Undo period has expired." }); c.deleted_at = null; c.updated_at = now(); t.updated_at = c.updated_at; saveStore(s); return pubComment(s, c);
  }
  m = pathname.match(/^\/api\/task-comments\/([0-9a-f-]+)\/$/i);
  if (m) {
    const [t, c] = comment(s, m[1]); if (c.author_id !== session.user.id) fail({ detail: method === "DELETE" ? "You can delete only your own comments." : "You can edit only your own comments." }, 403);
    if (method === "PATCH") { const at = now(); c.body = body(data); c.edited_at = at; c.updated_at = at; t.updated_at = at; saveStore(s); return pubComment(s, c); }
    if (method === "DELETE") { const at = now(); c.deleted_at = at; c.updated_at = at; t.updated_at = at; saveStore(s); return { code: "task_comment_deleted", detail: "Comment deleted.", comment_id: c.id, undo_until: plus(at, U) }; }
  }
  fail({ detail: "This task API route is not available in the browser demo." }, 404);
}
