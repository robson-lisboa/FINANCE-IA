import { useMemo, useState } from "react";
import { Calculator, AlertTriangle, CheckCircle2, TrendingUp, CalendarClock } from "lucide-react";

type Transaction = { date: string; amount: number; type: "income" | "expense" };
type Props = { transactions: Transaction[]; formatMoney: (value: number) => string };

export default function PurchaseSimulator({ transactions, formatMoney }: Props) {
  const [cashPrice, setCashPrice] = useState("1500");
  const [installmentTotal, setInstallmentTotal] = useState("1500");
  const [installments, setInstallments] = useState("12");
  const [mode, setMode] = useState<"cash" | "installment">("cash");
  const [horizon, setHorizon] = useState<"3" | "6" | "12">("6");

  const parseMoney = (value: string) => Number(value.replace(/\\./g, "").replace(",", "."));
  const cash = parseMoney(cashPrice);
  const total = parseMoney(installmentTotal);
  const count = Math.min(48, Math.max(1, Number(installments) || 1));
  const valid = Number.isFinite(cash) && cash > 0 && cash <= 10000000 &&
    (mode === "cash" || (Number.isFinite(total) && total > 0 && total <= 10000000));

  const history = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 3 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 2 + index, 1);
      return { key: date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0"), income: 0, expenses: 0, entries: 0 };
    });
    const map = new Map(months.map(month => [month.key, month]));
    transactions.forEach(item => {
      const month = item.date?.slice(0, 7);
      const bucket = map.get(month);
      const value = Number(item.amount);
      if (!bucket || !Number.isFinite(value)) return;
      if (item.type === "income") bucket.income += value;
      if (item.type === "expense") bucket.expenses += value;
      bucket.entries += 1;
    });
    const populated = months.filter(month => month.entries > 0);
    const income = populated.length ? populated.reduce((sum, month) => sum + month.income, 0) / populated.length : 0;
    const expenses = populated.length ? populated.reduce((sum, month) => sum + month.expenses, 0) / populated.length : 0;
    const currentKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    const current = map.get(currentKey)!;
    return { income, expenses, margin: income - expenses, populated: populated.length, currentIncome: current.income, currentExpenses: current.expenses, currentEntries: current.entries };
  }, [transactions]);

  const monthlyPayment = mode === "cash" ? cash : total / count;
  const finalCost = mode === "cash" ? cash : total;
  const extraCost = mode === "installment" ? Math.max(0, total - cash) : 0;
  const months = Number(horizon);
  const projectedBaseline = history.margin * months;
  const projectedPurchase = projectedBaseline - (mode === "cash" ? cash : monthlyPayment * months);
  const purchaseImpact = mode === "cash" ? cash : monthlyPayment * months;
  const currentMonthImpact = history.currentIncome - history.currentExpenses - (mode === "cash" ? cash : monthlyPayment);
  const hasData = history.populated > 0;
  const affordable = hasData && projectedPurchase >= 0;
  const installmentCoverage = count > 0 ? (history.margin - monthlyPayment) : history.margin;

  return <section className="panel purchase-simulator">
    <div className="insight-title"><div className="ai-icon"><Calculator size={18}/></div><div><h2>Simulador de decisões inteligentes</h2><p>Compare o custo real e o efeito da compra nos próximos meses</p></div></div>
    <div className="simulator-fields">
      <label>Preço à vista (R$)<input inputMode="decimal" value={cashPrice} onChange={event => { setCashPrice(event.target.value); if (mode === "installment" && installmentTotal === cashPrice) setInstallmentTotal(event.target.value); }} placeholder="Ex.: 1500,00"/></label>
      <label>Forma de pagamento<select value={mode} onChange={event => setMode(event.target.value as "cash" | "installment")}><option value="cash">À vista</option><option value="installment">Parcelado</option></select></label>
      {mode === "installment" && <>
        <label>Total final parcelado (R$)<input inputMode="decimal" value={installmentTotal} onChange={event => setInstallmentTotal(event.target.value)} placeholder="Total com juros"/></label>
        <label>Número de parcelas<select value={installments} onChange={event => setInstallments(event.target.value)}>{[2,3,4,5,6,8,10,12,18,24,36,48].map(value => <option key={value} value={value}>{value}x</option>)}</select></label>
      </>}
      <label>Período da projeção<select value={horizon} onChange={event => setHorizon(event.target.value as "3" | "6" | "12")}><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option></select></label>
    </div>
    {!valid ? <p className="simulator-warning"><AlertTriangle size={16}/> Informe valores válidos para simular.</p> : <>
      <div className="simulator-results">
        <div><span>{mode === "cash" ? "Desembolso à vista" : "Parcela mensal"}</span><strong>{formatMoney(monthlyPayment)}</strong></div>
        <div><span>Custo total da compra</span><strong>{formatMoney(finalCost)}</strong></div>
        {mode === "installment" && <div><span>Juros / custo extra informado</span><strong className={extraCost > 0 ? "simulator-negative" : "simulator-positive"}>{formatMoney(extraCost)}</strong></div>}
        <div><span>Resultado projetado em {months} meses</span><strong className={projectedPurchase < 0 ? "simulator-negative" : "simulator-positive"}>{formatMoney(projectedPurchase)}</strong></div>
      </div>
      <div className={affordable ? "simulator-verdict simulator-ok" : "simulator-verdict simulator-caution"}>
        {affordable ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}
        <div><strong>{!hasData ? "Ainda faltam dados para avaliar" : affordable ? "A projeção suporta esta compra" : "A compra pode pressionar seu orçamento"}</strong>
          <p>{!hasData ? "Registre receitas e despesas para criar uma projeção baseada no seu histórico." : "A simulação usa a média de " + history.populated + " mês(es) com lançamentos nos últimos 3 meses. " + (mode === "cash" ? "O valor à vista é descontado uma única vez." : "A parcela é considerada mensalmente durante o período escolhido.") + " Isso é uma estimativa, não uma garantia de sobra de dinheiro."}</p>
        </div>
      </div>
      <div className="decision-comparison">
        <div><span><TrendingUp size={14}/> Margem média mensal registrada</span><strong>{formatMoney(history.margin)}</strong></div>
        <div><span><CalendarClock size={14}/> Margem estimada após a compra neste mês</span><strong className={currentMonthImpact < 0 ? "simulator-negative" : "simulator-positive"}>{formatMoney(currentMonthImpact)}</strong></div>
        {mode === "installment" && <div><span>Compromisso após o fim das parcelas</span><strong>{formatMoney(history.margin)}</strong></div>}
      </div>
      <p className="simulator-disclaimer">Base: {history.currentEntries} lançamento(s) no mês atual e média dos últimos 3 meses com dados. A projeção pressupõe receitas e despesas semelhantes às registradas. Não consulta saldo bancário, faturas futuras, parcelas antigas não cadastradas ou condições completas do contrato. Confira também reserva de emergência e vencimentos.</p>
    </>}
  </section>;
}
