import { useMemo, useState } from "react";
import { Search, Wallet, Repeat2, ShieldCheck } from "lucide-react";

type Transaction = { id: string; title: string; category: string; date: string; amount: number; type: "income" | "expense" };
type Props = { transactions: Transaction[]; formatMoney: (value: number) => string; selectedMonth: string };

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function normalizeDescription(value: string) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
}

export default function WasteDetector({ transactions, formatMoney, selectedMonth }: Props) {
  const [target, setTarget] = useState(20);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);

  const report = useMemo(() => {
    const valid = transactions.filter(t =>
      t.type === "expense" &&
      typeof t.date === "string" &&
      /^\d{4}-\d{2}-\d{2}/.test(t.date) &&
      Number.isFinite(Number(t.amount)) &&
      Number(t.amount) > 0
    );
    const expenses = valid
      .filter(t => t.date.startsWith(selectedMonth))
      .sort((a, b) => Number(b.amount) - Number(a.amount));
    const small = expenses.filter(t => Number(t.amount) <= 50);
    const total = expenses.reduce((sum, t) => sum + Number(t.amount), 0);
    const smallTotal = small.reduce((sum, t) => sum + Number(t.amount), 0);

    const groups = new Map<string, Transaction[]>();
    valid.forEach(t => {
      const key = normalizeDescription(t.title);
      if (key.length > 2) groups.set(key, [...(groups.get(key) || []), t]);
    });

    const recurring = [...groups.values()].map(items => {
      const months = new Set(items.map(t => t.date.slice(0, 7)));
      const monthly = items.reduce((sum, t) => sum + Number(t.amount), 0) / Math.max(1, months.size);
      return { title: items[0].title, items, months: months.size, monthly };
    }).filter(item => item.months >= 2)
      .sort((a, b) => b.monthly - a.monthly)
      .slice(0, 5);

    const frequent = [...groups.values()].map(items => ({
      title: items[0].title,
      items: items.filter(t => t.date.startsWith(selectedMonth))
    })).filter(item => item.items.length >= 3)
      .map(item => ({ ...item, total: item.items.reduce((sum, t) => sum + Number(t.amount), 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return { total, expenses, small, smallTotal, recurring, frequent };
  }, [transactions, selectedMonth]);

  const selectedExpenses = report.expenses.filter(t => !excludedIds.includes(t.id));
  const selectedTotal = selectedExpenses.reduce((sum, t) => sum + Number(t.amount), 0);
  const estimated = selectedTotal * target / 100;

  return (
    <section className="panel waste-detector">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">ETAPA 6 · OTIMIZAÇÃO</p>
          <h2>Detector de desperdícios</h2>
          <p>Escolha despesas reais e simule quanto poderia economizar reduzindo esses gastos.</p>
        </div>
        <Search size={19} className="subtle-icon" />
      </div>

      <p className="waste-period-label">Análise de {monthLabel(selectedMonth)}</p>

      {report.expenses.length === 0 ? (
        <div className="time-machine-empty">
          <Search size={22} />
          <div>
            <strong>Não encontrei despesas neste mês</strong>
            <p>O detector acompanha o mês selecionado no painel. Escolha outro mês ou cadastre despesas em Lançamentos para começar a simulação.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="waste-kpis">
            <div>
              <span>Total de despesas do período</span>
              <strong>{formatMoney(report.total)}</strong>
              <small>{report.expenses.length} lançamento(s) analisado(s)</small>
            </div>
            <div>
              <span>Pequenos gastos (até R$ 50)</span>
              <strong>{formatMoney(report.smallTotal)}</strong>
              <small>{report.small.length} lançamento(s) identificado(s)</small>
            </div>
          </div>

          <div className="waste-savings">
            <div className="waste-savings-heading">
              <strong>Simule uma redução nas despesas selecionadas</strong>
              <b>{target}%</b>
            </div>
            <input
              aria-label="Percentual de redução"
              type="range"
              min="0"
              max="50"
              step="5"
              value={target}
              onChange={event => setTarget(Number(event.currentTarget.value))}
            />
            <p>
              Você selecionou <strong>{formatMoney(selectedTotal)}</strong> em despesas.
              Reduzindo {target}% desse valor, a economia estimada seria de{" "}
              <strong>{formatMoney(estimated)} neste mês</strong> ou{" "}
              <strong>{formatMoney(estimated * 12)} em 12 meses</strong>, se o padrão se repetir.
            </p>
          </div>

          <div className="waste-purchases">
            <div className="waste-purchases-heading">
              <strong>Quais despesas entram na simulação?</strong>
              <span>{selectedExpenses.length} de {report.expenses.length} selecionadas</span>
            </div>
            <div className="waste-selection-actions">
              <button type="button" className="text-btn" onClick={() => setExcludedIds([])}>Selecionar todas</button>
              <button type="button" className="text-btn" onClick={() => setExcludedIds(report.expenses.map(t => t.id))}>Desmarcar todas</button>
            </div>
            {report.expenses.map(item => (
              <label className="waste-purchase" key={item.id}>
                <input
                  type="checkbox"
                  checked={!excludedIds.includes(item.id)}
                  onChange={event => {
                    const checked = event.currentTarget.checked;
                    setExcludedIds(current =>
                      checked
                        ? current.filter(id => id !== item.id)
                        : current.includes(item.id) ? current : [...current, item.id]
                    );
                  }}
                />
                <span>
                  <strong>{item.title}</strong>
                  <small>
                    {item.category} · {new Date(`${item.date.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR")}
                    {Number(item.amount) <= 50 ? " · Pequeno gasto" : ""}
                  </small>
                </span>
                <b>{formatMoney(Number(item.amount))}</b>
              </label>
            ))}
            <div className="waste-selection-total">
              <span>Total considerado na simulação</span>
              <strong>{formatMoney(selectedTotal)}</strong>
            </div>
          </div>

          <div className="waste-lists">
            <div>
              <h3><Repeat2 size={15} /> Descrições que reaparecem</h3>
              {report.recurring.length ? report.recurring.map(item => (
                <article key={normalizeDescription(item.title)}>
                  <span>{item.title}<small>{item.items.length} lançamentos · {item.months} meses</small></span>
                  <b>{formatMoney(item.monthly)}/mês*</b>
                </article>
              )) : <p className="waste-empty">Ainda não há histórico suficiente em meses diferentes.</p>}
            </div>
            <div>
              <h3><Wallet size={15} /> Compras frequentes neste mês</h3>
              {report.frequent.length ? report.frequent.map(item => (
                <article key={normalizeDescription(item.title)}>
                  <span>{item.title}<small>{item.items.length} vezes no mês</small></span>
                  <b>{formatMoney(item.total)}</b>
                </article>
              )) : <p className="waste-empty">Nenhuma descrição aparece três vezes ou mais neste mês.</p>}
            </div>
          </div>

          <p className="insight-disclaimer">
            <ShieldCheck size={13} />
            A economia é uma simulação, não uma garantia. O detector não classifica automaticamente uma despesa como desperdício e não altera nem exclui seus lançamentos.
          </p>
        </>
      )}
    </section>
  );
}
