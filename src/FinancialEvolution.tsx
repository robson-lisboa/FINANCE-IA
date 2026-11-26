import { useMemo } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";

type Transaction = { id: string; title: string; category: string; date: string; amount: number; type: "income" | "expense" };
type Props = { transactions: Transaction[]; selectedMonth: string; formatMoney: (value: number) => string };

export default function FinancialEvolution({ transactions, selectedMonth, formatMoney }: Props) {
  const report = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const now = new Date();
    const currentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
    const cutoffDay = currentMonth ? now.getDate() : new Date(year, month, 0).getDate();
    const previousDate = new Date(year, month - 2, 1);
    const previousKey = previousDate.getFullYear() + "-" + String(previousDate.getMonth() + 1).padStart(2, "0");
    const valid = transactions.filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t.date) && Number.isFinite(Number(t.amount)) && Number(t.amount) >= 0);
    const inWindow = (t: Transaction, key: string) => t.date.startsWith(key) && (!currentMonth || Number(t.date.slice(8, 10)) <= cutoffDay);
    const sum = (items: Transaction[], type: "income" | "expense") => items.filter(t => t.type === type).reduce((total, t) => total + Number(t.amount), 0);
    const current = valid.filter(t => inWindow(t, selectedMonth));
    const previous = valid.filter(t => inWindow(t, previousKey));
    const income = sum(current, "income"), expenses = sum(current, "expense");
    const previousIncome = sum(previous, "income"), previousExpenses = sum(previous, "expense");
    const balance = income - expenses, previousBalance = previousIncome - previousExpenses;
    const categoryTotals = (items: Transaction[]) => items.filter(t => t.type === "expense").reduce<Record<string, number>>((acc, t) => {
      const key = t.category?.trim() || "Sem categoria";
      acc[key] = (acc[key] || 0) + Number(t.amount);
      return acc;
    }, {});
    const nowCategories = categoryTotals(current), beforeCategories = categoryTotals(previous);
    const categoryChanges = [...new Set([...Object.keys(nowCategories), ...Object.keys(beforeCategories)])]
      .map(category => ({ category, delta: (nowCategories[category] || 0) - (beforeCategories[category] || 0) }))
      .filter(item => Math.abs(item.delta) >= 0.01)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(year, month - 1 - (5 - index), 1);
      const key = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
      const items = valid.filter(t => t.date.startsWith(key) && (!currentMonth || key !== selectedMonth || Number(t.date.slice(8, 10)) <= cutoffDay));
      const monthIncome = sum(items, "income"), monthExpenses = sum(items, "expense");
      return { key, label: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), income: monthIncome, expenses: monthExpenses, balance: monthIncome - monthExpenses };
    });
    return { income, expenses, previousIncome, previousExpenses, balance, previousBalance, categoryChanges, months, hasPrevious: previous.length > 0, currentCount: current.length };
  }, [transactions, selectedMonth]);

  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  };
  const [year, month] = selectedMonth.split("-").map(Number);
  const previousDate = new Date(year, month - 2, 1);
  const previousLabel = monthLabel(previousDate.getFullYear() + "-" + String(previousDate.getMonth() + 1).padStart(2, "0"));
  const delta = report.balance - report.previousBalance;
  const hasComparison = report.hasPrevious && report.currentCount > 0;
  const improved = delta > 0.009, worsened = delta < -0.009;
  const maxAbs = Math.max(1, ...report.months.map(item => Math.max(item.income, item.expenses)));
  const incomeDelta = report.income - report.previousIncome;
  const expenseDelta = report.expenses - report.previousExpenses;

  return <section className="panel financial-evolution" aria-labelledby="financial-evolution-title">
    <div className="panel-heading"><div><h2 id="financial-evolution-title">Evolução financeira</h2><p>O que mudou nos seus lançamentos ao longo dos últimos seis meses</p></div><Activity size={18} className="subtle-icon"/></div>
    {!hasComparison ? <div className="evolution-empty"><strong>Precisamos de mais histórico para comparar.</strong><span>Cadastre lançamentos no mês selecionado e no mês anterior. A comparação usa o mesmo número de dias quando o mês selecionado é o atual.</span></div> : <>
      <div className="evolution-result">
        <div className="evolution-result-icon">{improved ? <TrendingUp size={19}/> : worsened ? <TrendingDown size={19}/> : <Activity size={19}/>}</div>
        <div><span>{"Resultado em relação a " + previousLabel}</span>
          <strong className={improved ? "evolution-positive" : worsened ? "evolution-negative" : ""}>{delta > 0 ? "+" : delta < 0 ? "−" : ""}{formatMoney(Math.abs(delta))}</strong>
          <small>{improved ? "Seu resultado melhorou." : worsened ? "Seu resultado piorou." : "Seu resultado ficou praticamente igual."}</small>
        </div>
      </div>
      <div className="evolution-breakdown">
        <div><span><ArrowDownRight size={14}/> Receitas</span><strong className={incomeDelta >= 0 ? "evolution-positive" : "evolution-negative"}>{incomeDelta > 0 ? "+" : incomeDelta < 0 ? "−" : ""}{formatMoney(Math.abs(incomeDelta))}</strong></div>
        <div><span><ArrowUpRight size={14}/> Despesas</span><strong className={expenseDelta <= 0 ? "evolution-positive" : "evolution-negative"}>{expenseDelta > 0 ? "+" : expenseDelta < 0 ? "−" : ""}{formatMoney(Math.abs(expenseDelta))}</strong></div>
      </div>
      <div className="evolution-drivers"><strong>O que mais influenciou as despesas</strong>
        {report.categoryChanges.length === 0 ? <p>Não houve variação por categoria nos registros comparados.</p> : report.categoryChanges.map(item => <div key={item.category}><span>{item.category}<small>{item.delta > 0 ? "Aumento" : "Redução"} em relação ao período anterior</small></span><b className={item.delta > 0 ? "evolution-negative" : "evolution-positive"}>{item.delta > 0 ? "+" : "−"}{formatMoney(Math.abs(item.delta))}</b></div>)}
      </div>
      <div className="evolution-history"><strong>Histórico mensal</strong><div className="evolution-bars">{report.months.map(item => <div className="evolution-month" key={item.key} title={monthLabel(item.key) + " · Receitas: " + formatMoney(item.income) + " · Despesas: " + formatMoney(item.expenses)}>
        <div className="evolution-bar-pair"><i className="evolution-income-bar" style={{ height: Math.max(item.income > 0 ? 4 : 0, item.income / maxAbs * 70) + "px" }}/><i className="evolution-expense-bar" style={{ height: Math.max(item.expenses > 0 ? 4 : 0, item.expenses / maxAbs * 70) + "px" }}/></div>
        <span>{item.label}</span><small className={item.balance < 0 ? "evolution-negative" : "evolution-positive"}>{formatMoney(item.balance)}</small>
      </div>)}</div><div className="evolution-legend"><span><i className="evolution-income-bar"/> Receitas</span><span><i className="evolution-expense-bar"/> Despesas</span></div></div>
    </>}
    <p className="insight-disclaimer">Análise baseada somente nos lançamentos cadastrados. Para o mês atual, compara até o mesmo dia do mês anterior; para meses anteriores, usa o mês completo. Não representa saldo bancário nem considera movimentações não registradas.</p>
  </section>;
}
