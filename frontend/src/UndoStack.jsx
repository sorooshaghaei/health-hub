import { useEffect } from "react";

function UndoItem({ action, busy, onUndo, onExpire }) {
  useEffect(() => {
    const delay = Math.max(0, new Date(action.undoUntil).getTime() - Date.now());
    const timer = globalThis.setTimeout(() => onExpire(action.id), delay);
    return () => globalThis.clearTimeout(timer);
  }, [action.id, action.undoUntil, onExpire]);

  return (
    <div className="undo-toast" role="status">
      <span>{action.message}</span>
      <button type="button" disabled={busy} onClick={() => onUndo(action)}>
        {busy ? "Undoing…" : "Undo"}
      </button>
    </div>
  );
}

export default function UndoStack({ actions, undoingId, onUndo, onExpire }) {
  if (!actions.length) return null;
  return (
    <div className="undo-stack" aria-live="polite">
      {actions.map((action) => (
        <UndoItem
          action={action}
          busy={undoingId === action.id}
          key={action.id}
          onUndo={onUndo}
          onExpire={onExpire}
        />
      ))}
    </div>
  );
}
