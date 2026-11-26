import { useMemo, useState } from "react";
import { AlertTriangle, ShieldCheck, ShieldAlert, Activity } from "lucide-react";
import { parseBrazilianMoney } from "./lib/money-core.js";
import { filterRealizedTransactions } from "./lib/financial-core";

type Transaction = { id: string; title: string; category: string; date: string; amount: number; type: "income" | "expense" };
type Props = { transactions: Transaction[]; formatMoney: (value: number) => string };

export default function FinancialStressTest({ transactions, formatMoney }: Props) {
  const [shock, setShock] = useState("2000");
  const [incomeDrop, setIncomeDrop] = useState(20);
  const [extraMonthly, setExtraMonthly] = useState("300");
  const [horizon, setHorizon] = useState(3);

  const history = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 3 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 3 + index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const rows = filterRealizedTransactions(transactions).filter(t => t.date.startsWith(key) && Number.isFinite(Number(t.amount)));
      return {
        key,
        income: rows.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0),
        expenses: rows.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0),
        count: rows.length
      };
    }).filter(month => month.count > 0);
    if (months.length < 2) return null;
    return {
      months: months.length,
      income: months.reduce((sum, month) => sum + month.income, 0) / months.length,
      expenses: months.reduce((sum, month) => sum + month.expenses, 0) / months.length,
      labels: months.map(month => month.key)
    };
  }, [transactions]);

  const result = useMemo(() => {
    if (!history) return null;
    const oneOffValue = parseBrazilianMoney(shock);
    const monthlyExtraValue = parseBrazilianMoney(extraMonthly);
    if (oneOffValue === null || monthlyExtraValue === null || oneOffValue < 0 || monthlyExtraValue < 0) return null;
    const oneOff = oneOffValue;
    const monthlyExtra = monthlyExtraValue;
    const income = history.income * (1 - incomeDrop / 100);
    const expenses = history.expenses + monthlyExtra;
    const monthlyResult = income - expenses;
    const firstMonth = monthlyResult - oneOff;
    const total = monthlyResult * horizon - oneOff;
    const baseline = history.income - history.expenses;
    const recoveryMonths = monthlyResult > 0 ? Math.ceil(oneOff / monthlyResult) : null;
    const breakEvenDrop = history.income > 0 ? Math.max(0, Math.min(100, (history.income - history.expenses) / history.income * 100)) : 0;
    return { oneOff, monthlyExtra, income, expenses, monthlyResult, firstMonth, total, baseline, recoveryMonths, breakEvenDrop };
  }, [history, shock, extraMonthly, incomeDrop, horizon]);

  return <section className="panel stress-test-panel">
    <div className="panel-heading">
      <div><h2>Teste de resistência financeira</h2><p>Descubra como seu orçamento reagiria a um imprevisto antes que ele aconteça.</p></div>
      <ShieldAlert size={19} className="subtle-icon"/>
    </div>
    {!history ? <div className="stress-empty"><Activity size={20}/><div><strong>Precisamos de mais histórico</strong><p>Registre receitas e despesas em pelo menos dois dos últimos três meses fechados para simular cenários com uma base mais confiável.</p></div></div> : <>
      <div className="stress-history-note"><ShieldCheck size={15}/> Base: média de {history.months} meses com lançamentos · Receita {formatMoney(history.income)} · Despesas {formatMoney(history.expenses)}</div>
      <div className="stress-input-grid">
        <label>Despesa inesperada (uma vez)<input inputMode="decimal" value={shock} onChange={event => setShock(event.target.value)} placeholder="Ex.: 2000"/></label>
        <label>Nova despesa mensal<input inputMode="decimal" value={extraMonthly} onChange={event => setExtraMonthly(event.target.value)} placeholder="Ex.: 300"/></label>
        <label>Queda de renda simulada <strong>{incomeDrop}%</strong><input type="range" min="0" max="100" step="5" value={incomeDrop} onChange={event => setIncomeDrop(Number(event.target.value))}/></label>
        <label>Período do teste<select value={horizon} onChange={event => setHorizon(Number(event.target.value))}><option value={1}>1 mês</option><option value={3}>3 meses</option><option value={6}>6 meses</option><option value={12}>12 meses</option></select></label>
      </div>
      {!result ? <p className="debt-warning" role="alert">Informe valores válidos e não negativos, por exemplo 1.500,00.</p> : <><div className="stress-results">
        <div><span>Resultado mensal sem crise</span><strong className={result!.baseline >= 0 ? "stress-good" : "stress-bad"}>{formatMoney(result!.baseline)}</strong></div>
        <div><span>Resultado mensal no cenário</span><strong className={result!.monthlyResult >= 0 ? "stress-good" : "stress-bad"}>{formatMoney(result!.monthlyResult)}</strong></div>
        <div><span>Resultado acumulado em {horizon} {horizon === 1 ? "mês" : "meses"}</span><strong className={result!.total >= 0 ? "stress-good" : "stress-bad"}>{formatMoney(result!.total)}</strong></div>
      </div>
      <div className={result!.firstMonth < 0 ? "stress-verdict stress-danger" : "stress-verdict stress-safe"}>
        {result!.firstMonth < 0 ? <AlertTriangle size={19}/> : <ShieldCheck size={19}/>}
        <div><strong>{result!.firstMonth < 0 ? "O primeiro mês ficaria no vermelho neste cenário." : "O primeiro mês ainda fecha positivo neste cenário."}</strong>
          <p>Incluindo o imprevisto, o resultado estimado do primeiro mês seria {formatMoney(result!.firstMonth)}. {result!.recoveryMonths === null ? "Com esse nível de renda e despesas, o orçamento não recuperaria o imprevisto por sobra mensal." : result!.oneOff > 0 ? `Mantida a sobra mensal, seriam aproximadamente ${result!.recoveryMonths} mês(es) para compensar o imprevisto.` : "Nenhuma despesa inesperada foi considerada."}</p>
        </div>
      </div>
      <div className="stress-threshold"><span>Queda de renda que consumiria toda a sobra média atual</span><strong>{result!.breakEvenDrop.toFixed(1).replace(".", ",")}%</strong></div>
      <p className="insight-disclaimer">Simulação matemática baseada na média dos últimos três meses fechados que têm lançamentos registrados (inclusive meses sem receita). Não representa saldo bancário, reserva disponível nem previsão garantida. Lançamentos ausentes e sazonalidade podem alterar o resultado.</p>
    </>}
    </>}
  </section>;
}
