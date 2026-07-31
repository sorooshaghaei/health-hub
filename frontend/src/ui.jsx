export function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`}>
      <div className="brand__mark" aria-hidden="true">H</div>
      <div>
        <strong>Health Hub</strong>
        {!compact && <span>Simple clinic workflow</span>}
      </div>
    </div>
  );
}

export function ErrorMessage({ error }) {
  if (!error) return null;
  return <div className="alert alert--error" role="alert">{error.message}</div>;
}

export function Field({ label, hint, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function SelectField({ label, children, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select {...props}>{children}</select>
    </label>
  );
}

export function TextAreaField({ label, hint, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea {...props} />
      {hint && <small>{hint}</small>}
    </label>
  );
}
