import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, normalizeSettings, readSettings } from "../src/lib/preferences.js";

test("loads default preferences safely", () => {
  assert.deepEqual(readSettings(null), normalizeSettings(DEFAULT_SETTINGS));
  assert.deepEqual(readSettings("{invalid"), normalizeSettings(DEFAULT_SETTINGS));
});

test("preserves valid customization options", () => {
  const value = readSettings(JSON.stringify({
    theme: "light", accent: "blue", customAccent: "#12aBcD",
    currency: "EUR", density: "compact", fontScale: "large",
    widgets: { stats: false, chart: true, advisor: false, transactions: true, categories: false }
  }));
  assert.equal(value.theme, "light");
  assert.equal(value.customAccent, "#12aBcD");
  assert.equal(value.currency, "EUR");
  assert.equal(value.density, "compact");
  assert.equal(value.fontScale, "large");
  assert.equal(value.widgets.stats, false);
  assert.equal(value.widgets.advisor, false);
});

test("rejects invalid values and keeps safe defaults", () => {
  const value = normalizeSettings({
    theme: "neon", accent: "unknown", customAccent: "red",
    currency: "BTC", density: "tiny", fontScale: "huge",
    widgets: { stats: "false", chart: false }
  });
  assert.equal(value.theme, "dark");
  assert.equal(value.accent, "purple");
  assert.equal(value.customAccent, "");
  assert.equal(value.currency, "BRL");
  assert.equal(value.density, "comfortable");
  assert.equal(value.fontScale, "normal");
  assert.equal(value.widgets.stats, true);
  assert.equal(value.widgets.chart, false);
});
