const normalize = value => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function classifyStatementMovement(line, amountEndIndex) {
  const before = line.slice(0, amountEndIndex);
  const after = line.slice(amountEndIndex);
  const normalized = normalize(line);
  if (/\s*-$/.test(after) || /-\s*$/.test(before) || /(?:^|\s)D(?:EBITO|ÉBITO)?(?:\s|$)/i.test(after)) return "expense";
  if (/\s*\+$/.test(after) || /\+\s*$/.test(before) || /(?:^|\s)C(?:REDITO|CRÉDITO)(?:\s|$)/i.test(after)) return "income";
  if (/\b(salario|proventos|recebido|recebimento|deposito recebido|pix recebido|transferencia recebida|estorno|reembolso|cashback|rendimento|credito)\b/.test(normalized)) return "income";
  if (/\b(pix enviado|transferencia enviada|pagamento|compra|debito|saque|tarifa|boleto pago|conta paga)\b/.test(normalized)) return "expense";
  return "expense";
}

export function isStatementSummaryLine(line) {
  return /\b(total da fatura|valor total da fatura|total a pagar|valor total a pagar|total de compras|saldo anterior|saldo em aberto|saldo final|saldo inicial|saldo do dia|saldo atual|limite total|limite disponivel|limite utilizado|encargos|iof|anuidade|resumo da fatura|vencimento|total de creditos|total de debitos|total do dia|subtotal)\b/i.test(normalize(line));
}


function amountFromLine(line) {
  const values = [...line.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g)];
  if (!values.length) return null;
  const amount = Number(values[values.length - 1][1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(amount) ? amount : null;
}

export function extractBankAccountSummary(text) {
  const lines = text.replace(/[\u00a0]/g, " ").split(/[\r\n]+/).map(line => line.trim()).filter(Boolean);
  const normalized = lines.map(line => normalize(line));
  const findAmount = pattern => {
    const index = normalized.findIndex(line => pattern.test(line));
    return index < 0 ? null : amountFromLine(lines[index]);
  };
  const credits = findAmount(/^(?:total de creditos|total creditos)\b/);
  const debits = findAmount(/^(?:total de debitos|total debitos)\b/);
  const balanceRows = lines.map((line, index) => ({ line, index, normalized: normalized[index], amount: amountFromLine(line) }))
    .filter(item => item.amount !== null && /saldo de conta corrente|saldo em \d{1,2}\/\d{1,2}|saldo inicial|saldo final/.test(item.normalized));
  const openingBalance = balanceRows.length ? balanceRows[0].amount : null;
  const closingBalance = balanceRows.length > 1 ? balanceRows[balanceRows.length - 1].amount : null;
  if (credits === null || debits === null || openingBalance === null || closingBalance === null) return null;
  const expectedClosing = openingBalance + credits - debits;
  const difference = Number((closingBalance - expectedClosing).toFixed(2));
  return { openingBalance, credits, debits, closingBalance, expectedClosing: Number(expectedClosing.toFixed(2)), difference };
}
