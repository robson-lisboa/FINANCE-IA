import { useState } from "react";
import { createWorker } from "tesseract.js";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
import { FileUp, LoaderCircle, X, CheckCircle2, AlertTriangle } from "lucide-react";

type InvoiceRow = { title: string; date: string; amount: number; category: string };
type Props = { onClose: () => void; onImport: (rows: InvoiceRow[]) => Promise<void> };

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
  const match = value.match(/\b(\d{2})[/.\-](\d{2})(?:[/.\-](\d{2,4}))?\b/);
  if (!match) return null;
  const year = match[3] ? (match[3].length === 2 ? "20" + match[3] : match[3]) : String(new Date().getFullYear());
  return year + "-" + match[2] + "-" + match[1];
}

function parseRows(text: string): InvoiceRow[] {
  const lines = text.split(/[\r\n]+/).map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const rows: InvoiceRow[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    if (/total|pagamento|vencimento|saldo anterior|limite|encargos|juros|iof|parcelamento|melhor dia|resumo da fatura|anuidade|valor mínimo/i.test(line)) continue;
    const amountMatches = [...line.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\b/g)];
    if (!amountMatches.length) continue;
    const amountText = amountMatches[amountMatches.length - 1][1];
    const amount = Number(amountText.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) continue;
    const date = parseBrazilianDate(line);
    if (!date) continue;
    const title = line
      .replace(/\b\d{2}[/.\-]\d{2}(?:[/.\-]\d{2,4})?\b/, "")
      .replace(/(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}\b|\d+,\d{2}\b/g, "")
      .replace(/\s+/g, " ").trim()
      .replace(/^[\-–|:]+|[\-–|:]+$/g, "");
    if (title.length < 3 || /cartão|fatura|titular|você pagou/i.test(title)) continue;
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
      for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 12); pageNumber++) {
        setProgress("Lendo página " + pageNumber + " de " + Math.min(pdf.numPages, 12) + "...");
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => "str" in item ? item.str : "").join(" ");
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
    } finally {
      if (worker) await worker.terminate();
    }
    return chunks.join("\n");
  }
  if (!file.type.startsWith("image/")) throw new Error("Envie uma fatura em PDF, JPG ou PNG.");
  const worker = await createWorker("por");
  try {
    setProgress("Reconhecendo texto da imagem...");
    const result = await worker.recognize(file);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}

export default function InvoiceImporter({ onClose, onImport }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const analyze = async () => {
    if (!file) return;
    setBusy(true); setError(""); setRows([]); setProgress("Preparando leitura...");
    try {
      const text = await extractFile(file, setProgress);
      const parsed = parseRows(text);
      if (!parsed.length) throw new Error("Não encontrei compras com data e valor reconhecíveis. Tente um PDF original ou uma foto mais nítida da tabela de compras.");
      setRows(parsed);
      setProgress("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível ler a fatura.");
    } finally { setBusy(false); }
  };

  const confirmImport = async () => {
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
      {done ? <div className="invoice-success"><CheckCircle2 size={32}/><strong>Fatura importada!</strong><p>Os lançamentos reconhecidos foram adicionados à sua conta.</p><button className="primary-btn" onClick={onClose}>Concluir</button></div> : <>
        <p className="muted-text">Envie o PDF ou uma foto da fatura. A leitura acontece no seu navegador; o arquivo não é enviado para um serviço externo de OCR.</p>
        <label className="invoice-drop">
          <FileUp size={28}/>
          <strong>{file ? file.name : "Selecionar fatura"}</strong>
          <span>PDF, JPG ou PNG · até 15 MB</span>
          <input type="file" accept=".pdf,image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { setFile(e.target.files?.[0] || null); setRows([]); setError(""); }} />
        </label>
        {!rows.length && <button className="primary-btn invoice-action" disabled={!file || busy || (file?.size || 0) > 15 * 1024 * 1024} onClick={() => void analyze()}>{busy ? <><LoaderCircle className="spin" size={16}/> {progress || "Analisando..."}</> : "Analisar fatura"}</button>}
        {file && file.size > 15 * 1024 * 1024 && <p className="invoice-error">O arquivo ultrapassa o limite de 15 MB.</p>}
        {error && <p className="invoice-error"><AlertTriangle size={15}/> {error}</p>}
        {rows.length > 0 && <div className="invoice-review">
          <div className="invoice-review-head"><strong>{rows.length} compra(s) reconhecida(s)</strong><span>Confira antes de importar</span></div>
          <div className="invoice-rows">{rows.map((row, index) => <div className="invoice-row" key={index}><div><strong>{row.title}</strong><small>{row.category} · {row.date.split("-").reverse().join("/")}</small></div><b>{row.amount.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</b></div>)}</div>
          <button className="primary-btn invoice-action" disabled={busy} onClick={() => void confirmImport()}>{busy ? "Salvando..." : "Confirmar e importar"}</button>
        </div>}
        <p className="invoice-footnote">A leitura automática pode errar. Confira datas, descrições e valores antes de confirmar. Compras parceladas e formatos diferentes podem exigir ajuste manual.</p>
      </>}
    </section>
  </div>;
}
