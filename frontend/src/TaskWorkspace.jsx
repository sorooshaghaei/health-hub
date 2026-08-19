import { useCallback, useEffect, useState } from "react";
import { ApiError, apiRequest } from "./api.js";
import Dialog from "./Dialog.jsx";
import { TaskCard, TaskForm } from "./TaskParts.jsx";

export default function TaskWorkspace({ user, staffToken, doctorAccount, onRegisterUndo, onOpenPatient, refreshVersion }) {
  const [openTasks, setOpen] = useState([]), [completedTasks, setDone] = useState([]), [patients, setPatients] = useState([]);
  const [view, setView] = useState("open"), [expanded, setExpanded] = useState(null), [formTask, setFormTask] = useState(undefined);
  const [drafts, setDrafts] = useState({}), [editing, setEditing] = useState(null), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(null);
  const creating = formTask === null;

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try { const p = await apiRequest("/api/tasks/", { staffToken }); setOpen(p.open_tasks); setDone(p.completed_tasks); setError(null); }
    catch (e) { if (!quiet) setError(e instanceof ApiError ? e : new ApiError("Tasks could not be loaded.")); }
    finally { if (!quiet) setLoading(false); }
  }, [staffToken]);
  const loadPatients = useCallback(async () => {
    if (!doctorAccount) return;
    try { setPatients((await apiRequest("/api/patients/", { staffToken })).patients); } catch { /* optional selector */ }
  }, [doctorAccount, staffToken]);
  useEffect(() => { load(); loadPatients(); const timer = setInterval(() => load(true), 3000); return () => clearInterval(timer); }, [load, loadPatients, refreshVersion]);
  useEffect(() => { if (expanded && ![...openTasks, ...completedTasks].some((t) => t.id === expanded)) setExpanded(null); }, [expanded, openTasks, completedTasks]);

  async function act(work, message) {
    setSaving(true); setError(null);
    try { return await work(); } catch (e) { setError(e instanceof ApiError ? e : new ApiError(message)); return null; } finally { setSaving(false); }
  }
  async function saveTask(data) {
    if (!doctorAccount) return;
    const editingTask = formTask || null;
    const saved = await act(() => apiRequest(editingTask ? `/api/tasks/${editingTask.id}/` : "/api/tasks/", { method: editingTask ? "PATCH" : "POST", data, staffToken }), "Task could not be saved.");
    if (saved) { setFormTask(undefined); setExpanded(saved.id); setView(saved.status === "done" ? "history" : "open"); await load(true); }
  }
  async function markDone(task) {
    const p = await act(() => apiRequest(`/api/tasks/${task.id}/done/`, { method: "POST", staffToken }), "Task could not be marked done.");
    if (p) { onRegisterUndo({ id: `task-done:${task.id}:${Date.now()}`, kind: "task_done", resourceId: task.id, message: `${task.title} marked done.`, undoUntil: p.undo_until }); setExpanded(null); await load(true); }
  }
  async function deleteTask(task) {
    if (!doctorAccount) return;
    const p = await act(() => apiRequest(`/api/tasks/${task.id}/`, { method: "DELETE", staffToken }), "Task could not be deleted.");
    if (p) { onRegisterUndo({ id: `task-delete:${task.id}:${Date.now()}`, kind: "task_delete", resourceId: task.id, message: `${task.title} deleted.`, undoUntil: p.undo_until }); setExpanded(null); await load(true); }
  }
  async function addComment(taskId) {
    const body = drafts[taskId]?.trim(); if (!body) return;
    const p = await act(() => apiRequest(`/api/tasks/${taskId}/comments/`, { method: "POST", data: { body }, staffToken }), "Comment could not be added.");
    if (p) { setDrafts((d) => ({ ...d, [taskId]: "" })); await load(true); }
  }
  async function saveComment(id) {
    const body = editing?.id === id ? editing.body.trim() : ""; if (!body) return;
    const p = await act(() => apiRequest(`/api/task-comments/${id}/`, { method: "PATCH", data: { body }, staffToken }), "Comment could not be updated.");
    if (p) { setEditing(null); await load(true); }
  }
  async function deleteComment(comment) {
    const p = await act(() => apiRequest(`/api/task-comments/${comment.id}/`, { method: "DELETE", staffToken }), "Comment could not be deleted.");
    if (p) { onRegisterUndo({ id: `task-comment-delete:${comment.id}:${Date.now()}`, kind: "task_comment_delete", resourceId: comment.id, message: "Comment deleted.", undoUntil: p.undo_until }); setEditing(null); await load(true); }
  }
  const commentProps = (task) => ({ draft: drafts[task.id] ?? "", setDraft: (v) => setDrafts((d) => ({ ...d, [task.id]: v })), editing, setEditing, saveEdit: saveComment, add: () => addComment(task.id), remove: deleteComment, saving });

  function handleTabKeyDown(event) {
    const views = ["open", "history"];
    const currentIndex = views.indexOf(view);
    let nextIndex = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % views.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + views.length) % views.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = views.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = views[nextIndex];
    setView(next);
    window.requestAnimationFrame(() => document.getElementById(`task-tab-${next}`)?.focus());
  }

  function renderTaskPanel(panelView, tasks) {
    const active = view === panelView;
    return <div id={`task-panel-${panelView}`} role="tabpanel" aria-labelledby={`task-tab-${panelView}`} tabIndex={active ? 0 : -1} hidden={!active}>
      {active && <>
        {error && !creating && <div className="task-error" role="alert">{error.message}</div>}
        {doctorAccount && formTask && <TaskForm key={formTask.id} task={formTask} patients={patients} saving={saving} onSave={saveTask} onCancel={() => setFormTask(undefined)} />}
        {loading ? <div className="task-loading"><div className="loader" aria-label="Loading tasks" /></div> : tasks.length ? <div className="task-list">{tasks.map((task) => <TaskCard key={task.id} task={task} user={user} doctor={doctorAccount} expanded={expanded === task.id} toggle={() => setExpanded((id) => id === task.id ? null : task.id)} done={markDone} edit={setFormTask} remove={deleteTask} openPatient={onOpenPatient} comments={commentProps(task)} />)}</div> : <div className="task-empty"><strong>{panelView === "history" ? "No completed tasks yet." : "No open tasks."}</strong><p>{panelView === "history" ? "Done tasks will remain available here." : doctorAccount ? "Create a task for the Assistant when something needs follow-up." : "The Doctor has not assigned any tasks."}</p></div>}
      </>}
    </div>;
  }

  return <section className="task-workspace">
    <div className="task-toolbar"><div><p className="eyebrow">Shared work</p><h2>Tasks</h2><p>Doctor-created tasks for the Assistant.</p></div>{doctorAccount && <button id="new-task-trigger" className="primary-button" type="button" disabled={formTask !== undefined} onClick={() => setFormTask(null)}>New task</button>}</div>
    <div className="task-view-tabs" role="tablist" aria-label="Task views" onKeyDown={handleTabKeyDown}>
      <button id="task-tab-open" role="tab" aria-selected={view === "open"} aria-controls="task-panel-open" tabIndex={view === "open" ? 0 : -1} className={view === "open" ? "task-view-tab task-view-tab--active" : "task-view-tab"} type="button" onClick={() => setView("open")}>Open <span>{openTasks.length}</span></button>
      <button id="task-tab-history" role="tab" aria-selected={view === "history"} aria-controls="task-panel-history" tabIndex={view === "history" ? 0 : -1} className={view === "history" ? "task-view-tab task-view-tab--active" : "task-view-tab"} type="button" onClick={() => setView("history")}>History <span>{completedTasks.length}</span></button>
    </div>
    {renderTaskPanel("open", openTasks)}
    {renderTaskPanel("history", completedTasks)}
    {doctorAccount && creating && <Dialog backdropClassName="task-modal" className="task-modal__dialog" ariaLabel="New task" returnFocusSelector="#new-task-trigger" canClose={!saving} onClose={() => setFormTask(undefined)}>{error && <div className="task-error" role="alert">{error.message}</div>}<TaskForm key="new" task={null} patients={patients} saving={saving} onSave={saveTask} onCancel={() => setFormTask(undefined)} /></Dialog>}
  </section>;
}
