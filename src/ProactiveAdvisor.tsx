import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck, Sparkles, Target } from "lucide-react";
import { filterRealizedTransactions, filterScheduledTransactions } from "./lib/financial-core";

type Transaction = { id: string; title: string; category: string; date: string; amount: number; type: "income" | "expense" };
type Props = { transactions: Transaction[]; formatMoney: (value: number) => string; selectedMonth: string };

export default function ProactiveAdvisor({ transactions, formatMoney, selectedMonth }: Props) {
  const result = useMemo(() => {
    const now = new Date();
    const [year, monthNumber] = selectedMonth.split("-").map(Number);
    const isCurrentMonth = year === now.getFullYear() && monthNumber === now.getMonth() + 1;
    const todayKey = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
    const currentMonthKey = todayKey.slice(0, 7);
    const includeOnlyRealized = selectedMonth >= currentMonthKey;
    const selectedTransactions = transactions.filter(t => t.date.startsWith(selectedMonth) && Number.isFinite(Number(t.amount)) && Number(t.amount) >= 0);
    const month = filterRealizedTransactions(selectedTransactions);
    const scheduled = filterScheduledTransactions(selectedTransactions);
    const scheduledCount = scheduled.length;
    const scheduledIncome = scheduled.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
    const scheduledExpenses = scheduled.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
    const income = month.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
    const expenses = month.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
    const expenseEntries = month.filter(t => t.type === "expense");
    const distinctExpenseDays = new Set(expenseEntries.map(t => t.date)).size;
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    const daysElapsed = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;
    const projectionHasMinimumEvidence = isCurrentMonth && expenseEntries.length >= 5 && distinctExpenseDays >= 3;
    const projected = expenses / daysElapsed * daysInMonth;
    const categories = month.filter(t => t.type === "expense").reduce<Record<string, number>>((acc, t) => {
      const category = t.category?.trim() || "Sem categoria";
      acc[category] = (acc[category] || 0) + Number(t.amount);
      return acc;
    }, {});
    const top = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
    const share = top && expenses > 0 ? top[1] / expenses * 100 : 0;
    let level: "critical" | "warning" | "positive" | "neutral" = "neutral";
    let title = "Vamos construir seu diagnóstico";
    let action = "Registre suas receitas e despesas para que o Finance IA identifique padrões reais e priorize o que merece atenção.";
    let evidence = `Ainda não há lançamentos suficientes em ${new Date(year, monthNumber - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })} para uma recomendação personalizada.`;
    if (month.length > 0 && income === 0 && expenses > 0 && scheduledIncome > 0) {
      title = "Há receitas agendadas, mas ainda não realizadas";
      action = "As receitas futuras já estão cadastradas. Até hoje, porém, nenhuma entrada foi realizada; acompanhe a confirmação desses recebimentos.";
      evidence = `${formatMoney(expenses)} em despesas realizadas e ${formatMoney(scheduledIncome)} em receitas agendadas. As receitas futuras não entram no resultado realizado.`;
    } else if (month.length > 0 && income === 0 && expenses > 0) {
      title = "Ainda não há receitas realizadas neste período";
      action = "Confira se sua renda já foi cadastrada com a data correta. O diagnóstico considera como realizada somente uma receita com data até hoje.";
      evidence = `${month.length} lançamento(s) realizado(s), com ${formatMoney(expenses)} em despesas e nenhuma receita realizada no período selecionado.`;
    } else if (income > 0 && expenses > income) {
      level = "critical";
      title = "As despesas já passaram das receitas";
      action = "Pause novas compras parceladas e revise primeiro os gastos variáveis. Confira também se todas as receitas foram registradas.";
      evidence = `Resultado mensal de ${formatMoney(income - expenses)}. Foram registrados ${formatMoney(income)} em receitas e ${formatMoney(expenses)} em despesas.`;
    } else if (income > 0 && expenses > 0 && projectionHasMinimumEvidence && projected > income) {
      level = "warning";
      title = "O ritmo atual pode fechar o mês no vermelho";
      action = "Defina um teto para os próximos gastos e acompanhe as despesas nos próximos dias. A projeção muda conforme novos registros entram.";
      evidence = `Mantido o ritmo médio de ${formatMoney(expenses / daysElapsed)} por dia, as despesas chegariam a cerca de ${formatMoney(projected)} até o fim do mês, acima das receitas registradas de ${formatMoney(income)}.`;
    } else if (top && share >= 40) {
      level = "warning";
      title = `${top[0]} concentra boa parte dos gastos`;
      action = `Revise os lançamentos de ${top[0]} e separe o que é essencial do que pode ser ajustado. Não corte despesas necessárias sem avaliar o contexto.`;
      evidence = `${top[0]} representa ${share.toFixed(0)}% das despesas registradas: ${formatMoney(top[1])} de ${formatMoney(expenses)}.`;
    } else if (month.length > 0) {
      level = "positive";
      title = "Nenhum risco prioritário apareceu nos registros";
      action = "Continue registrando as movimentações e mantenha uma reserva para imprevistos. O diagnóstico melhora com dados completos.";
      evidence = `${formatMoney(income)} em receitas e ${formatMoney(expenses)} em despesas registrados no período selecionado.`;
      if (isCurrentMonth && income > expenses && expenses > 0 && !projectionHasMinimumEvidence) {
        evidence += ` A projeção de fechamento foi omitida: são necessários ao menos 5 despesas distribuídas em 3 dias diferentes para reduzir o risco de um alerta baseado em poucos registros.`;
      }
    }
    return { level, title, action, evidence, income, expenses, count: month.length, scheduledCount, scheduledIncome, scheduledExpenses, top, share };
  }, [transactions, formatMoney, selectedMonth]);

  return <section className={`panel proactive-advisor ${result.level}`}>
    <div className="proactive-head"><div className="insight-title"><div className="ai-icon"><Sparkles size={18}/></div><div><h2>Consultor financeiro proativo</h2><p>Uma prioridade clara para {new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p></div></div><span className="proactive-status">{result.level === "critical" ? "PRIORIDADE ALTA" : result.level === "warning" ? "ATENÇÃO" : result.level === "positive" ? "ESTÁVEL" : "AGUARDANDO DADOS"}</span></div>
    <div className="proactive-main">
      <div className="proactive-symbol">{result.level === "critical" || result.level === "warning" ? <AlertTriangle size={19}/> : result.level === "positive" ? <ShieldCheck size={19}/> : <Target size={19}/>}</div>
      <div><span className="insight-label">RECOMENDAÇÃO PRINCIPAL</span><h3>{result.title}</h3><p>{result.action}</p></div>
    </div>
    <div className="proactive-evidence"><strong><CheckCircle2 size={14}/> Evidência</strong><p>{result.evidence}</p></div>
    <div className="proactive-footer"><span>{result.count} lançamento(s) realizado(s){result.scheduledCount > 0 ? ` · ${result.scheduledCount} agendado(s): ${formatMoney(result.scheduledIncome)} em receitas e ${formatMoney(result.scheduledExpenses)} em despesas` : ""}</span><span>Não representa saldo bancário</span></div>
  </section>;
}
