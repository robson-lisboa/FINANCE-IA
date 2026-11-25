import { useMemo, useState } from "react";
import { Calculator, AlertTriangle, CheckCircle2, TrendingUp, CalendarClock } from "lucide-react";
import { parseBrazilianMoney } from "./lib/money-core.js";

type Transaction = { date: string; amount: number; type: "income" | "expense" };
type Props = { transactions: Transaction[]; formatMoney: (value: number) => string };

export default function PurchaseSimulator({ transactions, formatMoney }: Props) {
  const [cashPrice, setCashPrice] = useState("1500");
  const [installmentTotal, setInstallmentTotal] = useState("1500");
  const [installments, setInstallments] = useState("12");
  const [mode, setMode] = useState<"cash" | "installment">("cash");
  const [horizon, setHorizon] = useState<"3" | "6" | "12">("6");

  const cash = parseBrazilianMoney(cashPrice);
  const total = parseBrazilianMoney(installmentTotal);
  const count = Number(installments);
  const valid = cash !== null && cash > 0 && cash <= 10000000 &&
    Number.isInteger(count) && count >= 1 && count <= 48 &&
    (mode === "cash" || (total !== null && total > 0 && total <= 10000000));
  const cashAmount = cash ?? 0;
  const totalAmount = total ?? 0;

  const history = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 3 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 3 + index, 1);
      return { key: date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0"), income: 0, expenses: 0, entries: 0 };
    });
    const map = new Map(months.map(month => [month.key, month]));
    transactions.forEach(item => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date || "")) return;
      const bucket = map.get(item.date.slice(0, 7));
      const value = Number(item.amount);
      if (!bucket || !Number.isFinite(value) || value < 0) return;
      if (item.type === "income") bucket.income += value;
      else if (item.type === "expense") bucket.expenses += value;
      else return;
      bucket.entries += 1;
    });
    const populated = months.filter(month => month.entries > 0);
    const income = populated.length ? populated.reduce((sum, month) => sum + month.income, 0) / populated.length : 0;
    const expenses = populated.length ? populated.reduce((sum, month) => sum + month.expenses, 0) / populated.length : 0;
    const currentKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    const current = transactions.filter(item =>
      item.date?.startsWith(currentKey) &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
      Number.isFinite(Number(item.amount)) && Number(item.amount) >= 0 &&
      (item.type === "income" || item.type === "expense")
    );
    const currentIncome = current.filter(item => item.type === "income").reduce((sum, item) => sum + Number(item.amount), 0);
    const currentExpenses = current.filter(item => item.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
    return { income, expenses, margin: income - expenses, populated: populated.length, currentIncome, currentExpenses, currentEntries: current.length };
  }, [transactions]);

  const monthlyPayment = mode === "cash" ? cashAmount : totalAmount / count;
  const finalCost = mode === "cash" ? cashAmount : totalAmount;
  const extraCost = mode === "installment" ? Math.max(0, totalAmount - cashAmount) : 0;
  const months = Number(horizon);
  const projectedBaseline = history.margin * months;
  const installmentMonthsInHorizon = Math.min(months, count);
  const projectedPurchase = projectedBaseline - (mode === "cash" ? cashAmount : monthlyPayment * installmentMonthsInHorizon);
  const currentMonthImpact = history.currentIncome - history.currentExpenses - monthlyPayment;
  const hasData = history.populated > 0;
  const projectedPositive = hasData && projectedPurchase >= 0;

  return <section className="panel purchase-simulator">
    <div className="insight-title"><div className="ai-icon"><Calculator size={18}/></div><div><h2>Simulador de decisões inteligentes</h2><p>Compare o custo e o impacto estimado da compra</p></div></div>
    <div className="simulator-fields">
      <label>Preço à vista (R$)<input inputMode="decimal" value={cashPrice} onChange={event => { setCashPrice(event.target.value); if (mode === "installment" && installmentTotal === cashPrice) setInstallmentTotal(event.target.value); }} placeholder="Ex.: 1.500,00"/></label>
      <label>Forma de pagamento<select value={mode} onChange={event => setMode(event.target.value as "cash" | "installment")}><option value="cash">À vista</option><option value="installment">Parcelado</option></select></label>
      {mode === "installment" && <>
        <label>Total final parcelado (R$)<input inputMode="decimal" value={installmentTotal} onChange={event => setInstallmentTotal(event.target.value)} placeholder="Total com juros"/></label>
        <label>Número de parcelas<select value={installments} onChange={event => setInstallments(event.target.value)}>{[2,3,4,5,6,8,10,12,18,24,36,48].map(value => <option key={value} value={value}>{value}x</option>)}</select></label>
      </>}
      <label>Período da projeção<select value={horizon} onChange={event => setHorizon(event.target.value as "3" | "6" | "12")}><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option></select></label>
    </div>
    {!valid ? <p className="simulator-warning"><AlertTriangle size={16}/> Informe valores válidos. Use, por exemplo, 1.500,00 e confira o total parcelado.</p> : <>
      <div className="simulator-results">
        <div><span>{mode === "cash" ? "Desembolso à vista" : "Parcela mensal"}</span><strong>{formatMoney(monthlyPayment)}</strong></div>
        <div><span>Custo total da compra</span><strong>{formatMoney(finalCost)}</strong></div>
        {mode === "installment" && <div><span>Juros / custo extra informado</span><strong className={extraCost > 0 ? "simulator-negative" : "simulator-positive"}>{formatMoney(extraCost)}</strong></div>}
        <div><span>Resultado projetado em {months} meses</span><strong className={projectedPurchase < 0 ? "simulator-negative" : "simulator-positive"}>{hasData ? formatMoney(projectedPurchase) : "Sem histórico"}</strong></div>
      </div>
      <div className={projectedPositive ? "simulator-verdict simulator-ok" : "simulator-verdict simulator-caution"}>
        {projectedPositive ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}
        <div><strong>{!hasData ? "Ainda faltam dados históricos" : projectedPositive ? "A projeção contábil fica positiva" : "A compra pode pressionar o resultado projetado"}</strong>
          <p>{!hasData ? "São necessários registros em meses anteriores para estimar uma margem mensal." : "A projeção usa " + history.populated + " mês(es) anterior(es) com lançamentos. Resultado positivo não comprova que há dinheiro disponível nem considera todas as contas futuras."}</p>
        </div>
      </div>
      <div className="decision-comparison">
        <div><span><TrendingUp size={14}/> Margem média mensal registrada</span><strong>{hasData ? formatMoney(history.margin) : "Sem histórico"}</strong></div>
        <div><span><CalendarClock size={14}/> Resultado parcial do mês após a compra</span><strong className={currentMonthImpact < 0 ? "simulator-negative" : "simulator-positive"}>{formatMoney(currentMonthImpact)}</strong></div>
      </div>
      <p className="simulator-disclaimer">Base: {history.currentEntries} lançamento(s) no mês atual e média dos 3 meses completos anteriores que tenham registros. Meses sem lançamentos não entram na média; os registros podem estar incompletos. A projeção não consulta saldo bancário, faturas futuras, parcelas antigas não cadastradas ou condições completas do contrato. Confira reserva de emergência e vencimentos.</p>
    </>}
  </section>;
}
