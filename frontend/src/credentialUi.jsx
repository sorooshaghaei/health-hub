import { useEffect, useId, useMemo, useState } from "react";
import "./credentialUi.css";

export function useResendCountdown() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = window.setTimeout(() => setSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  function start(payloadOrSeconds = 60) {
    const value = typeof payloadOrSeconds === "number"
      ? payloadOrSeconds
      : payloadOrSeconds?.resend_after_seconds;
    setSeconds(Math.max(0, Number.isFinite(Number(value)) ? Math.ceil(Number(value)) : 60));
  }

  return { seconds, start, reset: () => setSeconds(0) };
}

export function PasswordField({ label, hint, id: providedId, className = "", ...props }) {
  const generatedId = useId();
  const id = providedId || generatedId;
  const [visible, setVisible] = useState(false);
  return <div className={`field credential-field${className ? ` ${className}` : ""}`}>
    <label className="credential-field__label" htmlFor={id}>{label}</label>
    <div className="password-control">
      <input {...props} id={id} type={visible ? "text" : "password"} />
      <button
        className="password-control__toggle"
        type="button"
        aria-label={`${visible ? "Hide" : "Show"} ${String(label).toLowerCase()}`}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >{visible ? "Hide" : "Show"}</button>
    </div>
    {hint && <small>{hint}</small>}
  </div>;
}

function personalTokens(values) {
  return values.flatMap((value) => {
    const normalized = String(value || "").toLowerCase();
    const personalPart = normalized.includes("@") ? normalized.split("@", 1)[0] : normalized;
    return personalPart.match(/[a-z0-9]+/g) || [];
  })
    .filter((value) => value.length >= 3);
}

function Requirement({ state, children }) {
  return <li className={`password-requirement password-requirement--${state}`}>
    <span aria-hidden="true">{state === "pass" ? "✓" : state === "fail" ? "!" : "·"}</span>{children}
  </li>;
}

export function PasswordPair({
  password,
  confirmation,
  onPasswordChange,
  onConfirmationChange,
  personalValues = [],
  passwordName = "password",
  confirmationName = "password_confirm",
  passwordLabel = "Password",
  confirmationLabel = "Confirm password",
}) {
  const tokens = useMemo(() => personalTokens(personalValues), [personalValues]);
  const normalized = String(password || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const hasPassword = Boolean(password);
  const longEnough = String(password || "").length >= 8;
  const notNumeric = hasPassword && !/^\d+$/.test(password);
  const avoidsPersonal = hasPassword && !tokens.some((token) => normalized.includes(token.replace(/[^a-z0-9]/g, "")));
  const matches = Boolean(confirmation) && password === confirmation;
  const score = [
    longEnough,
    String(password || "").length >= 12,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const strength = !hasPassword ? "Not entered" : score >= 4 ? "Strong" : score >= 3 ? "Fair" : "Weak";

  return <div className="password-pair">
    <PasswordField
      label={passwordLabel}
      name={passwordName}
      value={password}
      onChange={onPasswordChange}
      autoComplete="new-password"
      required
      aria-invalid={hasPassword && (!longEnough || !notNumeric || !avoidsPersonal)}
    />
    <div className="password-guidance" aria-live="polite">
      <div className="password-strength">
        <span>Password strength: <strong>{strength}</strong></span>
        <span className={`password-strength__meter password-strength__meter--${strength.toLowerCase().replace(" ", "-")}`} role="meter" aria-label="Password strength" aria-valuemin="0" aria-valuemax="5" aria-valuenow={score} />
      </div>
      <ul>
        <Requirement state={!hasPassword ? "pending" : longEnough ? "pass" : "fail"}>At least 8 characters</Requirement>
        <Requirement state={!hasPassword ? "pending" : notNumeric ? "pass" : "fail"}>Not entirely numeric</Requirement>
        <Requirement state={!hasPassword ? "pending" : avoidsPersonal ? "pass" : "fail"}>Does not include your name, email, or phone</Requirement>
        <Requirement state="pending">Common passwords are rejected when submitted</Requirement>
      </ul>
    </div>
    <PasswordField
      label={confirmationLabel}
      name={confirmationName}
      value={confirmation}
      onChange={onConfirmationChange}
      autoComplete="new-password"
      required
      aria-invalid={Boolean(confirmation) && !matches}
    />
    <p className={`password-match password-match--${!confirmation ? "pending" : matches ? "pass" : "fail"}`} aria-live="polite">
      {!confirmation ? "Re-enter the password to confirm it." : matches ? "Passwords match." : "Passwords do not match."}
    </p>
  </div>;
}
