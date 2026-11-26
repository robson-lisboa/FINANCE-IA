import test from "node:test";
import assert from "node:assert/strict";
import { classifyStatementMovement, isStatementSummaryLine, extractBankAccountSummary } from "../src/lib/statement-parser.js";

test("classifies Brazilian statement credit and debit markers after amount", () => {
  assert.equal(classifyStatementMovement("PIX recebido 400,00 +", "PIX recebido 400,00".length), "income");
  assert.equal(classifyStatementMovement("Compra mercado 25,16-", "Compra mercado 25,16".length), "expense");
});

test("recognizes income and outgoing movement descriptions", () => {
  assert.equal(classifyStatementMovement("Salário empresa 1.939,40", "Salário empresa 1.939,40".length), "income");
  assert.equal(classifyStatementMovement("PIX enviado João 80,00", "PIX enviado João 80,00".length), "expense");
  assert.equal(classifyStatementMovement("Pagamento boleto 120,00", "Pagamento boleto 120,00".length), "expense");
});

test("filters consolidated totals and balances, not individual operations", () => {
  assert.equal(isStatementSummaryLine("Saldo final 0,05"), true);
  assert.equal(isStatementSummaryLine("Total de créditos 2.426,40"), true);
  assert.equal(isStatementSummaryLine("PIX recebido Maria 400,00"), false);
});

test("reconciles a bank statement using opening balance, credits, debits and closing balance", () => {
  const summary = extractBankAccountSummary(`
    Saldo de Conta Corrente em 31/07 0,42
    Total de Créditos 2.426,40
    Total de Débitos 2.426,77
    Saldo de Conta Corrente em 31/08 0,05
  `);
  assert.deepEqual(summary, {
    openingBalance: 0.42,
    credits: 2426.4,
    debits: 2426.77,
    closingBalance: 0.05,
    expectedClosing: 0.05,
    difference: 0
  });
});
