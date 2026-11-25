import { useMemo, useState } from "react";
import { ShieldCheck, AlertTriangle, TrendingUp } from "lucide-react";
import { parseBrazilianMoney } from "./lib/money-core.js";

type Props = { formatMoney: (value: number) => string };
type Payoff = { months: number; interest: number; total: number; impossible: boolean };
function simulatePayoff(principal: number, rate: number, payment: number): Payoff {
  let balance = principal, interest = 0, months = 0;
  if (payment <= principal * rate) return { months: 0, interest: 0, total: 0, impossible: true };
  while (balance > 0.01 && months < 600) {
    const charge = balance * rate;
    interest += charge;
    balance = Math.max(0, balance + charge - payment);
    months++;
  }
  return { months, interest, total: principal + interest, impossible: balance > 0.01 };
}
export default function DebtNegotiator({ formatMoney }: Props) {
  const [debtText, setDebtText] = useState("");
  const [rateText, setRateText] = useState("");
  const [paymentText, setPaymentText] = useState("");
  const [extraText, setExtraText] = useState("0");
  const debtValue = parseBrazilianMoney(debtText);
  const rateValue = parseBrazilianMoney(rateText);
  const paymentValue = parseBrazilianMoney(paymentText);
  const extraValue = parseBrazilianMoney(extraText);
  const debt = debtValue ?? 0, rate = (rateValue ?? 0) / 100, payment = paymentValue ?? 0, extra = extraValue ?? 0;
  const valid = debtValue !== null && rateValue !== null && paymentValue !== null && extraValue !== null && debt > 0 && debt <= 100000000 && rate >= 0 && rate <= 1 && payment > 0 && extra >= 0;
  const result = useMemo(() => valid ? {
    current: simulatePayoff(debt, rate, payment),
    accelerated: simulatePayoff(debt, rate, payment + extra)
  } : null, [valid, debt, rate, payment, extra]);
    current: simulatePayoff(debt, rate, payment),
    accelerated: simulatePayoff(debt, rate, payment + extra)
  } : null, [valid, debt, rate, payment, extra]);
  const savings = result && !result.current.impossible && !result.accelerated.impossible ? result.current.interest - result.accelerated.interest : null;
  return <section className="panel debt-negotiator">
    <div className="insight-title"><div className="ai-icon"><ShieldCheck size={18}/></div><div><h2>Estratégia para quitar dívidas</h2><p>Compare o pagamento atual com um valor mensal maior</p></div></div>
    <div className="debt-fields">
      <label>Valor total da dívida (R$)<input inputMode="decimal" value={debtText} onChange={e => setDebtText(e.target.value)} placeholder="Ex.: 8.500,00"/></label>
      <label>Juros ao mês (%)<input inputMode="decimal" value={rateText} onChange={e => setRateText(e.target.value)} placeholder="Ex.: 4,5"/></label>
      <label>Pagamento mensal atual (R$)<input inputMode="decimal" value={paymentText} onChange={e => setPaymentText(e.target.value)} placeholder="Ex.: 500,00"/></label>
      <label>Quanto consegue acrescentar por mês? (R$)<input inputMode="decimal" value={extraText} onChange={e => setExtraText(e.target.value)} placeholder="Ex.: 100,00"/></label>
    </div>
    {!debtText || !rateText || !paymentText ? <p className="debt-note">Informe os dados da dívida para comparar os cenários. Confira a taxa mensal no contrato ou na fatura.</p> : !valid ? <p className="debt-warning"><AlertTriangle size={15}/> Confira os valores informados.</p> : result && <>
      <div className="debt-scenarios">
        <div><span>Pagando o valor atual</span>{result.current.impossible ? <strong className="debt-bad">Pagamento não cobre os juros</strong> : <><strong>{result.current.months} meses</strong><small>Juros estimados: {formatMoney(result.current.interest)}</small></>}</div>
        <div><span>Pagando com o adicional</span>{result.accelerated.impossible ? <strong className="debt-bad">Pagamento não cobre os juros</strong> : <><strong>{result.accelerated.months} meses</strong><small>Juros estimados: {formatMoney(result.accelerated.interest)}</small></>}</div>
      </div>
      {savings !== null && <div className="debt-savings"><TrendingUp size={17}/><div><strong>Economia estimada em juros: {formatMoney(Math.max(0, savings))}</strong><p>Com o adicional mensal de {formatMoney(extra)}, a quitação pode ocorrer {Math.max(0, result.current.months - result.accelerated.months)} mês(es) antes.</p></div></div>}
      {(result.current.impossible || result.accelerated.impossible) && <p className="debt-warning"><AlertTriangle size={15}/> O pagamento informado não supera os juros mensais. A dívida pode crescer; procure renegociar taxa, prazo ou parcela.</p>}
    </>}
    <p className="insight-disclaimer">Estimativa simplificada com juros compostos mensais e pagamento no fim de cada mês. Não inclui multas, IOF, tarifas, juros variáveis ou regras específicas do credor. Não substitui uma proposta formal de renegociação. Antes de aceitar, compare o Custo Efetivo Total (CET) e o valor total a pagar.</p>
  </section>;
}
