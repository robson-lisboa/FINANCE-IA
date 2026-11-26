const normalize = value => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");

export function classifyStatementMovement(line, amountEndIndex) {
  const before = line.slice(0, amountEndIndex);
  const after = line.slice(amountEndIndex);
  const normalized = normalize(line);
  if (/\\s*-$/.test(after) || /-\\s*$/.test(before) || /(?:^|\\s)D(?:EBITO|ÉBITO)?(?:\\s|$)/i.test(after)) return "expense";
  if (/\\s*\\+$/.test(after) || /\\+\\s*$/.test(before) || /(?:^|\\s)C(?:REDITO|CRÉDITO)(?:\\s|$)/i.test(after)) return "income";
  if (/\\b(salario|proventos|recebido|recebimento|deposito recebido|pix recebido|transferencia recebida|estorno|reembolso|cashback|rendimento|credito)\\b/.test(normalized)) return "income";
  if (/\\b(pix enviado|transferencia enviada|pagamento|compra|debito|saque|tarifa|boleto pago|conta paga)\\b/.test(normalized)) return "expense";
  return "expense";
}

export function isStatementSummaryLine(line) {
  return /\\b(total da fatura|valor total da fatura|total a pagar|valor total a pagar|total de compras|saldo anterior|saldo em aberto|saldo final|saldo inicial|saldo do dia|saldo atual|limite total|limite disponivel|limite utilizado|encargos|iof|anuidade|resumo da fatura|vencimento|total de creditos|total de debitos|total do dia|subtotal)\\b/i.test(normalize(line));
}
