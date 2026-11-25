import { useMemo, useState } from "react";
import { Search, Wallet, Repeat2, ShieldCheck, CheckCircle2 } from "lucide-react";

type Transaction = { id: string; title: string; category: string; date: string; amount: number; type: "income" | "expense" };
type Props = { transactions: Transaction[]; formatMoney: (value: number) => string };

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export default function WasteDetector({ transactions, formatMoney }: Props) {
  const [target, setTarget] = useState(20);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const report = useMemo(() => {
    const valid = transactions.filter(t =>
      t.type === "expense" &&
      /^\d{4}-\d{2}-\d{2}/.test(t.date) &&
      Number.isFinite(Number(t.amount)) &&
      Number(t.amount) > 0
    );
    const monthKeys = [...new Set(valid.map(t => t.date.slice(0, 7)))].sort();
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthKey = monthKeys.includes(currentKey) ? currentKey : monthKeys.at(-1) ?? currentKey;
    const monthTransactions = valid.filter(t => t.date.startsWith(monthKey));
    const small = monthTransactions.filter(t => Number(t.amount) <= 50).sort((a, b) => Number(b.amount) - Number(a.amount));
    const total = monthTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const smallTotal = small.reduce((sum, t) => sum + Number(t.amount), 0);

    const groups = new Map<string, Transaction[]>();
    valid.forEach(t => {
      const key = t.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
      if (key.length > 2) groups.set(key, [...(groups.get(key) || []), t]);
    });
    const recurring = [...groups.values()].map(items => {
      const months = new Set(items.map(t => t.date.slice(0, 7)));
      const monthly = items.reduce((sum, t) => sum + Number(t.amount), 0) / Math.max(1, months.size);
      return { title: items[0].title, items, months: months.size, monthly };
    }).filter(item => item.months >= 2).sort((a, b) => b.monthly - a.monthly).slice(0, 5);
    const frequent = [...groups.values()].map(items => ({ title: items[0].title, items: items.filter(t => t.date.startsWith(monthKey)) }))
      .filter(item => item.items.length >= 3)
      .map(item => ({ ...item, total: item.items.reduce((sum, t) => sum + Number(t.amount), 0) }))
      .sort((a, b) => b.total - a.total).slice(0, 5);
    return { total, count: monthTransactions.length, small, smallTotal, recurring, frequent, monthKey };
  }, [transactions]);

  const included = report.small.filter(t => !excludedIds.includes(t.id));
  const includedTotal = included.reduce((sum, t) => sum + Number(t.amount), 0);
  const estimated = includedTotal * target / 100;
  const hasHistory = report.count > 0;

  return <section className="panel waste-detector">
    <div className="panel-heading"><div><p className="eyebrow">ETAPA 6 · OTIMIZAÇÃO</p><h2>Detector de desperdícios</h2><p>Escolha quais pequenos gastos quer reduzir e veja o impacto no orçamento.</p></div><Search size={19} className="subtle-icon"/></div>
    {!hasHistory ? <div className="time-machine-empty"><Search size={22}/><div><strong>Não encontrei despesas para analisar</strong><p>Cadastre despesas na aba Lançamentos. Assim que houver registros, o simulador usará seus valores reais.</p></div></div> : <>
      <p className="waste-period-label">Análise de {monthLabel(report.monthKey)}{!report.monthKey.startsWith(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`) ? " · mês mais recente com lançamentos" : " · mês atual"}</p>
      <div className="waste-kpis">
        <div><span>Pequenos gastos selecionáveis (até R$ 50)</span><strong>{formatMoney(report.smallTotal)}</strong><small>{report.small.length} compra(s) identificada(s)</small></div>
        <div><span>Total de despesas do período</span><strong>{formatMoney(report.total)}</strong><small>{report.count} lançamento(s) analisado(s)</small></div>
      </div>
      <div className="waste-savings">
        <div><div><strong>Quanto você conseguiria reduzir?</strong><b>{target}%</b></div>
        <input aria-label="Percentual de redução" type="range" min="0" max="50" step="5" value={target} onChange={e => setTarget(Number(e.currentTarget.value))}/>
        <p>Reduzindo {target}% dos gastos marcados, a economia estimada neste período seria de <strong>{formatMoney(estimated)}</strong>. Se esse padrão se repetir, em 12 meses seriam <strong>{formatMoney(estimated * 12)}</strong>.</p>
      </div></div>
      <div className="waste-purchases">
        <div className="waste-purchases-heading"><strong>Quais gastos entram na simulação?</strong><span>{included.length} de {report.small.length} selecionados</span></div>
        {report.small.length ? report.small.map(item => <label className="waste-purchase" key={item.id}>
          <input type="checkbox" checked={!excludedIds.includes(item.id)} onChange={e => setExcludedIds(current => e.currentTarget.checked ? current.filter(id => id !== item.id) : [...current, item.id])}/>
          <span><strong>{item.title}</strong><small>{item.category} · {new Date(`${item.date.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR")}</small></span>
          <b>{formatMoney(Number(item.amount))}</b>
        </label>) : <p className="waste-empty">Não há compras de até R$ 50 neste período. O simulador não vai inventar valores.</p>}
        {report.small.length > 0 && <div className="waste-selection-total"><span>Total considerado na simulação</span><strong>{formatMoney(includedTotal)}</strong></div>}
      </div>
      <div className="waste-lists">
        <div><h3><Repeat2 size={15}/> Descrições que reaparecem</h3>{report.recurring.length ? report.recurring.map(item => <article key={item.title}><span>{item.title}<small>{item.items.length} lançamentos · {item.months} meses</small></span><b>{formatMoney(item.monthly)}/mês*</b></article>) : <p className="waste-empty">Ainda não há histórico suficiente em meses diferentes.</p>}</div>
        <div><h3><Wallet size={15}/> Compras frequentes neste período</h3>{report.frequent.length ? report.frequent.map(item => <article key={item.title}><span>{item.title}<small>{item.items.length} vezes no mês</small></span><b>{formatMoney(item.total)}</b></article>) : <p className="waste-empty">Nenhuma descrição aparece três vezes ou mais neste período.</p>}</div>
      </div>
      <p className="insight-disclaimer"><ShieldCheck size={13}/> A simulação usa somente despesas cadastradas de até R$ 50. A projeção anual multiplica o resultado por 12 e não é garantia de economia. Repetição não significa necessariamente desperdício. Nada é excluído ou alterado automaticamente.</p>
    </>}
  </section>;
}
