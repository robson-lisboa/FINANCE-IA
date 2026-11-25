import { useMemo } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Lightbulb, ShieldAlert, TrendingDown, TrendingUp, Wallet } from "lucide-react";

type Transaction = { id: string; title: string; category: string; date: string; amount: number; type: "income" | "expense" };
type Props = { transactions: Transaction[]; formatMoney: (value: number) => string };

export default function FinancialDiagnosis({ transactions, formatMoney }: Props) {
  const report = useMemo(() => {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousKey = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;
    const valid = transactions.filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t.date) && Number.isFinite(Number(t.amount)));
    const sum = (items: Transaction[], type: "income" | "expense") => items.filter(t => t.type === type).reduce((total, t) => total + Number(t.amount), 0);
    const current = valid.filter(t => t.date.startsWith(currentKey));
    const previous = valid.filter(t => t.date.startsWith(previousKey));
    const currentIncome = sum(current, "income");
    const currentExpenses = sum(current, "expense");
    const previousExpenses = sum(previous, "expense");
    const categories = current.filter(t => t.type === "expense").reduce<Record<string, number>>((acc, t) => { acc[t.category] = (acc[t.category] || 0) + Number(t.amount); return acc; }, {});
    const ranked = Object.entries(categories).sort((a, b) => b[1] - a[1]);
    const recurringMap = valid.filter(t => t.type === "expense").reduce<Record<string, { title: string; months: Set<string>; total: number; count: number }>>((acc, t) => {
      const title = t.title.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
      if (!title) return acc;
      if (!acc[title]) acc[title] = { title: t.title.trim(), months: new Set<string>(), total: 0, count: 0 };
      acc[title].months.add(t.date.slice(0, 7));
      acc[title].total += Number(t.amount);
      acc[title].count += 1;
      return acc;
    }, {});
    const recurring = Object.values(recurringMap).filter(item => item.months.size >= 2)
      .map(item => ({ ...item, monthlyAverage: item.total / item.months.size }))
      .sort((a, b) => b.monthlyAverage - a.monthlyAverage).slice(0, 5);
    const recurringTotal = recurring.reduce((total, item) => total + item.monthlyAverage, 0);
    const change = previousExpenses > 0 ? ((currentExpenses - previousExpenses) / previousExpenses) * 100 : null;
    const savings = currentIncome > 0 ? ((currentIncome - currentExpenses) / currentIncome) * 100 : null;
    const days = Math.max(1, now.getDate());
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedExpenses = currentExpenses / days * daysInMonth;
    const projectedBalance = currentIncome - projectedExpenses;
    return { currentKey, previousKey, currentIncome, currentExpenses, previousExpenses, balance: currentIncome - currentExpenses, ranked, recurring, recurringTotal, change, savings, dailyAverage: currentExpenses / days, projectedExpenses, projectedBalance, daysInMonth, daysElapsed: days, count: current.length };
  }, [transactions]);

  const monthName = (key: string) => { const [year, month] = key.split("-").map(Number); return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); };
  const advice = report.count === 0
    ? "Cadastre ou importe seus lançamentos deste mês para receber um diagnóstico baseado nos seus dados."
    : report.currentExpenses > report.currentIncome && report.currentIncome > 0
      ? "Suas despesas já superam suas receitas neste mês. Revise primeiro os gastos variáveis e evite assumir novas parcelas."
      : report.change !== null && report.change > 15
        ? "Seus gastos cresceram mais de 15% em relação ao mês anterior. Confira as categorias com maior peso antes de novas compras."
        : report.savings !== null && report.savings >= 20
          ? "Sua taxa de economia está em 20% ou mais neste mês. Mantenha esse ritmo e direcione o excedente às suas prioridades."
          : "Acompanhe os gastos ao longo do mês e defina um limite para a categoria que mais consome seu orçamento.";

  return <section className="page-section diagnosis-page">
    <div className="page-heading"><div><p className="eyebrow">INTELIGÊNCIA FINANCEIRA</p><h1>Diagnóstico financeiro</h1><p className="muted-text">Leitura automática dos seus lançamentos, sem estimativas ocultas.</p></div></div>
    <div className="stats-grid">
      <div className="stat-card"><div className="stat-top"><span>Receitas do mês</span><div className="stat-icon green"><ArrowDownRight size={19}/></div></div><strong className="stat-value">{formatMoney(report.currentIncome)}</strong><div className="stat-detail">Entradas em {monthName(report.currentKey)}</div></div>
      <div className="stat-card"><div className="stat-top"><span>Despesas do mês</span><div className="stat-icon red"><ArrowUpRight size={19}/></div></div><strong className="stat-value">{formatMoney(report.currentExpenses)}</strong><div className="stat-detail">Média diária: {formatMoney(report.dailyAverage)}</div></div>
      <div className="stat-card"><div className="stat-top"><span>Resultado do mês</span><div className="stat-icon purple"><Wallet size={19}/></div></div><strong className="stat-value">{formatMoney(report.balance)}</strong><div className="stat-detail">Receitas menos despesas</div></div>
      <div className="stat-card"><div className="stat-top"><span>Taxa de economia</span><div className="stat-icon blue"><Activity size={19}/></div></div><strong className="stat-value">{report.savings === null ? "—" : `${report.savings.toFixed(1).replace(".", ",")}%`}</strong><div className="stat-detail">Sobre as receitas deste mês</div></div>
    </div>
    <div className="content-grid insights-page-grid">
      <div className="panel insight-panel">
        <div className="insight-title"><div className="ai-icon"><Lightbulb size={18}/></div><div><h2>Recomendação do Finance IA</h2><p>Orientação baseada nos registros disponíveis</p></div></div>
        <div className="insight-highlight"><span className="insight-label">PONTO DE ATENÇÃO</span><strong>{report.count === 0 ? "Ainda faltam dados para analisar." : report.balance < 0 ? "Atenção: resultado negativo." : report.change !== null && report.change > 15 ? "Despesas em alta." : "Acompanhe seu ritmo financeiro."}</strong><p>{advice}</p></div>
        <div className="diagnosis-comparison"><div><span>Despesas em {monthName(report.previousKey)}</span><strong>{formatMoney(report.previousExpenses)}</strong></div><div><span>Variação mensal</span><strong className={report.change === null ? "" : report.change > 0 ? "diagnosis-negative" : "goal-positive"}>{report.change === null ? "Sem base anterior" : `${report.change > 0 ? "+" : ""}${report.change.toFixed(1).replace(".", ",")}%`}</strong></div></div>
        <p className="insight-disclaimer">Comparação entre meses-calendário. O mês atual ainda está em andamento; os valores podem mudar. Análise informativa, não é recomendação de investimento.</p>
      </div>
      <div className="panel diagnosis-forecast">
        <div className="insight-title"><div className="ai-icon"><TrendingUp size={18}/></div><div><h2>Projeção de fechamento</h2><p>Estimativa pelo ritmo de gastos atual</p></div></div>
        <div className="diagnosis-forecast-grid"><div><span>Despesas estimadas no fim do mês</span><strong>{formatMoney(report.projectedExpenses)}</strong></div><div><span>Saldo estimado no fim do mês</span><strong className={report.projectedBalance < 0 ? "diagnosis-negative" : "goal-positive"}>{formatMoney(report.projectedBalance)}</strong></div></div>
        <p className="insight-disclaimer">Projeção linear baseada em {report.daysElapsed} de {report.daysInMonth} dias. Não considera contas futuras ainda não cadastradas nem mudanças no padrão de consumo.</p>
      </div>
      <div className="panel recurring-panel">
        <div className="panel-heading"><div><h2>Possíveis gastos recorrentes</h2><p>Identificados pelo mesmo nome em meses diferentes</p></div><ShieldAlert size={18} className="subtle-icon"/></div>
        {report.recurring.length === 0 ? <div className="empty-state compact">Ainda não há lançamentos suficientes com o mesmo nome em pelo menos dois meses.</div> : <>
          <div className="recurring-total"><span>Média mensal dos itens identificados</span><strong>{formatMoney(report.recurringTotal)}</strong></div>
          <div className="recurring-list">{report.recurring.map(item => <div className="recurring-item" key={item.title}><div><strong>{item.title}</strong><small>{item.count} lançamento(s) em {item.months.size} mês(es)</small></div><b>{formatMoney(item.monthlyAverage)}/mês</b></div>)}</div>
        </>}
        <p className="insight-disclaimer">Detecção aproximada por descrição repetida; não confirma que seja assinatura ou cobrança automática. Valores são médias dos meses encontrados.</p>
      </div>
      <div className="panel goals-panel">
        <div className="panel-heading"><div><h2>Onde você mais gasta</h2><p>Despesas por categoria neste mês</p></div><Activity size={18} className="subtle-icon"/></div>
        {report.ranked.length === 0 ? <div className="empty-state compact">Nenhuma despesa registrada neste mês.</div> : <div className="category-list">{report.ranked.slice(0, 6).map(([category, amount], index) => { const percent = report.currentExpenses ? amount / report.currentExpenses * 100 : 0; const colors = ["#8e7cff", "#35c99a", "#f3b85b", "#5ca9ff", "#e879a9", "#b48cff"]; return <div className="category-item" key={category}><div className="category-top"><span><i style={{ background: colors[index % colors.length] }}/>{category}</span><strong>{formatMoney(amount)}</strong></div><div className="progress-track"><div style={{ width: `${percent}%`, background: colors[index % colors.length] }}/></div><small>{percent.toFixed(1).replace(".", ",")}% das despesas</small></div>; })}</div>}
      </div>
    </div>
  </section>;
}
