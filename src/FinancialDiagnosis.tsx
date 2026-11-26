import { useMemo } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Lightbulb, ShieldAlert, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import FinancialAssistant from "./FinancialAssistant";
import InvestigationPanel from "./InvestigationPanel";
import CentralIntelligence from "./CentralIntelligence";

type Transaction = { id: string; title: string; category: string; date: string; amount: number; type: "income" | "expense" };
type Props = { transactions: Transaction[]; formatMoney: (value: number) => string; accessToken: string; selectedMonth: string };

export default function FinancialDiagnosis({ transactions, formatMoney, accessToken, selectedMonth }: Props) {
  const report = useMemo(() => {
    const now = new Date();
    const [selectedYear, selectedMonthNumber] = selectedMonth.split("-").map(Number);
    const currentKey = selectedMonth;
    const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonthNumber === now.getMonth() + 1;
    const previousDate = new Date(selectedYear, selectedMonthNumber - 2, 1);
    const previousKey = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;
    const valid = transactions.filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t.date) && Number.isFinite(Number(t.amount)));
    const sum = (items: Transaction[], type: "income" | "expense") => items.filter(t => t.type === type).reduce((total, t) => total + Number(t.amount), 0);
    const current = valid.filter(t => t.date.startsWith(currentKey));
    const previous = valid.filter(t => t.date.startsWith(previousKey) && (!isCurrentMonth || Number(t.date.slice(8, 10)) <= now.getDate()));
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
    const historyStart = new Date(selectedYear, selectedMonthNumber - 4, 1);
    const historyKey = `${historyStart.getFullYear()}-${String(historyStart.getMonth() + 1).padStart(2, "0")}`;
    const priorExpenses = valid.filter(t => t.type === "expense" && t.date.slice(0, 7) >= historyKey && t.date.slice(0, 7) < currentKey);
    const unusual = current.filter(t => t.type === "expense").map(t => {
      const categoryHistory = priorExpenses.filter(item => item.category.trim().toLocaleLowerCase("pt-BR") === t.category.trim().toLocaleLowerCase("pt-BR"));
      const average = categoryHistory.length ? categoryHistory.reduce((total, item) => total + Number(item.amount), 0) / categoryHistory.length : 0;
      return { ...t, categoryAverage: average, referenceCount: categoryHistory.length, difference: average > 0 ? (Number(t.amount) / average - 1) * 100 : 0 };
    }).filter(t => t.referenceCount >= 3 && t.amount >= t.categoryAverage * 1.5)
      .sort((a, b) => b.difference - a.difference).slice(0, 5);
    const change = previousExpenses > 0 ? ((currentExpenses - previousExpenses) / previousExpenses) * 100 : null;
    const savings = currentIncome > 0 ? ((currentIncome - currentExpenses) / currentIncome) * 100 : null;
    const daysInMonth = new Date(selectedYear, selectedMonthNumber, 0).getDate();
    const days = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;
    const daysRemaining = isCurrentMonth ? Math.max(0, daysInMonth - now.getDate()) : 0;
    const balance = currentIncome - currentExpenses;
    const expenseEntries = current.filter(t => t.type === "expense");
    const distinctExpenseDays = new Set(expenseEntries.map(t => t.date)).size;
    const projectionAvailable = isCurrentMonth && expenseEntries.length >= 5 && distinctExpenseDays >= 3;
    const projectedExpenses = projectionAvailable ? currentExpenses / days * daysInMonth : null;
    const projectedBalance = projectedExpenses === null ? null : currentIncome - projectedExpenses;
    const dailySafeLimit = projectionAvailable && currentIncome > 0 && daysRemaining > 0 && balance > 0 ? balance / daysRemaining : null;
    const duplicateMap = current.filter(t => t.type === "expense").reduce<Record<string, Transaction[]>>((acc, t) => {
      const key = [t.date, t.title.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " "), Number(t.amount).toFixed(2)].join("|");
      (acc[key] ||= []).push(t);
      return acc;
    }, {});
    const possibleDuplicates = Object.values(duplicateMap).filter(group => group.length > 1).map(group => ({ title: group[0].title, date: group[0].date, amount: Number(group[0].amount), count: group.length })).slice(0, 5);
    const categoryForecast = projectionAvailable ? ranked.map(([category, amount]) => {
      const history = priorExpenses.filter(t => t.category.trim().toLocaleLowerCase("pt-BR") === category.trim().toLocaleLowerCase("pt-BR"));
      const months = new Set(history.map(t => t.date.slice(0, 7)));
      const historicalAverage = months.size >= 2 ? history.reduce((total, t) => total + Number(t.amount), 0) / months.size : null;
      const projected = amount / days * daysInMonth;
      return { category, projected, historicalAverage, difference: historicalAverage && historicalAverage > 0 ? (projected / historicalAverage - 1) * 100 : null };
    }).filter(item => item.difference !== null && item.difference > 20).sort((a, b) => (b.difference || 0) - (a.difference || 0)).slice(0, 3) : [];
    return { currentKey, previousKey, isCurrentMonth, currentIncome, currentExpenses, previousExpenses, balance, ranked, recurring, recurringTotal, unusual, change, savings, dailyAverage: currentExpenses / days, projectedExpenses, projectedBalance, projectionAvailable, daysInMonth, daysElapsed: days, daysRemaining, dailySafeLimit, possibleDuplicates, categoryForecast, count: current.length };
  }, [transactions, selectedMonth]);

  const monthName = (key: string) => { const [year, month] = key.split("-").map(Number); return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }); };
  const advice = report.count === 0
    ? `Cadastre ou importe seus lançamentos de ${monthName(report.currentKey)} para receber um diagnóstico baseado nos seus dados.`
    : report.currentExpenses > report.currentIncome && report.currentIncome > 0
      ? `As despesas de ${monthName(report.currentKey)} superam as receitas. Revise primeiro os gastos variáveis e evite assumir novas parcelas.`
      : report.change !== null && report.change > 15
        ? `Os gastos de ${monthName(report.currentKey)} cresceram mais de 15% em relação ao mês anterior. Confira as categorias com maior peso.`
        : report.savings !== null && report.savings >= 20
          ? `A taxa de economia em ${monthName(report.currentKey)} está em 20% ou mais. Mantenha esse ritmo.`
          : `Acompanhe os gastos de ${monthName(report.currentKey)} e defina um limite para a categoria que mais consome seu orçamento.`;

  return <section className="page-section diagnosis-page">
    <div className="page-heading"><div><p className="eyebrow">INTELIGÊNCIA FINANCEIRA</p><h1>Diagnóstico financeiro</h1><p className="muted-text">Análise de {monthName(report.currentKey)} com comparação histórica separada.</p></div></div>
    <div className="stats-grid">
      <div className="stat-card"><div className="stat-top"><span>Receitas do período</span><div className="stat-icon green"><ArrowDownRight size={19}/></div></div><strong className="stat-value">{formatMoney(report.currentIncome)}</strong><div className="stat-detail">Entradas em {monthName(report.currentKey)}</div></div>
      <div className="stat-card"><div className="stat-top"><span>Despesas do período</span><div className="stat-icon red"><ArrowUpRight size={19}/></div></div><strong className="stat-value">{formatMoney(report.currentExpenses)}</strong><div className="stat-detail">Média diária: {formatMoney(report.dailyAverage)}</div></div>
      <div className="stat-card"><div className="stat-top"><span>Resultado do período</span><div className="stat-icon purple"><Wallet size={19}/></div></div><strong className="stat-value">{formatMoney(report.balance)}</strong><div className="stat-detail">Receitas menos despesas</div></div>
      <div className="stat-card"><div className="stat-top"><span>Taxa de economia</span><div className="stat-icon blue"><Activity size={19}/></div></div><strong className="stat-value">{report.savings === null ? "—" : `${report.savings.toFixed(1).replace(".", ",")}%`}</strong><div className="stat-detail">Sobre as receitas de {monthName(report.currentKey)}</div></div>
    </div>
    <CentralIntelligence transactions={transactions} formatMoney={formatMoney} selectedMonth={selectedMonth}/>
    <FinancialAssistant accessToken={accessToken} selectedMonth={selectedMonth}/>
    <InvestigationPanel transactions={transactions} formatMoney={formatMoney} selectedMonth={selectedMonth}/>
    {report.isCurrentMonth && <div className="panel predictive-panel">
      <div className="panel-heading"><div><h2>Plano inteligente até o fim do mês</h2><p>Limite diário calculado com o saldo dos lançamentos registrados</p></div><TrendingUp size={18} className="subtle-icon"/></div>
      <div className="predictive-kpis">
        <div><span>Dias restantes</span><strong>{report.daysRemaining}</strong></div>
        <div><span>Limite diário indicativo</span><strong className={report.dailySafeLimit === null ? "predictive-muted" : "predictive-good"}>{report.dailySafeLimit === null ? "Indisponível" : formatMoney(report.dailySafeLimit)}</strong></div>
        <div><span>Resultado projetado</span><strong className={report.projectedBalance === null ? "predictive-muted" : report.projectedBalance < 0 ? "diagnosis-negative" : "goal-positive"}>{report.projectedBalance === null ? "Indisponível" : formatMoney(report.projectedBalance)}</strong></div>
      </div>
      {report.dailySafeLimit === null && <p className="insight-disclaimer">O limite diário só aparece com ao menos 5 despesas em 3 dias diferentes, receita registrada, resultado positivo e dias restantes. É indicativo e não representa saldo bancário.</p>}
      {report.categoryForecast.length > 0 && <div className="predictive-watch"><strong>Categorias que merecem atenção</strong>{report.categoryForecast.map(item => <div key={item.category}><span>{item.category}</span><b>Projeção {formatMoney(item.projected)} · {item.difference !== null ? `+${item.difference.toFixed(0)}%` : ""} vs. histórico</b></div>)}</div>}
      {report.possibleDuplicates.length > 0 && <div className="predictive-watch duplicate-watch"><strong>Possíveis lançamentos duplicados — confira antes de excluir</strong>{report.possibleDuplicates.map(item => <div key={item.date + item.title + item.amount}><span>{item.title} · {item.date.split("-").reverse().join("/")}</span><b>{item.count} × {formatMoney(item.amount)}</b></div>)}</div>}
      <p className="insight-disclaimer">As tendências por categoria comparam a projeção atual à média mensal dos meses anteriores disponíveis (mínimo de dois meses). Duplicidades são suspeitas por coincidência de data, descrição e valor; não são excluídas automaticamente.</p>
    </div>}
    <div className="panel preventive-alerts">
      <div className="panel-heading"><div><h2>Central de alertas preventivos</h2><p>Sinais identificados automaticamente nos seus lançamentos</p></div><ShieldAlert size={18} className="subtle-icon"/></div>
      <div className="preventive-alert-list">
        {report.count === 0 ? <div className="preventive-alert neutral"><Activity size={17}/><div><strong>Aguardando dados</strong><p>Cadastre despesas e receitas para ativar os alertas financeiros.</p></div></div> : <>
          {report.balance < 0 && <div className="preventive-alert danger"><TrendingDown size={17}/><div><strong>Resultado negativo no mês</strong><p>As despesas superam as receitas em {formatMoney(Math.abs(report.balance))} até agora.</p></div></div>}
          {report.projectedBalance !== null && report.projectedBalance < 0 && <div className="preventive-alert danger"><TrendingDown size={17}/><div><strong>Projeção de fechamento negativa</strong><p>Mantido o ritmo atual, o mês pode terminar em {formatMoney(Math.abs(report.projectedBalance))} negativo.</p></div></div>}
          {report.unusual.length > 0 && <div className="preventive-alert warning"><ShieldAlert size={17}/><div><strong>{report.unusual.length} gasto(s) fora do padrão</strong><p>Há despesas pelo menos 50% acima da média histórica da própria categoria. Confira a seção de gastos fora do padrão.</p></div></div>}
          {report.recurring.length > 0 && <div className="preventive-alert info"><Activity size={17}/><div><strong>Possíveis cobranças recorrentes identificadas</strong><p>{report.recurring.length} descrição(ões) aparecem em meses diferentes, somando média de {formatMoney(report.recurringTotal)} por mês.</p></div></div>}
          {report.balance >= 0 && report.projectedBalance !== null && report.projectedBalance >= 0 && report.unusual.length === 0 && report.recurring.length === 0 && <div className="preventive-alert positive"><Activity size={17}/><div><strong>Nenhum alerta crítico identificado</strong><p>Com os registros atuais, não há sinais de resultado negativo, gastos atípicos ou descrições recorrentes.</p></div></div>}
          {report.isCurrentMonth && report.projectedBalance === null && report.balance >= 0 && <div className="preventive-alert neutral"><Activity size={17}/><div><strong>Projeção ainda indisponível</strong><p>São necessárias ao menos 5 despesas em 3 dias diferentes para estimar o fechamento sem depender de poucos registros.</p></div></div>}
        </>}
      </div>
      <p className="insight-disclaimer">Os alertas usam somente os lançamentos cadastrados. A projeção linear só aparece com ao menos 5 despesas distribuídas em 3 dias diferentes e não considera contas futuras não cadastradas; descrições repetidas não comprovam assinaturas.</p>
    </div>
    <div className="content-grid insights-page-grid">
      <div className="panel insight-panel">
        <div className="insight-title"><div className="ai-icon"><Lightbulb size={18}/></div><div><h2>Recomendação do Finance IA</h2><p>Orientação baseada nos registros disponíveis</p></div></div>
        <div className="insight-highlight"><span className="insight-label">PONTO DE ATENÇÃO</span><strong>{report.count === 0 ? "Ainda faltam dados para analisar." : report.balance < 0 ? "Atenção: resultado negativo." : report.change !== null && report.change > 15 ? "Despesas em alta." : "Acompanhe seu ritmo financeiro."}</strong><p>{advice}</p></div>
        <div className="diagnosis-comparison"><div><span>Despesas em {monthName(report.previousKey)}</span><strong>{formatMoney(report.previousExpenses)}</strong></div><div><span>Variação mensal</span><strong className={report.change === null ? "" : report.change > 0 ? "diagnosis-negative" : "goal-positive"}>{report.change === null ? "Sem base anterior" : `${report.change > 0 ? "+" : ""}${report.change.toFixed(1).replace(".", ",")}%`}</strong></div></div>
        <p className="insight-disclaimer">Comparação do mesmo intervalo de dias do mês atual e do mês anterior. A comparação usa o mesmo intervalo de dias quando o período selecionado é o mês atual; para meses fechados, compara o mês completo. Análise informativa.</p>
      </div>
      {report.isCurrentMonth && <div className="panel diagnosis-forecast">
        <div className="insight-title"><div className="ai-icon"><TrendingUp size={18}/></div><div><h2>Projeção de fechamento</h2><p>Estimativa pelo ritmo de gastos atual</p></div></div>
        <div className="diagnosis-forecast-grid"><div><span>Despesas estimadas no fim do mês</span><strong>{report.projectedExpenses === null ? "Indisponível" : formatMoney(report.projectedExpenses)}</strong></div><div><span>Saldo estimado no fim do mês</span><strong className={report.projectedBalance === null ? "predictive-muted" : report.projectedBalance < 0 ? "diagnosis-negative" : "goal-positive"}>{report.projectedBalance === null ? "Indisponível" : formatMoney(report.projectedBalance)}</strong></div></div>
        <p className="insight-disclaimer">{report.projectionAvailable ? `Projeção linear baseada em ${report.daysElapsed} de ${report.daysInMonth} dias e em pelo menos 5 despesas distribuídas em 3 dias. Não considera contas futuras ainda não cadastradas nem mudanças no padrão de consumo.` : "Projeção indisponível: faltam despesas distribuídas em pelo menos 3 dias diferentes."}</p>
      </div>}
      <div className="panel recurring-panel">
        <div className="panel-heading"><div><h2>Possíveis gastos recorrentes</h2><p>Identificados pelo mesmo nome em meses diferentes</p></div><ShieldAlert size={18} className="subtle-icon"/></div>
        {report.recurring.length === 0 ? <div className="empty-state compact">Ainda não há lançamentos suficientes com o mesmo nome em pelo menos dois meses.</div> : <>
          <div className="recurring-total"><span>Média mensal dos itens identificados</span><strong>{formatMoney(report.recurringTotal)}</strong></div>
          <div className="recurring-list">{report.recurring.map(item => <div className="recurring-item" key={item.title}><div><strong>{item.title}</strong><small>{item.count} lançamento(s) em {item.months.size} mês(es)</small></div><b>{formatMoney(item.monthlyAverage)}/mês</b></div>)}</div>
        </>}
        <p className="insight-disclaimer">Detecção aproximada por descrição repetida; não confirma que seja assinatura ou cobrança automática. Valores são médias dos meses encontrados.</p>
      </div>
      <div className="panel unusual-panel">
        <div className="panel-heading"><div><h2>Gastos fora do padrão</h2><p>Compras pelo menos 50% acima da média da categoria</p></div><ShieldAlert size={18} className="subtle-icon"/></div>
        {report.unusual.length === 0 ? <div className="empty-state compact">Nenhum gasto fora do padrão foi identificado com os dados disponíveis.</div> : <div className="unusual-list">{report.unusual.map(item => <div className="unusual-item" key={item.id}><div><strong>{item.title}</strong><small>{item.category} · média histórica: {formatMoney(item.categoryAverage)}</small></div><div><b>{formatMoney(item.amount)}</b><small className="unusual-difference">+{item.difference.toFixed(0)}% acima da média</small></div></div>)}</div>}
        <p className="insight-disclaimer">Compara cada despesa atual com pelo menos três lançamentos da mesma categoria nos três meses anteriores. É um alerta estatístico, não significa necessariamente erro ou desperdício.</p>
      </div>
      <div className="panel goals-panel">
        <div className="panel-heading"><div><h2>Onde você mais gasta</h2><p>Despesas por categoria em {monthName(report.currentKey)}</p></div><Activity size={18} className="subtle-icon"/></div>
        {report.ranked.length === 0 ? <div className="empty-state compact">Nenhuma despesa registrada em {monthName(report.currentKey)}.</div> : <div className="category-list">{report.ranked.slice(0, 6).map(([category, amount], index) => { const percent = report.currentExpenses ? amount / report.currentExpenses * 100 : 0; const colors = ["#8e7cff", "#35c99a", "#f3b85b", "#5ca9ff", "#e879a9", "#b48cff"]; return <div className="category-item" key={category}><div className="category-top"><span><i style={{ background: colors[index % colors.length] }}/>{category}</span><strong>{formatMoney(amount)}</strong></div><div className="progress-track"><div style={{ width: `${percent}%`, background: colors[index % colors.length] }}/></div><small>{percent.toFixed(1).replace(".", ",")}% das despesas</small></div>; })}</div>}
      </div>
    </div>
  </section>;
}
