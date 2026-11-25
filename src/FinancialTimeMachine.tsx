import { useMemo, useState } from "react";
import { Clock3, TrendingUp, TrendingDown, Sparkles, AlertTriangle } from "lucide-react";
import { parseBrazilianMoney } from "./lib/money";

type Transaction = { date: string; amount: number; type: "income" | "expense" };
type Props = { transactions: Transaction[]; formatMoney: (value: number) => string };

export default function FinancialTimeMachine({ transactions, formatMoney }: Props) {
  const [horizon, setHorizon] = useState("12");
  const [monthlyAdjustment, setMonthlyAdjustment] = useState("200");
  const [unexpectedExpense, setUnexpectedExpense] = useState("0");

  const history = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 6 + index, 1);
      return { key: date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0"), income: 0, expenses: 0, count: 0 };
    });
    const map = new Map(buckets.map(item => [item.key, item]));
    transactions.forEach(item => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return;
      const bucket = map.get(item.date.slice(0, 7));
      const amount = Number(item.amount);
      if (!bucket || !Number.isFinite(amount) || amount < 0) return;
      if (item.type === "income") bucket.income += amount;
      if (item.type === "expense") bucket.expenses += amount;
      bucket.count += 1;
    });
    const active = buckets.filter(item => item.count > 0);
    const income = active.length ? active.reduce((sum, item) => sum + item.income, 0) / active.length : 0;
    const expenses = active.length ? active.reduce((sum, item) => sum + item.expenses, 0) / active.length : 0;
    return { income, expenses, net: income - expenses, months: active.length };
  }, [transactions]);

  const months = Number(horizon);
  const adjustmentValue = parseBrazilianMoney(monthlyAdjustment);
  const shockValue = parseBrazilianMoney(unexpectedExpense);
  const adjustment = adjustmentValue ?? 0;
  const shock = shockValue ?? 0;
  const hasHistory = history.months > 0;
  const validAmounts = adjustmentValue !== null && shockValue !== null && adjustment >= 0 && shock >= 0;
  const baseline = history.net * months;
  const improved = (history.net + adjustment) * months - shock;
  const futureIncome = history.income * months;
  const futureExpenses = history.expenses * months + shock;
  const scenarioDifference = improved - baseline;
  const moneyInput = (value: string, setter: (value: string) => void) => (
    <input inputMode="decimal" value={value} onChange={event => setter(event.target.value)} />
  );

  return <section className="panel time-machine-panel">
    <div className="insight-title"><div className="ai-icon"><Clock3 size={18}/></div><div><h2>Máquina do Tempo Financeira</h2><p>Veja cenários possíveis para suas finanças nos próximos meses</p></div></div>
    {!hasHistory ? <div className="time-machine-empty"><AlertTriangle size={18}/><div><strong>Precisamos de mais dados</strong><p>Registre receitas e despesas para projetar seu cenário. A análise usa até seis meses de lançamentos disponíveis.</p></div></div> : !validAmounts ? <div className="time-machine-empty"><AlertTriangle size={18}/><div><strong>Confira os valores informados</strong><p>Use valores válidos e não negativos, como 1.500,00.</p></div></div> : <>
      <div className="time-machine-fields">
        <label>Projetar período<select value={horizon} onChange={event => setHorizon(event.target.value)}><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option></select></label>
        <label>Quanto pretende economizar a mais por mês (R$){moneyInput(monthlyAdjustment, setMonthlyAdjustment)}</label>
        <label>Despesa inesperada simulada (R$){moneyInput(unexpectedExpense, setUnexpectedExpense)}</label>
      </div>
      <div className="time-machine-baseline"><span>Seu ritmo médio mensal registrado</span><div><small>Receitas</small><strong>{formatMoney(history.income)}</strong></div><div><small>Despesas</small><strong>{formatMoney(history.expenses)}</strong></div><div><small>Resultado</small><strong className={history.net < 0 ? "time-negative" : "time-positive"}>{formatMoney(history.net)}</strong></div></div>
      <div className="time-machine-results">
        <div><span>Se continuar no ritmo atual</span><strong className={baseline < 0 ? "time-negative" : "time-positive"}>{formatMoney(baseline)}</strong><small>Resultado acumulado estimado em {months} meses</small></div>
        <div><span>Com a economia adicional</span><strong className={improved < 0 ? "time-negative" : "time-positive"}>{formatMoney(improved)}</strong><small>Após considerar a despesa inesperada informada</small></div>
      </div>
      <div className="time-machine-delta"><Sparkles size={17}/><div><strong>Impacto da sua mudança: {formatMoney(scenarioDifference)}</strong><p>Economizar {formatMoney(adjustment)} a mais por mês representa {formatMoney(adjustment * months)} no período. A despesa inesperada de {formatMoney(shock)} é aplicada uma única vez.</p></div></div>
      <div className="time-machine-details"><div><span>Receitas projetadas</span><b>{formatMoney(futureIncome)}</b></div><div><span>Despesas projetadas, incluindo imprevisto</span><b>{formatMoney(futureExpenses)}</b></div><div><span>Meses com dados usados</span><b>{history.months} de até 6</b></div></div>
      {history.net < 0 && <p className="time-machine-warning"><TrendingDown size={15}/> Seu histórico indica despesas médias maiores que receitas. O cenário futuro mantém esse padrão, a menos que você ajuste receitas ou despesas.</p>}
      {history.net >= 0 && <p className="time-machine-warning positive"><TrendingUp size={15}/> O resultado é uma projeção contábil baseada nos registros, não representa saldo bancário ou dinheiro garantido disponível.</p>}
      <p className="insight-disclaimer">Modelo simplificado: usa a média dos até seis meses completos anteriores que tenham registros. Meses sem lançamentos ficam fora da média, mas isso não comprova que os demais meses estejam completos. Não prevê inflação, juros, impostos, sazonalidade, mudanças de renda nem compromissos não cadastrados.</p>
    </>}
  </section>;
}
