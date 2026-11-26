import { useMemo, useState } from "react";
import { filterMonthToDate, filterRealizedTransactions } from "./lib/financial-core";
import { Search, ChevronDown, ChevronUp, Microscope, ReceiptText, TrendingUp, Repeat2, Coins } from "lucide-react";

type Transaction = { id: string; title: string; category: string; date: string; amount: number; type: "income" | "expense" };
type Props = { transactions: Transaction[]; formatMoney: (value: number) => string; selectedMonth: string };

type Finding = { id: string; title: string; summary: string; value: string; detail: string; icon: "largest" | "small" | "growth" | "repeat"; rows: Transaction[] };

export default function InvestigationPanel({ transactions, formatMoney, selectedMonth }: Props) {
  const [opened, setOpened] = useState<string | null>(null);
  const findings = useMemo<Finding[]>(() => {
    const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const now = new Date();
    const [year, month] = selectedMonth.split("-").map(Number);
    const selectedDate = new Date(year, month - 1, 1);
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
    const currentKey = selectedMonth;
    const previousKey = key(new Date(year, month - 2, 1));
    const selectedLabel = selectedDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const expenses = filterRealizedTransactions(transactions).filter(t => t.type === "expense" && Number.isFinite(t.amount) && t.amount > 0);
    const current = filterMonthToDate(expenses, currentKey);
    const previous = expenses.filter(t => t.date.startsWith(previousKey) && (!isCurrentMonth || Number(t.date.slice(8, 10)) <= now.getDate()));
    const result: Finding[] = [];
    const largest = [...current].sort((a,b) => b.amount-a.amount)[0];
    if (largest) result.push({ id:"largest", title:"Maior saída do período", summary:`${largest.title} · ${largest.category} · ${largest.date.split("-").reverse().join("/")}`, value:formatMoney(largest.amount), detail:`Este é o maior lançamento individual classificado como despesa em ${selectedLabel}.`, icon:"largest", rows:[largest] });
    const small = current.filter(t => t.amount <= 100).sort((a,b) => b.amount-a.amount);
    const smallTotal = small.reduce((s,t)=>s+t.amount,0);
    if (small.length >= 2) result.push({ id:"small", title:"Pequenos gastos somados", summary:`${small.length} lançamentos de até R$ 100,00 no período selecionado`, value:formatMoney(smallTotal), detail:`A soma mostra quanto esses valores menores representam em ${selectedLabel}. Não significa que sejam desperdício.`, icon:"small", rows:small });
    const sumCategory = (items: Transaction[], category: string) => items.filter(t=>t.category.trim().toLocaleLowerCase("pt-BR")===category.trim().toLocaleLowerCase("pt-BR")).reduce((s,t)=>s+t.amount,0);
    const categories = [...new Set(current.map(t=>t.category))].map(category=>({category, now:sumCategory(current,category), before:sumCategory(previous,category)})).filter(x=>x.before>0 && x.now>x.before).sort((a,b)=>(b.now/b.before-1)-(a.now/a.before-1));
    const growth = categories[0];
    if (growth) {
      const rows = current.filter(t=>t.category.trim().toLocaleLowerCase("pt-BR")===growth.category.trim().toLocaleLowerCase("pt-BR"));
      const pct = (growth.now/growth.before-1)*100;
      result.push({ id:"growth", title:"Categoria que mais acelerou", summary:`${growth.category} · ${pct.toFixed(0)}% acima do mês anterior`, value:formatMoney(growth.now), detail:`A categoria somou ${formatMoney(growth.now)} em ${selectedLabel}, contra ${formatMoney(growth.before)} no mesmo intervalo do mês anterior quando o período está em andamento.`, icon:"growth", rows });
    }
    const groups = new Map<string, Transaction[]>();
    expenses.forEach(t=>{ const k=t.title.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g," "); if(!k)return; groups.set(k,[...(groups.get(k)||[]),t]); });
    const recurring = [...groups.values()].filter(rows=>new Set(rows.map(t=>t.date.slice(0,7))).size>=2).sort((a,b)=>b.reduce((s,t)=>s+t.amount,0)-a.reduce((s,t)=>s+t.amount,0))[0];
    if (recurring) {
      const total = recurring.reduce((s,t)=>s+t.amount,0);
      result.push({ id:"repeat", title:"Descrição que reaparece", summary:`${recurring[0].title} · ${new Set(recurring.map(t=>t.date.slice(0,7))).size} meses diferentes`, value:formatMoney(total), detail:"A mesma descrição apareceu em meses diferentes. Confira se é uma conta recorrente; isso não confirma uma assinatura.", icon:"repeat", rows:recurring.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8) });
    }
    return result;
  }, [transactions, formatMoney, selectedMonth]);

  const iconFor = (kind: Finding["icon"]) => kind==="largest" ? <ReceiptText size={17}/> : kind==="small" ? <Coins size={17}/> : kind==="growth" ? <TrendingUp size={17}/> : <Repeat2 size={17}/>;
  return <section className="panel investigation-panel">
    <div className="panel-heading"><div><h2><Microscope size={18}/> Investigação financeira</h2><p>O que seus lançamentos revelam em {new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p></div><Search size={19} className="subtle-icon"/></div>
    {findings.length===0 ? <div className="investigation-empty"><Search size={20}/><div><strong>Ainda não há pistas suficientes</strong><p>Com mais lançamentos e histórico de meses, vou encontrar padrões, mudanças e despesas que merecem uma segunda olhada.</p></div></div> :
      <div className="investigation-grid">{findings.map(item=><article className={`investigation-card ${opened===item.id?"is-open":""}`} key={item.id}>
        <button type="button" className="investigation-trigger" onClick={()=>setOpened(opened===item.id?null:item.id)} aria-expanded={opened===item.id}>
          <span className="investigation-icon">{iconFor(item.icon)}</span><span className="investigation-copy"><strong>{item.title}</strong><small>{item.summary}</small></span><b>{item.value}</b>{opened===item.id?<ChevronUp size={16}/>:<ChevronDown size={16}/>}
        </button>
        {opened===item.id&&<div className="investigation-detail"><p>{item.detail}</p><strong>Lançamentos que sustentam esta pista</strong><div className="investigation-rows">{item.rows.map((t,i)=><div key={t.id||i}><span>{t.title}<small>{t.category} · {t.date.split("-").reverse().join("/")}</small></span><b>{formatMoney(t.amount)}</b></div>)}</div></div>}
      </article>)}</div>}
    <p className="insight-disclaimer">As pistas são análises dos registros cadastrados, não acusações de fraude nem confirmação de cobranças indevidas. Clique em uma pista para conferir os lançamentos usados.</p>
  </section>;
}
