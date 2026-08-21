import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Forgot password appears only on the actual sign-in form", async () => {
  const app = await source("../src/App.jsx");
  const roleScreens = app.slice(app.indexOf("function RoleChoice"), app.indexOf("function LoginForm"));
  const loginScreen = app.slice(app.indexOf("function LoginForm"), app.indexOf("function AccountCreateForm"));

  assert.doesNotMatch(roleScreens, /Forgot password\?/);
  assert.match(loginScreen, /<TextLink onClick=\{onRecovery\}>Forgot password\?<\/TextLink>/);
  assert.equal(app.match(/Forgot password\?/g)?.length, 1);
  assert.doesNotMatch(app, /className="back-button"[^>]*>Forgot password\?/);
});

test("recovery uses an exclusive recovery-method selector and styled channel control", async () => {
  const app = await source("../src/App.jsx");
  const ui = await source("../src/ui.jsx");
  const styles = await source("../src/credentialUi.css");

  assert.match(app, /<RadioCards legend="Recovery method"/);
  assert.match(app, /label: "Email or SMS"/);
  assert.match(app, /label: "Doctor offline code"/);
  assert.match(app, /doctorRecovery && <RadioCards legend="Recovery method"/);
  assert.match(app, /<RecoveryFlow role=\{role\}/);
  assert.match(app, /<SelectField label="Recovery channel"/);
  assert.match(ui, /export function RadioCards/);
  assert.match(ui, /export function SelectField/);
  assert.match(styles, /\.radio-card \{/);
});

test("verification and password forms expose correction, resend, guidance, and reveal controls", async () => {
  const app = await source("../src/App.jsx");
  const credentials = await source("../src/credentialUi.jsx");

  assert.match(app, /\/api\/staff\/verification-contact\//);
  assert.match(app, /Resend code in \$\{countdown\.seconds\}s/);
  assert.match(app, /<TextLink onClick=\{onSignOut\}>Sign out<\/TextLink>/);
  assert.match(credentials, /export function PasswordPair/);
  assert.match(credentials, /At least 8 characters/);
  assert.match(credentials, /Not entirely numeric/);
  assert.match(credentials, /Additional common-password checks run when submitted/);
  assert.match(app, /verificationCodeComplete/);
  assert.match(app, /\/api\/staff\/verification-state\//);
  assert.match(credentials, /aria-label=\{`\$\{visible \? "Hide" : "Show"\}/);
});

test("pending account contact replacement can be restored, edited, or explicitly cancelled", async () => {
  const account = await source("../src/AccountSettings.jsx");

  assert.match(account, /\/api\/staff\/verification-state\//);
  assert.match(account, /\/change\/cancel\//);
  assert.match(account, />Cancel replacement</);
  assert.match(account, />Edit new \{contact\.kind\}</);
  assert.match(account, /verificationCodeComplete\(contact\.code\)/);
  assert.match(account, /passwordValid/);
});

test("mobile authentication replaces the oversized hero with a compact titled header", async () => {
  const styles = await source("../src/styles.css");
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*?\.auth-intro \{ min-height: 128px;[^}]*flex-direction: row;/);
  assert.match(styles, /\.auth-intro > div \{ display: block; min-width: 0; text-align: right; \}/);
  assert.match(styles, /\.auth-intro h1 \{ max-width: 300px; margin: 0; font-size: clamp\(20px, 4vw, 28px\)/);
  assert.match(styles, /\.auth-panel \{ min-height: 0;/);
});

test("workspace actions use one account menu while the workspace switch remains direct", async () => {
  const workspace = await source("../src/PatientWorkspaceView.jsx");
  const styles = await source("../src/styles.css");
  const panel = workspace.indexOf("workspace-account-menu__panel");

  assert.ok(panel >= 0);
  assert.ok(workspace.indexOf("workspace-switch-button") >= 0);
  assert.ok(workspace.indexOf("onSwitchClinic()", panel) > panel);
  assert.ok(workspace.indexOf("<AccountSettings", panel) > panel);
  assert.ok(workspace.indexOf("<ClinicTeam", panel) > panel);
  assert.ok(workspace.indexOf("<TrustedDevices", panel) > panel);
  assert.ok(workspace.indexOf("onSignOut()", panel) > panel);
  assert.doesNotMatch(workspace, /user-menu--desktop|workspace-mobile-menu/);
  assert.match(styles, /@media \(max-width: 1200px\)[\s\S]*?\.workspace-header__context \{ display: none; \}/);
});

test("Phase 8 account and recovery surfaces avoid native unstyled selects", async () => {
  const app = await source("../src/App.jsx");
  const account = await source("../src/AccountSettings.jsx");
  const team = await source("../src/ClinicTeam.jsx");
  const ui = await source("../src/ui.jsx");

  assert.doesNotMatch(app, /<select\b/);
  assert.doesNotMatch(account, /<select\b/);
  assert.doesNotMatch(team, /<select\b/);
  assert.match(ui, /export function Button/);
  assert.match(ui, /export function TextLink/);
});

test("Assistant clinic onboarding always exposes account and sign-out escapes", async () => {
  const app = await source("../src/App.jsx");
  const joinForm = app.slice(
    app.indexOf("function AssistantJoinForm"),
    app.indexOf("function ClinicPicker"),
  );

  assert.match(joinForm, /submitting\.current/);
  assert.match(joinForm, />Back to account<\/TextLink>/);
  assert.match(joinForm, />Sign out<\/TextLink>/);
  assert.match(joinForm, /additional && <TextLink onClick=\{onClinics\}>Your clinics<\/TextLink>/);
  assert.match(app, /onAccount=\{\(\) => openAccountSettings\("join-clinic"\)\}/);
  assert.match(app, /onBack=\{closeAccountSettings\}/);
});

test("first-Doctor clinic onboarding has safe exits and app-owned browser history", async () => {
  const app = await source("../src/App.jsx");
  const createForm = app.slice(
    app.indexOf("function ClinicCreateForm"),
    app.indexOf("function AssistantJoinForm"),
  );

  assert.match(createForm, />Back to account<\/TextLink>/);
  assert.match(createForm, />Sign out<\/TextLink>/);
  assert.match(app, /primeFirstClinicHistory\(clinicScreen\)/);
  assert.match(app, /onboardingHistoryScreen\(event\.state\)/);
  assert.match(app, /onAccount=\{!user\.memberships\?\.length \? \(\) => openAccountSettings\("create-clinic"\)/);
});

test("onboarding navigation links wrap with distinct touch targets", async () => {
  const styles = await source("../src/styles.css");

  assert.match(styles, /\.auth-form-links \{ display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px;/);
  assert.match(styles, /\.auth-form-links \.text-link \{ min-height: var\(--control-height-standard\);/);
});

test("Assistant setup codes expose one-time plaintext, status, copy, and confirmed replacement", async () => {
  const team = await source("../src/ClinicTeam.jsx");

  assert.doesNotMatch(team, /DEMO_MODE/);
  assert.match(team, /apiRequest\("\/api\/clinic\/assistant\/setup\/", \{ staffToken \}\)/);
  assert.match(team, /Copy setup code/);
  assert.match(team, /This code is shown once and expires at/);
  assert.match(team, /An active setup code exists and expires at/);
  assert.match(team, /Replace setup code/);
  assert.match(team, /immediately deactivates their membership in this clinic/);
  assert.match(team, /immediately invalidates the current unclaimed code/);
  assert.match(team, /Confirm replacement/);
});
