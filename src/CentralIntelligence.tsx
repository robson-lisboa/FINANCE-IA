import { useMemo, useState } from "react";
import { filterMonthToDate, filterRealizedTransactions } from "./lib/financial-core";
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Radar, Search, ShieldCheck, Sparkles } from "lucide-react";

type Transaction = { id: string; title: string; category: string; date: string; amount: number; type: "income" | "expense" };
type Finding = {
  id: string;
  level: "critical" | "warning" | "info";
  title: string;
  summary: string;
  evidence: string;
  amount?: number;
  items?: Transaction[];
};

export default function CentralIntelligence({ transactions, formatMoney, selectedMonth }: { transactions: Transaction[]; formatMoney: (value: number) => string; selectedMonth: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const analysis = useMemo(() => {
    const valid = filterRealizedTransactions(transactions).filter(t => Number.isFinite(Number(t.amount)) && Number(t.amount) >= 0);
    const now = new Date();
    const [selectedYear, selectedMonthNumber] = selectedMonth.split("-").map(Number);
    const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonthNumber === now.getMonth() + 1;
    const monthKey = selectedMonth;
    const current = filterMonthToDate(valid, monthKey);
    const income = current.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
    const expenses = current.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
    const findings: Finding[] = [];

    if (income > 0 && expenses > income) {
      findings.push({ id: "deficit", level: "critical", title: "Despesas já ultrapassaram as receitas", summary: `O resultado registrado está negativo em ${formatMoney(expenses - income)} no período selecionado.`, evidence: `${formatMoney(expenses)} em despesas contra ${formatMoney(income)} em receitas registradas.` });
    } else if (income > 0) {
      const expenseEntries = current.filter(t => t.type === "expense");
      const distinctExpenseDays = new Set(expenseEntries.map(t => t.date)).size;
      const hasProjectionEvidence = isCurrentMonth && expenseEntries.length >= 5 && distinctExpenseDays >= 3;
      const elapsed = Math.max(1, now.getDate());
      const days = new Date(selectedYear, selectedMonthNumber, 0).getDate();
      const projected = (expenses / elapsed) * days;
      if (hasProjectionEvidence && projected > income && expenses > 0) {
        findings.push({ id: "pace", level: "warning", title: "Ritmo de gastos pode pressionar o fechamento", summary: "Se o ritmo atual continuar, as despesas projetadas podem superar as receitas registradas.", evidence: `Projeção linear de despesas: ${formatMoney(projected)} para ${formatMoney(income)} em receitas. Não inclui contas futuras ainda não cadastradas.` });
      }
    }

    const duplicateGroups = new Map<string, Transaction[]>();
    current.filter(t => t.type === "expense").forEach(t => {
      const key = [t.date, t.title.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " "), Number(t.amount).toFixed(2)].join("|");
      duplicateGroups.set(key, [...(duplicateGroups.get(key) || []), t]);
    });
    const duplicates = [...duplicateGroups.values()].filter(group => group.length > 1);
    if (duplicates.length) {
      const duplicateItems = duplicates.flat();
      findings.push({ id: "duplicates", level: "warning", title: "Possíveis lançamentos repetidos", summary: `${duplicates.length} grupo(s) têm mesma data, descrição e valor.`, evidence: "Coincidência de dados não comprova cobrança duplicada. Confira os comprovantes antes de qualquer alteração.", amount: duplicateItems.reduce((sum, t) => sum + Number(t.amount), 0), items: duplicateItems });
    }

    const priority = { critical: 0, warning: 1, info: 2 };
    findings.sort((a, b) => priority[a.level] - priority[b.level]);
    return { findings, currentCount: current.length, income, expenses, hasData: current.length > 0 };
  }, [transactions, formatMoney, selectedMonth]);

  const levelLabel = (level: Finding["level"]) => level === "critical" ? "Atenção imediata" : level === "warning" ? "Vale investigar" : "Observação";
  const monthLabel = new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return <section className="central-intelligence panel">
    <div className="central-intelligence-head">
      <div className="central-intelligence-brand"><span><Radar size={21}/></span><div><p className="eyebrow">NÚCLEO DE ANÁLISE</p><h2>Central de Inteligência</h2><p>Verificação de inconsistências e possíveis duplicidades.</p></div></div>
      <span className="central-live"><i/> ANÁLISE ATIVA</span>
    </div>
    <div className="central-summary">
      <div><span>Achados encontrados</span><strong>{analysis.findings.length}</strong><small>em {monthLabel}</small></div>
      <div><span>Receitas registradas</span><strong>{formatMoney(analysis.income)}</strong><small>{monthLabel}</small></div>
      <div><span>Despesas registradas</span><strong>{formatMoney(analysis.expenses)}</strong><small>{analysis.currentCount} lançamento(s) · {monthLabel}</small></div>
    </div>
    <div className="central-section-title"><div><Sparkles size={16}/><strong>O que merece sua atenção</strong></div><span>{analysis.findings.length} sinal(is)</span></div>
    {!analysis.hasData ? <div className="central-empty"><Search size={22}/><div><strong>A investigação ainda não começou</strong><p>Adicione lançamentos ou importe uma fatura. A Central vai procurar padrões, concentrações de gastos e possíveis inconsistências.</p></div></div> :
      analysis.findings.length === 0 ? <div className="central-empty"><ShieldCheck size={22}/><div><strong>Nenhum sinal relevante encontrado por enquanto</strong><p>Isso não significa que todas as contas estejam corretas. A análise considera somente os lançamentos registrados e os critérios disponíveis.</p></div></div> :
      <div className="central-findings">{analysis.findings.map((finding, index) => <article className={`central-finding ${finding.level}`} key={finding.id}>
        <button type="button" className="central-finding-toggle" onClick={() => setExpanded(expanded === finding.id ? null : finding.id)} aria-expanded={expanded === finding.id}>
          <span className="central-finding-icon">{finding.level === "critical" ? <AlertTriangle size={18}/> : finding.level === "warning" ? <Activity size={18}/> : <CheckCircle2 size={18}/>}</span>
          <span className="central-finding-copy"><small>{levelLabel(finding.level)} · ACHADO {index + 1}</small><strong>{finding.title}</strong><span>{finding.summary}</span></span>
          {expanded === finding.id ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
        </button>
        {expanded === finding.id && <div className="central-finding-detail"><p>{finding.evidence}</p>{finding.items && <div className="central-evidence-list">{finding.items.slice(0, 8).map((item, i) => <div key={item.id || i}><span>{item.title}<small>{item.category} · {item.date.split("-").reverse().join("/")}</small></span><b>{formatMoney(Number(item.amount))}</b></div>)}</div>}</div>}
      </article>)}</div>}
    <div className="central-footnote"><ShieldCheck size={14}/><span>A IA não altera nem exclui lançamentos. Os sinais são hipóteses baseadas nos dados registrados; confira as evidências antes de agir.</span></div>
  </section>;
}
