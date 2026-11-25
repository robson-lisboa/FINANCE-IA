import { useMemo, useState } from "react";
import { Search, Wallet, Repeat2, ShieldCheck } from "lucide-react";

type Transaction = { id: string; title: string; category: string; date: string; amount: number; type: "income" | "expense" };
type Props = { transactions: Transaction[]; formatMoney: (value: number) => string };

export default function WasteDetector({ transactions, formatMoney }: Props) {
  const [target, setTarget] = useState(20);
  const report = useMemo(() => {
    const valid = transactions.filter(t => t.type === "expense" && /^\\d{4}-\\d{2}-\\d{2}$/.test(t.date) && Number.isFinite(Number(t.amount)) && Number(t.amount) > 0);
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const current = valid.filter(t => t.date.startsWith(monthKey));
    const total = current.reduce((sum, t) => sum + Number(t.amount), 0);
    const small = current.filter(t => Number(t.amount) <= 50);
    const smallTotal = small.reduce((sum, t) => sum + Number(t.amount), 0);
    const groups = new Map<string, Transaction[]>();
    valid.forEach(t => {
      const key = t.title.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
      if (key.length > 2) groups.set(key, [...(groups.get(key) || []), t]);
    });
    const recurring = [...groups.values()].map(items => {
      const months = new Set(items.map(t => t.date.slice(0, 7)));
      const monthly = items.reduce((sum, t) => sum + Number(t.amount), 0) / Math.max(1, months.size);
      return { title: items[0].title, items, months: months.size, monthly };
    }).filter(item => item.months >= 2).sort((a, b) => b.monthly - a.monthly).slice(0, 5);
    const frequent = [...groups.values()].map(items => ({ title: items[0].title, items: items.filter(t => t.date.startsWith(monthKey)) }))
      .filter(item => item.items.length >= 3).map(item => ({ ...item, total: item.items.reduce((sum, t) => sum + Number(t.amount), 0) }))
      .sort((a, b) => b.total - a.total).slice(0, 5);
    return { total, count: current.length, smallCount: small.length, smallTotal, recurring, frequent, months: new Set(valid.map(t => t.date.slice(0, 7))).size };
  }, [transactions]);
  const estimated = report.smallTotal * target / 100;
  return <section className="panel waste-detector">
    <div className="panel-heading"><div><p className="eyebrow">ETAPA 6 · OTIMIZAÇÃO</p><h2>Detector de desperdícios</h2><p>Encontra padrões de gastos que merecem uma segunda olhada.</p></div><Search size={19} className="subtle-icon"/></div>
    {report.count === 0 ? <div className="time-machine-empty"><Search size={22}/><div><strong>Preciso de lançamentos deste mês</strong><p>Quando houver despesas registradas, vou separar pequenos gastos e compras frequentes para investigar.</p></div></div> : <>
      <div className="waste-kpis">
        <div><span>Pequenos gastos (até R$ 50)</span><strong>{formatMoney(report.smallTotal)}</strong><small>{report.smallCount} lançamento(s) no mês</small></div>
        <div><span>Despesas analisadas</span><strong>{formatMoney(report.total)}</strong><small>{report.count} lançamento(s)</small></div>
      </div>
      <div className="waste-savings">
        <div><div><strong>Simule uma redução nos pequenos gastos</strong><b>{target}%</b></div>
        <input aria-label="Percentual de redução" type="range" min="5" max="50" step="5" value={target} onChange={e => setTarget(Number(e.target.value))}/>
        <p>Se você reduzir esse grupo em {target}%, poderá liberar aproximadamente <strong>{formatMoney(estimated)}</strong> neste mês. É uma simulação, não uma economia garantida.</p></div>
      </div>
      <div className="waste-lists">
        <div><h3><Repeat2 size={15}/> Descrições que reaparecem</h3>{report.recurring.length ? report.recurring.map(item => <article key={item.title}><span>{item.title}<small>{item.items.length} lançamentos · {item.months} meses</small></span><b>{formatMoney(item.monthly)}/mês*</b></article>) : <p className="waste-empty">Ainda não há histórico suficiente em meses diferentes.</p>}</div>
        <div><h3><Wallet size={15}/> Compras frequentes neste mês</h3>{report.frequent.length ? report.frequent.map(item => <article key={item.title}><span>{item.title}<small>{item.items.length} vezes no mês</small></span><b>{formatMoney(item.total)}</b></article>) : <p className="waste-empty">Nenhuma descrição aparece três vezes ou mais neste mês.</p>}</div>
      </div>
      <p className="insight-disclaimer"><ShieldCheck size={13}/> *Média dos valores registrados dividida pelos meses em que a descrição aparece. Repetição não comprova assinatura ou desperdício. O detector não classifica compras como desnecessárias e não altera lançamentos.</p>
    </>}
  </section>;
}
