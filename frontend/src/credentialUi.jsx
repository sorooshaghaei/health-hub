import { useEffect, useId, useState } from "react";

import { passwordRequirements } from "./passwordRules.js";
import "./credentialUi.css";

export function useResendCountdown() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (seconds <= 0) return undefined;
    const timer = window.setTimeout(() => setSeconds((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  function start(payloadOrSeconds = 60) {
    const availableAt = typeof payloadOrSeconds === "object"
      ? payloadOrSeconds?.resend_available_at
      : null;
    const absoluteSeconds = availableAt
      ? Math.max(0, Math.ceil((new Date(availableAt).getTime() - Date.now()) / 1000))
      : null;
    const value = absoluteSeconds ?? (typeof payloadOrSeconds === "number"
      ? payloadOrSeconds
      : payloadOrSeconds?.resend_after_seconds);
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

export function verificationCodeValue(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

export function verificationCodeComplete(value) {
  return /^\d{6}$/.test(String(value || ""));
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
  const {
    avoidsPersonal,
    hasPassword,
    longEnough,
    matches,
    notKnownCommon,
    notNumeric,
    score,
    strength,
  } = passwordRequirements(password, confirmation, personalValues);

  return <div className="password-pair">
    <PasswordField
      label={passwordLabel}
      name={passwordName}
      value={password}
      onChange={onPasswordChange}
      autoComplete="new-password"
      required
      aria-invalid={hasPassword && (!longEnough || !notNumeric || !avoidsPersonal || !notKnownCommon)}
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
        <Requirement state={!hasPassword ? "pending" : notKnownCommon ? "pending" : "fail"}>Additional common-password checks run when submitted</Requirement>
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
