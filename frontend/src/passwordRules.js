const KNOWN_COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "abcdefgh",
  "iloveyou",
  "letmein",
  "password",
  "password1",
  "qwerty123",
  "welcome1",
]);

export function personalPasswordTokens(values = []) {
  return values.flatMap((value) => {
    const normalized = String(value || "").toLowerCase();
    const personalPart = normalized.includes("@")
      ? normalized.split("@", 1)[0]
      : normalized;
    return personalPart.match(/[a-z0-9]+/g) || [];
  }).filter((value) => value.length >= 3);
}

export function passwordRequirements(password, confirmation, personalValues = []) {
  const value = String(password || "");
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const tokens = personalPasswordTokens(personalValues);
  const hasPassword = Boolean(value);
  const longEnough = value.length >= 8;
  const notNumeric = hasPassword && !/^\d+$/.test(value);
  const avoidsPersonal = hasPassword && !tokens.some((token) => (
    normalized.includes(token.replace(/[^a-z0-9]/g, ""))
  ));
  const notKnownCommon = hasPassword && !KNOWN_COMMON_PASSWORDS.has(value.toLowerCase());
  const matches = Boolean(confirmation) && value === confirmation;
  const valid = longEnough && notNumeric && avoidsPersonal && notKnownCommon && matches;

  const rawScore = [
    longEnough,
    value.length >= 12,
    /[a-z]/.test(value) && /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;
  const hasKnownFailure = hasPassword && (!longEnough || !notNumeric || !avoidsPersonal || !notKnownCommon);
  const score = hasKnownFailure ? 0 : rawScore;
  const strength = !hasPassword
    ? "Not entered"
    : hasKnownFailure
      ? "Invalid"
      : score >= 4
        ? "Strong"
        : score >= 3
          ? "Fair"
          : "Weak";

  return {
    avoidsPersonal,
    hasPassword,
    longEnough,
    matches,
    notKnownCommon,
    notNumeric,
    score,
    strength,
    valid,
  };
}
