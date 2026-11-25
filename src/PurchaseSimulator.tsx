import { useMemo, useState } from "react";
import { Calculator, AlertTriangle, CheckCircle2 } from "lucide-react";

type Transaction = { date: string; amount: number; type: "income" | "expense" };
type Props = { transactions: Transaction[]; formatMoney: (value: number) => string };

export default function PurchaseSimulator({ transactions, formatMoney }: Props) {
  const [price, setPrice] = useState("1500");
  const [installments, setInstallments] = useState("1");
  const [mode, setMode] = useState<"cash" | "installment">("cash");
  const current = useMemo(() => {
    const now = new Date();
    const key = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    const entries = transactions.filter(item => item.date?.startsWith(key) && Number.isFinite(Number(item.amount)));
    const income = entries.filter(item => item.type === "income").reduce((sum, item) => sum + Number(item.amount), 0);
    const expenses = entries.filter(item => item.type === "expense").reduce((sum, item) => sum + Number(item.amount), 0);
    return { income, expenses, margin: income - expenses, count: entries.length };
  }, [transactions]);

  const amount = Number(price.replace(/\./g, "").replace(",", "."));
  const count = Math.min(48, Math.max(1, Number(installments) || 1));
  const valid = Number.isFinite(amount) && amount > 0 && amount <= 10000000;
  const monthly = valid ? amount / (mode === "cash" ? 1 : count) : 0;
  const after = current.margin - monthly;
  const cashAfter = current.margin - amount;
  const hasIncome = current.income > 0;
  const safe = hasIncome && after >= 0;
  const formatMonth = (value: number) => formatMoney(value);

  return <section className="panel purchase-simulator">
    <div className="insight-title"><div className="ai-icon"><Calculator size={18}/></div><div><h2>Simulador de compras</h2><p>Descubra o impacto antes de assumir uma compra</p></div></div>
    <div className="simulator-fields">
      <label>Valor da compra (R$)<input inputMode="decimal" value={price} onChange={event => setPrice(event.target.value)} placeholder="Ex.: 1500,00"/></label>
      <label>Forma de pagamento<select value={mode} onChange={event => setMode(event.target.value as "cash" | "installment")}><option value="cash">À vista</option><option value="installment">Parcelado</option></select></label>
      {mode === "installment" && <label>Número de parcelas<select value={installments} onChange={event => setInstallments(event.target.value)}>{[2,3,4,5,6,8,10,12,18,24,36,48].map(value => <option key={value} value={value}>{value}x</option>)}</select></label>}
    </div>
    {!valid ? <p className="simulator-warning"><AlertTriangle size={16}/> Informe um valor válido para simular.</p> : <>
      <div className="simulator-results">
        <div><span>{mode === "cash" ? "Impacto imediato" : "Parcela mensal simulada"}</span><strong>{formatMoney(monthly)}</strong></div>
        <div><span>Resultado do mês após a compra</span><strong className={after < 0 ? "simulator-negative" : "simulator-positive"}>{formatMonth(after)}</strong></div>
        {mode === "cash" && <div><span>Resultado após pagar à vista</span><strong className={cashAfter < 0 ? "simulator-negative" : "simulator-positive"}>{formatMoney(cashAfter)}</strong></div>}
      </div>
      <div className={safe ? "simulator-verdict simulator-ok" : "simulator-verdict simulator-caution"}>
        {safe ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}
        <div><strong>{!hasIncome ? "Dados insuficientes para avaliar" : safe ? "A compra cabe no resultado registrado deste mês" : "A compra pode deixar seu mês no vermelho"}</strong>
          <p>{!hasIncome ? "Cadastre suas receitas e despesas do mês para obter uma simulação baseada nos seus registros." : "A conta considera receitas e despesas já cadastradas neste mês. " + (mode === "installment" ? "Não inclui parcelas antigas que ainda não foram lançadas nem juros futuros." : "O pagamento à vista reduz o resultado disponível pelo valor total.")}</p>
        </div>
      </div>
      <p className="simulator-disclaimer">Base: {current.count} lançamento(s) do mês atual. Simulação informativa, não consulta saldo bancário e não substitui a conferência de contas futuras, limite disponível ou juros do contrato.</p>
    </>}
  </section>;
}
