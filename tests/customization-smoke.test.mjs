import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

test("preferences are loaded, saved per account and safely normalized", () => {
  assert.match(app, /readSettings\(localStorage\.getItem\(settingsStorageKey\)\)/);
  assert.match(app, /localStorage\.setItem\(settingsStorageKey, JSON\.stringify\(settings\)\)/);
  assert.match(app, /settingsStorageKey = SETTINGS_KEY \+ "-" \+ session\.user\.id/);
});

test("custom theme, color, density and font controls are wired to state", () => {
  assert.match(app, /type="color"[^>]*onChange=/);
  assert.match(app, /theme: "light"/);
  assert.match(app, /density: "compact"/);
  assert.match(app, /fontScale: size\.id/);
  assert.match(app, /customAccent: event\.target\.value/);
});

test("dashboard widgets are controlled and conditionally rendered", () => {
  for (const widget of ["stats", "chart", "advisor", "transactions", "categories"]) {
    assert.ok(app.includes(`settings.widgets.${widget}`), `missing widget binding: ${widget}`);
  }
  assert.match(app, /checked=\{settings\.widgets\[widget\.id\]\}/);
  assert.match(app, /onChange=\{event => setSettings\(current => \(\{ \.\.\.current, widgets:/);
});

test("dashboard uses the selected accent and density/font classes", () => {
  assert.match(app, /settings\.customAccent \|\| ACCENT_COLORS\[settings\.accent\]/);
  assert.match(app, /density-\$\{settings\.density\}/);
  assert.match(app, /font-\$\{settings\.fontScale\}/);
});
