import { useMemo, useState } from "react";
import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import { FileUp, LoaderCircle, X, CheckCircle2, AlertTriangle, Trash2, Pencil } from "lucide-react";
import { classifyStatementMovement, isStatementSummaryLine, extractBankAccountSummary } from "./lib/statement-parser.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

type InvoiceRow = { title: string; date: string; amount: number; category: string; type: "income" | "expense" };
type ExistingTransaction = { title: string; date: string; amount: number; type: "income" | "expense" };
type Props = { onClose: () => void; onImport: (rows: InvoiceRow[]) => Promise<void>; transactions: ExistingTransaction[] };

const CATEGORIES = ["Alimentação", "Moradia", "Transporte", "Saúde", "Educação", "Lazer", "Serviços", "Outros"];

const categoryFor = (text: string) => {
  const value = text.toLowerCase();
  if (/mercado|supermercado|padaria|hortifruti|açougue|ifood|restaurante|lanchonete/.test(value)) return "Alimentação";
  if (/uber|99\s|posto|combust|estacionamento|pedágio|shell|ipiranga/.test(value)) return "Transporte";
  if (/farm|drog|hospital|clínica|consulta|laboratório/.test(value)) return "Saúde";
  if (/netflix|spotify|amazon prime|disney|cinema|steam/.test(value)) return "Lazer";
  if (/energia|água|sabesp|internet|telefone|aluguel|condomínio/.test(value)) return "Moradia";
  if (/escola|curso|livraria|faculdade/.test(value)) return "Educação";
  return "Outros";
};

const MONTHS: Record<string, number> = { janeiro:1, jan:1, fevereiro:2, fev:2, marco:3, mar:3, abril:4, abr:4, maio:5, mai:5, junho:6, jun:6, julho:7, jul:7, agosto:8, ago:8, setembro:9, set:9, outubro:10, out:10, novembro:11, nov:11, dezembro:12, dez:12 };

function detectInvoiceReferenceDate(text: string): Date | null {
  const normalized = text.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const monthPattern = "(janeiro|jan|fevereiro|fev|marco|mar|abril|abr|maio|mai|junho|jun|julho|jul|agosto|ago|setembro|set|outubro|out|novembro|nov|dezembro|dez)";
  const textual = normalized.match(new RegExp("(?:fatura|referencia|mes de)\\s*(?:de\\s*)?" + monthPattern + "\\s*(?:de|/)\\s*(20\\d{2})", "i"));
  if (textual) return new Date(Number(textual[2]), MONTHS[textual[1]] - 1, 15);
  const labeledDate = normalized.match(/(?:vencimento|vence em|fechamento|fecha em|data de vencimento)[^\d]{0,24}(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/i);
  if (labeledDate) {
    const day = Number(labeledDate[1]), month = Number(labeledDate[2]);
    const yearText = labeledDate[3], year = yearText ? (yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText)) : new Date().getFullYear();
    const date = new Date(year, month - 1, day);
    if (date.getMonth() === month - 1 && date.getDate() === day) return date;
  }
  return null;
}

function parseBrazilianDate(value: string, referenceDate: Date | null): string | null {
  const match = value.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
  if (!match) return null;
  const day = Number(match[1]), month = Number(match[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const explicitYear = match[3];
  let year: number;
  if (explicitYear) year = explicitYear.length === 2 ? 2000 + Number(explicitYear) : Number(explicitYear);
  else if (referenceDate) {
    const candidates = [referenceDate.getFullYear()-1, referenceDate.getFullYear(), referenceDate.getFullYear()+1]
      .map(y => new Date(y, month-1, day)).filter(d => d.getMonth() === month-1 && d.getDate() === day);
    candidates.sort((a,b) => Math.abs(a.getTime()-referenceDate.getTime()) - Math.abs(b.getTime()-referenceDate.getTime()));
    if (!candidates.length) return null;
    year = candidates[0].getFullYear();
  } else year = new Date().getFullYear();
  const date = new Date(year, month-1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month-1 || date.getDate() !== day) return null;
  return year + "-" + String(month).padStart(2,"0") + "-" + String(day).padStart(2,"0");
}

function extractStatementTotal(text: string): number | null {
  const labels = /^(?:total da fatura|valor total da fatura|total a pagar|valor total a pagar|total desta fatura|total do demonstrativo|valor da fatura|pagamento minimo|valor para pagamento)\b/i;
  for (const line of text.replace(/[\u00a0]/g, " ").split(/[\r\n]+/).map(value => value.trim())) {
    if (!labels.test(line)) continue;
    const values = [...line.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\b/g)];
    if (!values.length) continue;
    const amount = Number(values[values.length - 1][1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(amount) && amount >= 0 && amount <= 10000000) return amount;
  }
  return null;
}


function isBankStatementSummary(text: string): boolean {
  const normalized = text.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const signals = [
    /saldo de conta corrente/,
    /total de creditos/,
    /total de debitos/,
    /saldo em \d{1,2}\/\d{1,2}/,
    /depositos\s*\/\s*transferencias/,
    /salario e proventos/
  ];
  return signals.filter(pattern => pattern.test(normalized)).length >= 3;
}

function parseRows(text: string): InvoiceRow[] {
  const lines = text.replace(/[\u00a0]/g, " ").split(/[\r\n]+/).map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const referenceDate = detectInvoiceReferenceDate(text);
  const rows: InvoiceRow[] = [], seen = new Set<string>();
  for (const line of lines) {
    if (isStatementSummaryLine(line)) continue;
    const date = parseBrazilianDate(line, referenceDate);
    if (!date) continue;
    const amountMatches = [...line.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g)];
    if (!amountMatches.length) continue;
    const match = amountMatches[amountMatches.length - 1];
    const amount = Number(match[1].replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) continue;
    const amountEndIndex = (match.index ?? 0) + match[0].length;
    const type = classifyStatementMovement(line, amountEndIndex);
    const title = line.replace(/\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/, "").replace(/(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}/g, "").replace(/\s+/g, " ").trim().replace(/\s+(?:C|D|CRÉDITO|CREDITO|DÉBITO|DEBITO)\s*$/i, "").replace(/[+-]$/, "").replace(/^[\-–|:]+|[\-–|:]+$/g, "");
    if (title.length < 3 || /cartão|fatura|titular|você pagou|compras nacionais/i.test(title)) continue;
    const key = [type, title.toLowerCase(), date, amount.toFixed(2)].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ title: title.slice(0, 100), date, amount, category: categoryFor(title), type });
  }
  return rows;
}

async function extractFile(file: File, setProgress: (value: string) => void): Promise<string> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const chunks: string[] = [];
    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
    try {
      const pageLimit = Math.min(pdf.numPages, 20);
      for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber++) {
        setProgress("Lendo página " + pageNumber + " de " + pageLimit + "...");
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        // Preserva as linhas do PDF para não misturar datas e valores de compras diferentes.
        const textLines = new Map<number, string[]>();
        for (const item of content.items) {
          if (!("str" in item) || !item.str.trim()) continue;
          const y = Math.round(item.transform[5] / 2) * 2;
          const line = textLines.get(y) || [];
          line.push(item.str.trim());
          textLines.set(y, line);
        }
        const pageText = [...textLines.entries()]
          .sort((a, b) => b[0] - a[0])
          .map(([, parts]) => parts.join(" "))
          .join("\n");
        if (pageText.trim().length > 40) {
          chunks.push(pageText);
          continue;
        }
        if (!worker) worker = await createWorker("por");
        const viewport = page.getViewport({ scale: 1.8 });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) continue;
        await page.render({ canvasContext: context, viewport, canvas } as Parameters<typeof page.render>[0]).promise;
        const result = await worker.recognize(canvas);
        chunks.push(result.data.text);
        canvas.width = 0;
        canvas.height = 0;
      }
      if (pdf.numPages > pageLimit) setProgress("Foram analisadas as primeiras 20 páginas do arquivo.");
    } finally {
      if (worker) await worker.terminate();
    }
    return chunks.join("\n");
  }
  if (!file.type.startsWith("image/")) throw new Error("Envie uma fatura em PDF, JPG, PNG ou WEBP.");
  const worker = await createWorker("por");
  try {
    setProgress("Reconhecendo texto da imagem...");
    const result = await worker.recognize(file);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}

export default function InvoiceImporter({ onClose, onImport, transactions }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [detectedPeriod, setDetectedPeriod] = useState("");
  const [statementTotal, setStatementTotal] = useState<number | null>(null);
  const [showItems, setShowItems] = useState(false);
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  const [documentNotice, setDocumentNotice] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [accountSummary, setAccountSummary] = useState<ReturnType<typeof extractBankAccountSummary>>(null);

  const total = useMemo(() => rows.filter(row => row.type === "expense").reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0), [rows]);
  const incomeTotal = useMemo(() => rows.filter(row => row.type === "income").reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0), [rows]);
  const validation = useMemo(() => {
    const issues: string[] = [];
    if (rows.length === 0) issues.push("Nenhuma movimentação válida foi identificada.");
    if (rows.some(row => !row.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(row.amount) || row.amount <= 0)) issues.push("Há lançamento com descrição, data ou valor inválido.");
    const amounts = rows.map(row => row.amount).filter(value => Number.isFinite(value) && value > 0);
    if (amounts.some(value => value > 5000)) issues.push("Foi encontrado lançamento acima de R$ 5.000. Confira se o OCR confundiu um número ou um valor de referência com uma movimentação.");
    if (statementTotal !== null && statementTotal > 0 && total > statementTotal * 1.5) issues.push("A soma das despesas reconhecidas está mais de 50% acima do total de referência. A importação exige conferência manual dos valores.");
    if (statementTotal !== null && statementTotal > 0 && total < statementTotal * 0.5) issues.push("A soma das despesas reconhecidas está muito abaixo do total de referência. Podem faltar compras ou existir saldo anterior/encargos.");
    const repeatedKeys = new Set<string>();
    const seenKeys = new Set<string>();
    for (const row of rows) {
      const key = [row.type, row.title.toLocaleLowerCase("pt-BR").trim(), row.date, row.amount.toFixed(2)].join("|");
      if (seenKeys.has(key)) repeatedKeys.add(key);
      seenKeys.add(key);
    }
    if (repeatedKeys.size) issues.push("Existem movimentações idênticas repetidas. Confira se são duplicidades ou compras realmente distintas.");
    if (statementTotal === null) issues.push("Não foi possível localizar com segurança um total de referência no documento. Confira os valores diretamente no extrato ou na fatura.");
    return issues;
  }, [rows, statementTotal, total]);
  const audit = useMemo(() => {
    const normalize = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    const existing = transactions.filter(item => item.type === "expense");
    const exactMatches = rows.filter(row => existing.some(item => item.type === row.type && normalize(item.title) === normalize(row.title) && item.date === row.date && Math.abs(Number(item.amount) - row.amount) < 0.01));
    const duplicateMap = new Map<string, InvoiceRow[]>();
    rows.forEach(row => {
      const key = [row.type, normalize(row.title), row.amount.toFixed(2)].join("|");
      duplicateMap.set(key, [...(duplicateMap.get(key) || []), row]);
    });
    const repeated = [...duplicateMap.values()].filter(group => group.length > 1);
    const installmentRows = rows.filter(row => /parc|parcela|\d{1,2}\s*\/\s*\d{1,2}/i.test(row.title));
    const totalAlreadyRegistered = exactMatches.reduce((sum, row) => sum + row.amount, 0);
    return { exactMatches, repeated, installmentRows, totalAlreadyRegistered };
  }, [rows, transactions]);

  const updateRow = (index: number, changes: Partial<InvoiceRow>) => {
    setRows(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...changes } : row));
  };

  const analyzeText = async (text: string) => {
    setBusy(true); setError(""); setRows([]); setReviewAcknowledged(false); setStatementTotal(null); setAccountSummary(extractBankAccountSummary(text)); setDocumentNotice(""); setProgress("Analisando movimentações...");
    try {
      if (isBankStatementSummary(text)) {
        setDocumentNotice("Este conteúdo parece ser um resumo consolidado de conta bancária, não uma lista de transações. Créditos, débitos e saldos agrupados não serão convertidos em lançamentos individuais. Cole o extrato detalhado, com data, descrição e valor de cada operação.");
        setProgress("");
        return;
      }
      const referenceDate = detectInvoiceReferenceDate(text);
      const parsed = parseRows(text);
      setStatementTotal(extractStatementTotal(text));
      setShowItems(false);
      if (!parsed.length) throw new Error("Não encontrei movimentações com data e valor reconhecíveis. Confira se o texto contém as linhas detalhadas do extrato ou da fatura.");
      setDetectedPeriod(referenceDate ? referenceDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "");
      setRows(parsed);
      setProgress("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível analisar o texto.");
    } finally { setBusy(false); }
  };

  const analyze = async () => {
    if (!file) return;
    setBusy(true); setError(""); setRows([]); setReviewAcknowledged(false); setStatementTotal(null); setDocumentNotice(""); setProgress("Preparando leitura...");
    try { const text = await extractFile(file, setProgress); await analyzeText(text); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível ler o documento."); setBusy(false); }
  };

  const analyzePastedText = () => {
    if (pastedText.trim().length < 20) { setError("Cole o texto do extrato ou da fatura antes de analisar."); return; }
    void analyzeText(pastedText);
  };

  const confirmImport = async () => {
    if (!rows.length || rows.some(row => !row.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(row.amount) || row.amount <= 0)) {
      setError("Revise os campos: descrição, data e valor precisam estar válidos.");
      return;
    }
    if (!reviewAcknowledged) { setError("Antes de importar, confira os valores e marque a confirmação de revisão."); return; }
    if (validation.some(issue => issue.includes("acima de R$ 5.000") || issue.includes("mais de 50% acima"))) { setError("Importação bloqueada: a soma ou algum lançamento está muito acima do esperado. Corrija os valores ou descarte a leitura."); return; }
    setBusy(true); setError("");
    try { await onImport(rows); setDone(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao importar os lançamentos."); }
    finally { setBusy(false); }
  };

  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <section className="modal invoice-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-title">
      <div className="modal-heading">
        <div><span className="eyebrow">IMPORTAÇÃO INTELIGENTE</span><h2 id="invoice-title">Importar extrato ou fatura</h2></div>
        <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="Fechar"><X size={19}/></button>
      </div>
      {done ? <div className="invoice-success"><CheckCircle2 size={32}/><strong>Movimentações importadas!</strong><p>As receitas e despesas revisadas foram adicionadas à sua conta.</p><button className="primary-btn" onClick={onClose}>Concluir</button></div> : <>
        <p className="muted-text">Envie um PDF ou imagem, ou cole o texto do extrato/fatura. A leitura de arquivos é feita no navegador; o documento não é enviado para um serviço externo de OCR.</p>
        <div className="invoice-audit">
          <div className="invoice-audit-heading"><strong>Ou cole o texto do extrato</strong></div>
          <p className="muted-text">Não consegue anexar o PDF? Abra o extrato no banco, copie o texto e cole aqui. Você pode enviar em partes.</p>
          <textarea value={pastedText} onChange={event => { setPastedText(event.target.value); setError(""); }} rows={6} maxLength={100000} placeholder="Cole aqui as movimentações, com datas, descrições e valores..." disabled={busy} />
          <button type="button" className="outline-btn invoice-action" onClick={analyzePastedText} disabled={busy || pastedText.trim().length < 20}>{busy ? "Analisando..." : "Analisar texto colado"}</button>
        </div>
        <label className="invoice-drop">
          <FileUp size={28}/>
          <strong>{file ? file.name : "Selecionar extrato ou fatura"}</strong>
          <span>PDF, JPG, PNG ou WEBP · até 15 MB</span>
          <input type="file" accept=".pdf,image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { setFile(e.target.files?.[0] || null); setRows([]); setError(""); setProgress(""); }} />
        </label>
        {!rows.length && <button className="primary-btn invoice-action" disabled={!file || busy || (file?.size || 0) > 15 * 1024 * 1024} onClick={() => void analyze()}>{busy ? <><LoaderCircle className="spin" size={16}/> {progress || "Analisando..."}</> : "Analisar documento"}</button>}
        {file && file.size > 15 * 1024 * 1024 && <p className="invoice-error">O arquivo ultrapassa o limite de 15 MB.</p>}
        {error && <p className="invoice-error"><AlertTriangle size={15}/> {error}</p>}\n        {accountSummary && <section className="invoice-audit" aria-label="Conciliação do extrato bancário">
          <div className="invoice-audit-heading"><span className="eyebrow">CONCILIAÇÃO BANCÁRIA</span><strong>Conferência dos saldos</strong></div>
          <div className="invoice-audit-grid">
            <div><strong>{accountSummary.openingBalance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong><span>Saldo inicial</span></div>
            <div><strong>{accountSummary.credits.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong><span>Total de créditos</span></div>
            <div><strong>{accountSummary.debits.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong><span>Total de débitos</span></div>
            <div><strong>{accountSummary.closingBalance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong><span>Saldo final informado</span></div>
          </div>
          <p className={Math.abs(accountSummary.difference) < 0.01 ? "invoice-audit-ok" : "invoice-audit-warning"}>
            {Math.abs(accountSummary.difference) < 0.01 ? <CheckCircle2 size={15}/> : <AlertTriangle size={15}/>}
            Saldo final calculado: <strong>{accountSummary.expectedClosing.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>.
            {Math.abs(accountSummary.difference) < 0.01 ? " Os valores conferem." : " Diferença encontrada: " + accountSummary.difference.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) + ". Confira o documento original."}
          </p>
          <p className="invoice-audit-disclaimer">Os saldos são usados somente para conferência; não são importados como receitas ou despesas.</p>
        </section>}
        {documentNotice && <div className="invoice-audit invoice-audit-warning" role="status"><strong><AlertTriangle size={16}/> Extrato bancário identificado</strong><p>{documentNotice}</p><p>Para conciliar corretamente, copie ou exporte a tabela detalhada de movimentações. O saldo inicial e o saldo final entram apenas na conferência, nunca como receita ou despesa.</p></div>}
        {rows.length > 0 && <div className="invoice-review">
          <div className="invoice-review-head"><strong>{rows.length} movimentação(ões) reconhecida(s)</strong><span>Revise ou corrija antes de importar</span></div>
          {detectedPeriod && <p className="invoice-period-detected"><CheckCircle2 size={15}/> Período identificado: <strong>{detectedPeriod}</strong>. Datas sem ano foram ajustadas com base nesse período.</p>}
          {statementTotal !== null && <div className="invoice-statement-total"><span>Total informado no documento</span><strong>{statementTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></div>}
          <button type="button" className="invoice-total-preview" aria-expanded={showItems} onClick={() => setShowItems(value => !value)}>
            <span><strong>Despesas identificadas</strong><small>{showItems ? "Toque para ocultar os lançamentos" : "Toque para ver todos os lançamentos"}</small></span>
            <strong>{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} <span aria-hidden="true">{showItems ? "−" : "+"}</span></strong>
          </button>
          {incomeTotal > 0 && <p className="invoice-reconciliation">Receitas identificadas: <strong>{incomeTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>. Despesas identificadas: <strong>{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>.</p> }
          {statementTotal !== null && <p className="invoice-reconciliation">Diferença entre o total informado no documento e as despesas reconhecidas: <strong>{(statementTotal-total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong>. A diferença pode incluir saldo anterior, pagamentos, créditos, juros ou itens que a leitura não reconheceu.</p>}
          <section className="invoice-audit" aria-label="Validação de segurança do documento">
            <div className="invoice-audit-heading"><span className="eyebrow">REGRAS DE CONFERÊNCIA</span><strong>Verificações antes de importar</strong></div>
            {validation.length > 0
              ? <ul className="invoice-audit-warning">{validation.map((issue, index) => <li key={index}>{issue}</li>)}</ul>
              : <p className="invoice-audit-ok"><CheckCircle2 size={15}/> Nenhuma inconsistência básica detectada. Mesmo assim, confira o documento original.</p>}
            <label className="invoice-review-confirm"><input type="checkbox" checked={reviewAcknowledged} onChange={event => setReviewAcknowledged(event.target.checked)} /> Conferi os valores e os tipos de todas as movimentações no documento original.</label>
          </section>
          <section className="invoice-audit" aria-label="Auditoria das movimentações">
            <div className="invoice-audit-heading"><span className="eyebrow">AUDITORIA AUTOMÁTICA</span><strong>O que encontrei neste documento</strong></div>
            <div className="invoice-audit-grid">
              <div><strong>{audit.exactMatches.length}</strong><span>já cadastrada(s)</span></div>
              <div><strong>{audit.repeated.length}</strong><span>possível(is) repetição(ões)</span></div>
              <div><strong>{audit.installmentRows.length}</strong><span>descrição(ões) com parcela</span></div>
            </div>
            {audit.exactMatches.length > 0 && <p className="invoice-audit-warning"><AlertTriangle size={15}/> {audit.exactMatches.length} lançamento(s) coincidem com registros existentes, somando {audit.totalAlreadyRegistered.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Eles serão ignorados na importação.</p>}
            {audit.repeated.length > 0 && <p className="invoice-audit-warning"><AlertTriangle size={15}/> Uma descrição com o mesmo valor aparece mais de uma vez em datas diferentes. Pode ser recorrência normal; confira o histórico.</p>}
            {audit.installmentRows.length > 0 && <p className="invoice-audit-note">Encontramos indicações de parcelamento em algumas descrições. Confirme se o valor lido é o valor da parcela, não o valor total da compra.</p>}
            {audit.exactMatches.length === 0 && audit.repeated.length === 0 && audit.installmentRows.length === 0 && <p className="invoice-audit-ok"><CheckCircle2 size={15}/> Nenhuma coincidência exata ou indicação de parcela encontrada nos critérios automáticos.</p>}
            <p className="invoice-audit-disclaimer">A auditoria compara descrição, data e valor com seus lançamentos. Uma coincidência é um alerta para revisão, não prova de cobrança indevida.</p>
          </section>
          {showItems && <div className="invoice-rows">{rows.map((row, index) => <div className="invoice-row invoice-row-editable" key={index}>
            <div className="invoice-row-fields">
              <label>Descrição<input value={row.title} maxLength={100} onChange={e => updateRow(index, { title: e.target.value })}/></label>
              <div className="invoice-row-subfields">
                <label>Data<input type="date" value={row.date} onChange={e => updateRow(index, { date: e.target.value })}/></label>
                <label>Valor (R$)<input inputMode="decimal" value={String(row.amount).replace(".", ",")} onChange={e => { const parsed = Number(e.target.value.replace(",", ".")); updateRow(index, { amount: e.target.value.trim() === "" ? 0 : parsed }); }}/></label>
                <label>Tipo<select value={row.type} onChange={e => updateRow(index, { type: e.target.value as "income" | "expense" })}><option value="expense">Despesa</option><option value="income">Receita</option></select></label>
                <label>Categoria<select value={row.category} onChange={e => updateRow(index, { category: e.target.value })}>{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
              </div>
            </div>
            <button type="button" className="icon-btn invoice-remove" title="Remover movimentação" aria-label={"Remover " + row.title} onClick={() => setRows(current => current.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={16}/></button>
          </div>)}</div>
          }
          <button className="primary-btn invoice-action" disabled={busy || !rows.length || !reviewAcknowledged || validation.some(issue => issue.includes("acima de R$ 5.000") || issue.includes("mais de 50% acima"))} onClick={() => void confirmImport()}>{busy ? "Salvando..." : "Confirmar e importar " + rows.length + " movimentação(ões)"}</button>
          <button type="button" className="outline-btn invoice-action" disabled={busy} onClick={() => { setRows([]); setError(""); setStatementTotal(null); setReviewAcknowledged(false); }}>Descartar leitura e tentar novamente</button>
        </div>}
        <p className="invoice-footnote">A leitura automática pode errar. Confira todos os lançamentos antes de confirmar. Confira se cada valor corresponde à movimentação efetiva, não a um saldo ou total consolidado.</p>
      </>}
    </section>
  </div>;
}
