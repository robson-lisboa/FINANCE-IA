import test from "node:test";
import assert from "node:assert/strict";
import { classifyStatementMovement, isStatementSummaryLine, extractBankAccountSummary, normalizeStatementDescription, isPotentialTransferMovement, buildStatementTransactionKey } from "../src/lib/statement-parser.js";

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
  assert.equal(isStatementSummaryLine("IOF sobre operação 2,40"), false);
  assert.equal(isStatementSummaryLine("Encargos por atraso 12,00"), false);
  assert.equal(isStatementSummaryLine("Total de encargos 12,00"), true);
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

test("normalizes descriptions consistently for duplicate checks", () => {
  assert.equal(normalizeStatementDescription("  PÃO & Café  "), "pao cafe");
  assert.equal(normalizeStatementDescription("Pao cafe"), "pao cafe");
  assert.equal(buildStatementTransactionKey({ title: "PÃO & Café", date: "2026-08-10", amount: 12.5, type: "expense" }), buildStatementTransactionKey({ title: "Pao cafe", date: "2026-08-10", amount: 12.5, type: "expense" }));
});

test("flags PIX and bank transfers for manual review", () => {
  assert.equal(isPotentialTransferMovement("PIX recebido Robson 400,00"), true);
  assert.equal(isPotentialTransferMovement("Transferência entre contas 150,00"), true);
  assert.equal(isPotentialTransferMovement("Compra supermercado 85,00"), false);
});

test("filters duplicates against existing data and within the same import", async () => {
  const { filterNewStatementRows } = await import("../src/lib/statement-parser.js");
  const existing = [{ title: "Pao cafe", date: "2026-08-10", amount: 12.5, type: "expense" }];
  const incoming = [
    { title: "PÃO & CAFÉ", date: "2026-08-10", amount: 12.5, type: "expense", category: "Alimentação" },
    { title: "Farmácia", date: "2026-08-11", amount: 32, type: "expense", category: "Saúde" },
    { title: "Farmacia", date: "2026-08-11", amount: 32, type: "expense", category: "Saúde" }
  ];
  const result = filterNewStatementRows(incoming, existing);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Farmácia");
});
