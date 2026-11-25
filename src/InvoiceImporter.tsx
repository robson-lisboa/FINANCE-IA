import { useMemo, useState } from "react";
import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";
import { FileUp, LoaderCircle, X, CheckCircle2, AlertTriangle, Trash2, Pencil } from "lucide-react";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

type InvoiceRow = { title: string; date: string; amount: number; category: string };
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

function parseBrazilianDate(value: string): string | null {
  const match = value.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const currentYear = new Date().getFullYear();
  const year = match[3] ? (match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3])) : currentYear;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}

function parseRows(text: string): InvoiceRow[] {
  const lines = text
    .replace(/[\u00a0]/g, " ")
    .split(/[\r\n]+/)
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const rows: InvoiceRow[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    // Linhas de resumo, pagamento, encargos e créditos não são compras.
    if (/^(total|subtotal|pagamento|vencimento|saldo anterior|limite|encargos|juros|iof|parcelamento|melhor dia|resumo da fatura|anuidade|valor mínimo)\b/i.test(line)) continue;
    if (/\b(estorno|crédito|credito|pagamento recebido|pagamento efetuado)\b/i.test(line)) continue;

    const date = parseBrazilianDate(line);
    if (!date) continue;

    const amountMatches = [...line.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\b/g)];
    if (!amountMatches.length) continue;
    const amountText = amountMatches[amountMatches.length - 1][1];
    const amount = Number(amountText.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) continue;

    const title = line
      .replace(/\b\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?\b/, "")
      .replace(/(?:R\$\s*)?(?:\d{1,3}(?:\.\d{3})*|\d+),\d{2}\b/g, "")
      .replace(/\s+/g, " ").trim()
      .replace(/^[\-–|:]+|[\-–|:]+$/g, "");
    if (title.length < 3 || /cartão|fatura|titular|você pagou|compras nacionais/i.test(title)) continue;

    const key = [title.toLowerCase(), date, amount.toFixed(2)].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ title: title.slice(0, 100), date, amount, category: categoryFor(title) });
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

  const total = useMemo(() => rows.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0), [rows]);
  const audit = useMemo(() => {
    const normalize = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    const existing = transactions.filter(item => item.type === "expense");
    const exactMatches = rows.filter(row => existing.some(item => normalize(item.title) === normalize(row.title) && item.date === row.date && Math.abs(Number(item.amount) - row.amount) < 0.01));
    const duplicateMap = new Map<string, InvoiceRow[]>();
    rows.forEach(row => {
      const key = [normalize(row.title), row.amount.toFixed(2)].join("|");
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

  const analyze = async () => {
    if (!file) return;
    setBusy(true); setError(""); setRows([]); setProgress("Preparando leitura...");
    try {
      const text = await extractFile(file, setProgress);
      const parsed = parseRows(text);
      if (!parsed.length) throw new Error("Não encontrei compras com data e valor reconhecíveis. Tente o PDF original ou uma foto mais nítida da tabela de compras.");
      setRows(parsed);
      setProgress("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível ler a fatura.");
    } finally { setBusy(false); }
  };

  const confirmImport = async () => {
    if (!rows.length || rows.some(row => !row.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(row.amount) || row.amount <= 0)) {
      setError("Revise os campos: descrição, data e valor precisam estar válidos.");
      return;
    }
    setBusy(true); setError("");
    try { await onImport(rows); setDone(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Falha ao importar os lançamentos."); }
    finally { setBusy(false); }
  };

  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <section className="modal invoice-modal" role="dialog" aria-modal="true" aria-labelledby="invoice-title">
      <div className="modal-heading">
        <div><span className="eyebrow">IMPORTAÇÃO INTELIGENTE</span><h2 id="invoice-title">Ler fatura do cartão</h2></div>
        <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="Fechar"><X size={19}/></button>
      </div>
      {done ? <div className="invoice-success"><CheckCircle2 size={32}/><strong>Fatura importada!</strong><p>Os lançamentos revisados foram adicionados à sua conta.</p><button className="primary-btn" onClick={onClose}>Concluir</button></div> : <>
        <p className="muted-text">Envie o PDF ou uma foto da fatura. A leitura é feita no seu navegador; o arquivo não é enviado para um serviço externo de OCR.</p>
        <label className="invoice-drop">
          <FileUp size={28}/>
          <strong>{file ? file.name : "Selecionar fatura"}</strong>
          <span>PDF, JPG, PNG ou WEBP · até 15 MB</span>
          <input type="file" accept=".pdf,image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { setFile(e.target.files?.[0] || null); setRows([]); setError(""); setProgress(""); }} />
        </label>
        {!rows.length && <button className="primary-btn invoice-action" disabled={!file || busy || (file?.size || 0) > 15 * 1024 * 1024} onClick={() => void analyze()}>{busy ? <><LoaderCircle className="spin" size={16}/> {progress || "Analisando..."}</> : "Analisar fatura"}</button>}
        {file && file.size > 15 * 1024 * 1024 && <p className="invoice-error">O arquivo ultrapassa o limite de 15 MB.</p>}
        {error && <p className="invoice-error"><AlertTriangle size={15}/> {error}</p>}
        {rows.length > 0 && <div className="invoice-review">
          <div className="invoice-review-head"><strong>{rows.length} compra(s) reconhecida(s)</strong><span>Revise ou corrija antes de importar</span></div>
          <div className="invoice-total-preview"><span>Total reconhecido</span><strong>{total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></div>
          <section className="invoice-audit" aria-label="Auditoria da fatura">
            <div className="invoice-audit-heading"><span className="eyebrow">AUDITORIA AUTOMÁTICA</span><strong>O que encontrei nesta fatura</strong></div>
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
          <div className="invoice-rows">{rows.map((row, index) => <div className="invoice-row invoice-row-editable" key={index}>
            <div className="invoice-row-fields">
              <label>Descrição<input value={row.title} maxLength={100} onChange={e => updateRow(index, { title: e.target.value })}/></label>
              <div className="invoice-row-subfields">
                <label>Data<input type="date" value={row.date} onChange={e => updateRow(index, { date: e.target.value })}/></label>
                <label>Valor (R$)<input inputMode="decimal" value={String(row.amount).replace(".", ",")} onChange={e => { const parsed = Number(e.target.value.replace(",", ".")); updateRow(index, { amount: e.target.value.trim() === "" ? 0 : parsed }); }}/></label>
                <label>Categoria<select value={row.category} onChange={e => updateRow(index, { category: e.target.value })}>{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
              </div>
            </div>
            <button type="button" className="icon-btn invoice-remove" title="Remover compra" aria-label={"Remover " + row.title} onClick={() => setRows(current => current.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={16}/></button>
          </div>)}</div>
          <button className="primary-btn invoice-action" disabled={busy || !rows.length} onClick={() => void confirmImport()}>{busy ? "Salvando..." : "Confirmar e importar " + rows.length + " compra(s)"}</button>
          <button type="button" className="outline-btn invoice-action" disabled={busy} onClick={() => { setRows([]); setError(""); }}>Descartar leitura e tentar novamente</button>
        </div>}
        <p className="invoice-footnote">A leitura automática pode errar. Confira todos os lançamentos antes de confirmar. Compras parceladas são registradas pelo valor identificado na fatura; confira se esse valor corresponde à parcela, não ao total da compra.</p>
      </>}
    </section>
  </div>;
}
