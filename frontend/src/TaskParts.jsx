import { useState } from "react";

export function formatTaskDate(value) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
}
export function formatTaskDateTime(value) {
  return value ? new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "";
}

export function TaskForm({ task, patients, saving, onSave, onCancel }) {
  const [form, setForm] = useState({ title: task?.title ?? "", description: task?.description ?? "", due_date: task?.due_date ?? "", patient_id: task?.patient?.id ?? "" });
  const update = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const submit = (e) => { e.preventDefault(); onSave({ ...form, due_date: form.due_date || null, patient_id: form.patient_id || null }); };
  return <form className="task-form" onSubmit={submit}>
    <div className="task-form__heading"><div><p className="eyebrow">{task ? "Edit task" : "New task"}</p><h3>{task ? task.title : "Task for Assistant"}</h3></div></div>
    <label className="task-field"><span>Title</span><input name="title" value={form.title} onChange={update} maxLength={200} required autoFocus={Boolean(task)} data-dialog-initial-focus={!task ? "true" : undefined} /></label>
    <label className="task-field"><span>Description</span><textarea name="description" value={form.description} onChange={update} rows={4} /></label>
    <div className="task-form__row">
      <label className="task-field"><span>Due date</span><input name="due_date" type="date" value={form.due_date} onChange={update} /></label>
      <label className="task-field"><span>Patient</span><select name="patient_id" value={form.patient_id} onChange={update}><option value="">No Patient</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></label>
    </div>
    <div className="form-actions"><button className="secondary-button" type="button" disabled={saving} onClick={onCancel}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : task ? "Save changes" : "Create task"}</button></div>
  </form>;
}

function Comments({ task, user, props }) {
  const { draft, setDraft, editing, setEditing, saveEdit, add, remove, saving } = props;
  return <section className="task-comments">
    <div className="task-comments__heading"><strong>Comments</strong><span>{task.comments.length}</span></div>
    {task.comments.length ? <div className="task-comment-list">{task.comments.map((c) => {
      const own = c.author?.id === user.id, edit = editing?.id === c.id;
      return <article className="task-comment" key={c.id}>
        <div className="task-comment__meta"><strong>{c.author?.display_name ?? "Clinic staff"}</strong><span>{formatTaskDateTime(c.created_at)}{c.edited_at ? " · Edited" : ""}</span></div>
        {edit ? <div className="task-comment-edit"><textarea aria-label="Edit comment" rows={3} value={editing.body} onChange={(e) => setEditing({ id: c.id, body: e.target.value })} /><div className="task-comment__actions"><button className="secondary-button" type="button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-button" type="button" disabled={saving} onClick={() => saveEdit(c.id)}>Save</button></div></div> : <><p>{c.body}</p>{own && <div className="task-comment__actions"><button className="text-button" type="button" onClick={() => setEditing({ id: c.id, body: c.body })}>Edit</button><button className="text-button text-button--danger" type="button" onClick={() => remove(c)}>Delete</button></div>}</>}
      </article>;
    })}</div> : <p className="task-muted">No comments yet.</p>}
    <div className="task-comment-compose"><textarea aria-label="New comment" rows={2} placeholder="Add a comment" value={draft} onChange={(e) => setDraft(e.target.value)} /><button className="secondary-button" type="button" disabled={saving || !draft.trim()} onClick={add}>Comment</button></div>
  </section>;
}

export function TaskCard({ task, user, doctor, expanded, editing, taskEditActive, editForm, toggle, done, edit, remove, openPatient, comments }) {
  const finished = task.status === "done";
  const detailsOpen = editing || expanded;
  return <article className={`task-card${finished ? " task-card--done" : ""}${editing ? " task-card--editing" : ""}`}>
    <button className="task-card__summary" type="button" onClick={editing ? undefined : toggle} aria-expanded={detailsOpen} aria-disabled={editing || undefined}><div className="task-card__main"><div className="task-card__title-row"><strong>{task.title}</strong><span className={`task-status task-status--${task.status}`}>{finished ? "Done" : "Open"}</span></div><div className="task-card__meta"><span>For Assistant</span><span>{formatTaskDate(task.due_date)}</span>{task.patient && <span>{task.patient.full_name}</span>}</div></div><span className="task-card__open">{editing ? "Editing" : expanded ? "Close" : "Open"}</span></button>
    {detailsOpen && (editing ? <div className="task-card__detail task-card__detail--editing">{editForm}</div> : <div className="task-card__detail">
      {task.description ? <p className="task-description">{task.description}</p> : <p className="task-muted">No description.</p>}
      {task.patient && <button className="task-patient-link" type="button" onClick={() => openPatient(task.patient.id)}>Open Patient · {task.patient.full_name}</button>}
      {finished && <p className="task-completed-note">Done {formatTaskDateTime(task.completed_at)}{task.completed_by ? ` by ${task.completed_by.display_name}` : ""}</p>}
      <div className="task-actions">{!finished && <button className="primary-button" type="button" onClick={() => done(task)}>Done</button>}{doctor && <button className="secondary-button" type="button" disabled={taskEditActive} onClick={() => edit(task)}>Edit</button>}{doctor && <button className="danger-button" type="button" onClick={() => remove(task)}>Delete</button>}</div>
      <Comments task={task} user={user} props={comments} />
    </div>)}
  </article>;
}
