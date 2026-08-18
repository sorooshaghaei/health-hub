import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Forgot password uses a normal text link and never the absolute Back control", async () => {
  const app = await source("../src/App.jsx");
  assert.match(app, /<TextLink onClick=\{onRecovery\}>Forgot password\?<\/TextLink>/);
  assert.doesNotMatch(app, /className="back-button"[^>]*>Forgot password\?/);
});

test("recovery uses reusable stacked checkbox and select controls", async () => {
  const app = await source("../src/App.jsx");
  const ui = await source("../src/ui.jsx");
  const styles = await source("../src/styles.css");

  assert.match(app, /<Checkbox label="Use a Doctor offline recovery code"/);
  assert.match(app, /<SelectField label="Recovery channel"/);
  assert.match(ui, /export function Checkbox/);
  assert.match(ui, /export function SelectField/);
  assert.match(styles, /\.checkbox-field \{[^}]*min-height: 44px/);
});

test("mobile authentication replaces the oversized hero with a compact titled header", async () => {
  const styles = await source("../src/styles.css");
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*?\.auth-intro \{ min-height: 128px;[^}]*flex-direction: row;/);
  assert.match(styles, /\.auth-intro > div \{ display: block; min-width: 0; text-align: right; \}/);
  assert.match(styles, /\.auth-intro h1 \{ max-width: 300px; margin: 0; font-size: clamp\(20px, 4vw, 28px\)/);
  assert.match(styles, /\.auth-panel \{ min-height: 0;/);
});

test("mobile workspace actions are consolidated into one menu including workspace switching", async () => {
  const workspace = await source("../src/PatientWorkspaceView.jsx");
  const styles = await source("../src/styles.css");
  const panel = workspace.indexOf("workspace-mobile-menu__panel");

  assert.ok(panel >= 0);
  assert.ok(workspace.indexOf("onSwitchWorkspace()", panel) > panel);
  assert.ok(workspace.indexOf("<AccountSettings", panel) > panel);
  assert.ok(workspace.indexOf("<ClinicTeam", panel) > panel);
  assert.ok(workspace.indexOf("<TrustedDevices", panel) > panel);
  assert.ok(workspace.indexOf("onSignOut()", panel) > panel);
  assert.match(styles, /\.workspace-header__clinic, \.user-menu--desktop \{ display: none; \}/);
  assert.match(styles, /\.workspace-mobile-menu \{ display: block; \}/);
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
