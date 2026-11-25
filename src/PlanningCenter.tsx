import { Calculator } from "lucide-react";
import PurchaseSimulator from "./PurchaseSimulator";
import FinancialTimeMachine from "./FinancialTimeMachine";
import FinancialStressTest from "./FinancialStressTest";
import DebtNegotiator from "./DebtNegotiator";
import WasteDetector from "./WasteDetector";

type Transaction = { id: string; title: string; category: string; date: string; amount: number; type: "income" | "expense" };
type Props = { transactions: Transaction[]; formatMoney: (value: number) => string };
export default function PlanningCenter({ transactions, formatMoney }: Props) {
  return <section className="page-section planning-page">
    <div className="page-heading"><div><p className="eyebrow">PLANEJAMENTO E DECISÕES</p><h1>Seu futuro financeiro</h1><p className="muted-text">Simule escolhas, antecipe imprevistos e organize a quitação de dívidas.</p></div></div>
    <div className="planning-intro"><div><span><Calculator size={17}/></span><div><strong>Decida antes de comprometer seu dinheiro</strong><p>As ferramentas usam seus lançamentos quando aplicável. Ajuste os valores para testar possibilidades reais.</p></div></div></div>
    <PurchaseSimulator transactions={transactions} formatMoney={formatMoney}/>
    <FinancialTimeMachine transactions={transactions} formatMoney={formatMoney}/>
    <FinancialStressTest transactions={transactions} formatMoney={formatMoney}/>
    <DebtNegotiator formatMoney={formatMoney}/>
    <WasteDetector transactions={transactions} formatMoney={formatMoney}/>
  </section>;
}
