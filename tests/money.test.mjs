import test from "node:test";
import assert from "node:assert/strict";
import { parseBrazilianMoney } from "../src/lib/money-core.js";

test("parses common Brazilian currency formats", () => {
  assert.equal(parseBrazilianMoney("1500"), 1500);
  assert.equal(parseBrazilianMoney("1.500,00"), 1500);
  assert.equal(parseBrazilianMoney("R$ 1.500,75"), 1500.75);
  assert.equal(parseBrazilianMoney("1.234.567,89"), 1234567.89);
  assert.equal(parseBrazilianMoney("1,5"), 1.5);
});

test("accepts decimal-dot input and thousands-dot input", () => {
  assert.equal(parseBrazilianMoney("1500.75"), 1500.75);
  assert.equal(parseBrazilianMoney("1.500"), 1500);
});

test("rejects empty and malformed values", () => {
  assert.equal(parseBrazilianMoney(""), null);
  assert.equal(parseBrazilianMoney("   "), null);
  assert.equal(parseBrazilianMoney("abc"), null);
  assert.equal(parseBrazilianMoney("1,2,3"), null);
});
