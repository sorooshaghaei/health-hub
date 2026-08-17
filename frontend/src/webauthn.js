function decode(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer;
}
function encode(value) {
  const bytes = new Uint8Array(value); let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function registrationOptions(options) { return { ...options, challenge: decode(options.challenge), user: { ...options.user, id: decode(options.user.id) }, excludeCredentials: (options.excludeCredentials ?? []).map((item) => ({ ...item, id: decode(item.id) })) }; }
function authenticationOptions(options) { return { ...options, challenge: decode(options.challenge), allowCredentials: (options.allowCredentials ?? []).map((item) => ({ ...item, id: decode(item.id) })) }; }
function publicCredential(credential) {
  const response = credential.response;
  const payload = { id: credential.id, rawId: encode(credential.rawId), type: credential.type, response: { clientDataJSON: encode(response.clientDataJSON) } };
  if (response.attestationObject) payload.response.attestationObject = encode(response.attestationObject);
  if (response.authenticatorData) payload.response.authenticatorData = encode(response.authenticatorData);
  if (response.signature) payload.response.signature = encode(response.signature);
  if (response.userHandle) payload.response.userHandle = encode(response.userHandle);
  if (typeof response.getTransports === "function") payload.response.transports = response.getTransports();
  if (credential.authenticatorAttachment) payload.authenticatorAttachment = credential.authenticatorAttachment;
  return payload;
}
export async function createPasskey(options) {
  if (!globalThis.PublicKeyCredential || !navigator.credentials) throw new Error("Passkeys are not supported in this browser.");
  const credential = await navigator.credentials.create({ publicKey: registrationOptions(options) });
  if (!credential) throw new Error("Passkey registration was cancelled.");
  return publicCredential(credential);
}
export async function getPasskey(options) {
  if (!globalThis.PublicKeyCredential || !navigator.credentials) throw new Error("Passkeys are not supported in this browser.");
  const credential = await navigator.credentials.get({ publicKey: authenticationOptions(options) });
  if (!credential) throw new Error("Passkey sign-in was cancelled.");
  return publicCredential(credential);
}
