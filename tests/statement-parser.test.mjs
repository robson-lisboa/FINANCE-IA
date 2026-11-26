import test from "node:test";
import assert from "node:assert/strict";
import { classifyStatementMovement, isStatementSummaryLine } from "../src/lib/statement-parser.js";

test("classifies Brazilian statement credit and debit markers after amount", () => {
  assert.equal(classifyStatementMovement("PIX recebido 400,00 +", 18), "income");
  assert.equal(classifyStatementMovement("Compra mercado 25,16-", 18), "expense");
});

test("recognizes income and outgoing movement descriptions", () => {
  assert.equal(classifyStatementMovement("Salário empresa 1.939,40", 25), "income");
  assert.equal(classifyStatementMovement("PIX enviado João 80,00", 21), "expense");
  assert.equal(classifyStatementMovement("Pagamento boleto 120,00", 22), "expense");
});

test("filters consolidated totals and balances, not individual operations", () => {
  assert.equal(isStatementSummaryLine("Saldo final 0,05"), true);
  assert.equal(isStatementSummaryLine("Total de créditos 2.426,40"), true);
  assert.equal(isStatementSummaryLine("PIX recebido Maria 400,00"), false);
});
