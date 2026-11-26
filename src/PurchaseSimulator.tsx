import { useMemo, useState } from "react";
import { Calculator, AlertTriangle, CheckCircle2, TrendingUp, Info } from "lucide-react";
import { parseBrazilianMoney } from "./lib/money-core.js";

type Transaction = { date: string; amount: number; type: "income" | "expense" };
type Props = { transactions: Transaction[]; formatMoney: (value: number) => string; selectedMonth: string };

function labelMonth(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export default function PurchaseSimulator({ transactions, formatMoney, selectedMonth }: Props) {
  const [cashPrice, setCashPrice] = useState("");
  const [installmentTotal, setInstallmentTotal] = useState("");
  const [installments, setInstallments] = useState("12");

  const cash = parseBrazilianMoney(cashPrice);
  const total = parseBrazilianMoney(installmentTotal);
  const count = Number(installments);
  const validCash = cash !== null && cash > 0 && cash <= 10000000;
  const validInstallments = total !== null && total > 0 && total <= 10000000 &&
    Number.isInteger(count) && count >= 2 && count <= 48;
  const monthlyPayment = validInstallments ? total / count : 0;
  const extraCost = validCash && validInstallments ? total - cash : 0;

  const history = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const selectedDate = new Date(year, month - 1, 1);
    const buckets = Array.from({ length: 3 }, (_, index) => {
      const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 2 + index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return { key, income: 0, expenses: 0, count: 0 };
    });
    const map = new Map(buckets.map(item => [item.key, item]));
    transactions.forEach(item => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date || "")) return;
      const bucket = map.get(item.date.slice(0, 7));
      const amount = Number(item.amount);
      if (!bucket || !Number.isFinite(amount) || amount < 0) return;
      if (item.type === "income") bucket.income += amount;
      else if (item.type === "expense") bucket.expenses += amount;
      else return;
      bucket.count += 1;
    });
    const populated = buckets.filter(item => item.count > 0);
    const averageMargin = populated.length
      ? populated.reduce((sum, item) => sum + item.income - item.expenses, 0) / populated.length
      : 0;
    return { averageMargin, months: populated.length, buckets };
  }, [transactions, selectedMonth]);

  const hasInputs = validCash && validInstallments;
  const marginPositive = history.months > 0 && history.averageMargin > 0;
  const installmentFits = marginPositive && monthlyPayment <= history.averageMargin;
  const installmentShare = marginPositive ? monthlyPayment / history.averageMargin * 100 : null;
  const cashEquivalentMonths = marginPositive && cash !== null ? cash / history.averageMargin : null;

  return <section className="panel purchase-simulator">
    <div className="insight-title"><div className="ai-icon"><Calculator size={18}/></div><div><h2>Simulador inteligente de compra</h2><p>Descubra quanto a compra custa e o peso das parcelas no seu orçamento.</p></div></div>

    <div className="simulator-howto">
      <strong>Como preencher</strong>
      <p>1. Informe o preço à vista. 2. Informe o valor total que pagaria parcelado. 3. Escolha em quantas vezes.</p>
    </div>

    <div className="simulator-fields">
      <label>1. Preço à vista<input inputMode="decimal" value={cashPrice} onChange={event => setCashPrice(event.target.value)} placeholder="Ex.: 1.500,00"/></label>
      <label>2. Total parcelado<input inputMode="decimal" value={installmentTotal} onChange={event => setInstallmentTotal(event.target.value)} placeholder="Ex.: 1.680,00"/></label>
      <label>3. Quantidade de parcelas<select value={installments} onChange={event => setInstallments(event.target.value)}>{[2,3,4,5,6,8,10,12,18,24,36,48].map(value => <option key={value} value={value}>{value} vezes</option>)}</select></label>
    </div>

    {!validCash || !validInstallments ? <div className="simulator-verdict simulator-caution"><Info size={18}/><div><strong>Preencha os três campos para ver a análise</strong><p>Use o preço à vista e o valor total de todas as parcelas (não o valor de cada parcela). Exemplo: à vista R$ 1.500; parcelado R$ 1.680 em 12 vezes.</p></div></div> : <>
      <div className="simulator-results">
        <div><span>Valor de cada parcela</span><strong>{formatMoney(monthlyPayment)}</strong></div>
        <div><span>Total a mais no parcelamento</span><strong className={extraCost > 0 ? "simulator-negative" : "simulator-positive"}>{formatMoney(extraCost)}</strong></div>
        <div><span>Percentual a mais sobre o preço à vista</span><strong>{cash && cash > 0 ? `${(extraCost / cash * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}</strong></div>
      </div>
      {extraCost < 0 && <p className="simulator-warning"><AlertTriangle size={16}/> O total parcelado informado está abaixo do preço à vista. Confira os valores.</p>}
      <div className={installmentFits ? "simulator-verdict simulator-ok" : "simulator-verdict simulator-caution"}>
        {installmentFits ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}
        <div><strong>{!marginPositive ? "Ainda não dá para avaliar o peso no orçamento" : installmentFits ? "A parcela cabe na margem média registrada" : "A parcela supera sua margem média registrada"}</strong>
          <p>{!marginPositive ? "Não há margem mensal positiva suficiente nos lançamentos dos últimos meses analisados. Isso não significa que você não possa comprar; faltam dados para uma avaliação confiável." : `A parcela de ${formatMoney(monthlyPayment)} representa ${installmentShare!.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da margem média mensal de ${formatMoney(history.averageMargin)}.`}</p>
        </div>
      </div>
      <div className="decision-comparison">
        <div><span><TrendingUp size={14}/> Margem média mensal registrada</span><strong>{history.months ? formatMoney(history.averageMargin) : "Sem histórico"}</strong></div>
        <div><span>Preço à vista em meses dessa margem</span><strong>{cashEquivalentMonths !== null ? `${cashEquivalentMonths.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} meses` : "Sem dados suficientes"}</strong></div>
      </div>
    </>}
    <p className="simulator-disclaimer">Análise de {labelMonth(selectedMonth)}. A média considera até 3 meses terminando no período selecionado, somente meses com lançamentos. É uma referência baseada nos registros, não consulta seu saldo bancário nem considera contas futuras, outras parcelas ou reserva de emergência.</p>
  </section>;
}
