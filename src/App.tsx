import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowUpRight, Bell, CalendarDays, ChevronDown,
  CircleHelp, Download, LayoutDashboard, Lightbulb, Menu, Plus, Search,
  Settings, Target, TrendingUp, Wallet, X, Trash2, Sparkles, FileText
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";

type Kind = "income" | "expense";
type Transaction = {
  id: string;
  title: string;
  category: string;
  date: string;
  amount: number;
  type: Kind;
};

const STORAGE_KEY = "finance-ia-transactions-v1";
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const today = new Date().toISOString().slice(0, 10);

const initialTransactions: Transaction[] = [
  { id: "1", title: "SalÃ¡rio", category: "SalÃ¡rio", date: today, amount: 4200, type: "income" },
  { id: "2", title: "Supermercado", category: "AlimentaÃ§Ã£o", date: today, amount: 386.5, type: "expense" },
  { id: "3", title: "Conta de energia", category: "Moradia", date: today, amount: 142.8, type: "expense" },
  { id: "4", title: "Projeto freelance", category: "ServiÃ§os", date: today, amount: 650, type: "income" },
  { id: "5", title: "Internet", category: "Moradia", date: today, amount: 99.9, type: "expense" },
];

const chartData = [
  { month: "Jun", income: 3900, expenses: 2700 },
  { month: "Jul", income: 4200, expenses: 3100 },
  { month: "Ago", income: 4050, expenses: 2850 },
  { month: "Set", income: 4600, expenses: 3300 },
  { month: "Out", income: 4350, expenses: 2950 },
  { month: "Nov", income: 4850, expenses: 3150 },
];

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) as Transaction[] : initialTransactions;
    } catch {
      return initialTransactions;
    }
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    title: "", category: "Outros", date: today, amount: "", type: "expense" as Kind
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }, [transactions]);

  const totals = useMemo(() => {
    const income = transactions.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
    return { income, expenses, balance: income - expenses };
  }, [transactions]);

  const filtered = useMemo(() => transactions
    .filter(t => filter === "all" || t.type === filter)
    .filter(t => `${t.title} ${t.category}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date)), [transactions, filter, search]);

  const expenseByCategory = useMemo(() => {
    const totalsByCategory = transactions.filter(t => t.type === "expense").reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});
    return Object.entries(totalsByCategory).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  const addTransaction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(form.amount.replace(",", "."));
    if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0) return;
    setTransactions(current => [{
      id: crypto.randomUUID(),
      title: form.title.trim(),
      category: form.category,
      date: form.date,
      amount,
      type: form.type
    }, ...current]);
    setForm({ title: "", category: "Outros", date: today, amount: "", type: "expense" });
    setModalOpen(false);
  };

  const deleteTransaction = (id: string) => {
    setTransactions(current => current.filter(t => t.id !== id));
  };

  const exportCsv = () => {
    const rows = [["DescriÃ§Ã£o", "Categoria", "Data", "Tipo", "Valor"], ...transactions.map(t => [
      t.title, t.category, t.date, t.type === "income" ? "Receita" : "Despesa", t.amount.toFixed(2).replace(".", ",")
    ])];
    const csv = "\uFEFF" + rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "finance-ia-lancamentos.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const topCategory = expenseByCategory[0];
  const savingsRate = totals.income > 0 ? Math.max(0, (totals.balance / totals.income) * 100) : 0;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Activity size={21} /></div>
          <div><strong>FINANCE <span>IA</span></strong><small>CONTROLE INTELIGENTE</small></div>
          <button className="icon-btn mobile-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={19}/></button>
        </div>
        <div className="workspace-label">MENU PRINCIPAL</div>
        <nav className="nav-list">
          <a className="nav-item active" href="#dashboard"><LayoutDashboard size={18}/> VisÃ£o geral</a>
          <a className="nav-item" href="#transactions"><Wallet size={18}/> LanÃ§amentos</a>
          <a className="nav-item" href="#insights"><Sparkles size={18}/> AnÃ¡lise inteligente <span className="new-pill">NOVO</span></a>
          <a className="nav-item" href="#goals"><Target size={18}/> Metas financeiras</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><CircleHelp size={18}/></div>
            <strong>Precisa de ajuda?</strong>
            <p>Organize suas finanÃ§as com mais clareza.</p>
            <a href="#insights">Ver dicas <span>â†’</span></a>
          </div>
          <a className="nav-item muted" href="#settings"><Settings size={18}/> ConfiguraÃ§Ãµes</a>
          <div className="profile">
            <div className="avatar">R</div>
            <div className="profile-text"><strong>Minha conta</strong><small>Plano demonstraÃ§Ã£o</small></div>
            <ChevronDown size={16} className="profile-chevron"/>
          </div>
        </div>
      </aside>

      {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"/>}

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu size={20}/></button>
            <div><div className="breadcrumb">Workspace <span>/</span> <b>VisÃ£o geral</b></div><div className="welcome">Bom dia! <span>Vamos cuidar do seu dinheiro.</span></div></div>
          </div>
          <div className="topbar-actions">
            <div className="date-chip"><CalendarDays size={15}/> {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
            <button className="icon-btn notification-btn" aria-label="NotificaÃ§Ãµes"><Bell size={18}/><i/></button>
            <button className="primary-btn top-add" onClick={() => setModalOpen(true)}><Plus size={17}/> Novo lanÃ§amento</button>
          </div>
        </header>

        <section className="page-heading">
          <div><p className="eyebrow">SEU RESUMO FINANCEIRO</p><h1>VisÃ£o geral</h1><p className="muted-text">Acompanhe sua vida financeira em um sÃ³ lugar.</p></div>
          <button className="outline-btn" onClick={exportCsv}><Download size={16}/> Exportar dados</button>
        </section>

        <section className="stats-grid">
          <StatCard title="Saldo disponÃ­vel" value={money(totals.balance)} icon={<Wallet size={19}/>} tone="purple" detail="Receitas menos despesas" />
          <StatCard title="Receitas" value={money(totals.income)} icon={<ArrowDownLeft size={19}/>} tone="green" detail="Entradas registradas" />
          <StatCard title="Despesas" value={money(totals.expenses)} icon={<ArrowUpRight size={19}/>} tone="red" detail="SaÃ­das registradas" />
          <StatCard title="Taxa de economia" value={`${savingsRate.toFixed(1).replace(".", ",")}%`} icon={<TrendingUp size={19}/>} tone="blue" detail="Saldo sobre receitas" />
        </section>

        <section className="content-grid">
          <div className="panel chart-panel">
            <div className="panel-heading"><div><h2>Fluxo financeiro</h2><p>VisÃ£o demonstrativa dos Ãºltimos 6 meses</p></div><button className="select-chip">Ãšltimos 6 meses <ChevronDown size={14}/></button></div>
            <div className="chart-legend"><span><i className="legend-income"/> Receitas</span><span><i className="legend-expense"/> Despesas</span></div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b7cff" stopOpacity={0.28}/><stop offset="95%" stopColor="#8b7cff" stopOpacity={0}/></linearGradient>
                    <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#35c99a" stopOpacity={0.16}/><stop offset="95%" stopColor="#35c99a" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid stroke="#242b3d" strokeDasharray="4 5" vertical={false}/>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#78839b", fontSize: 12 }}/>
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#78839b", fontSize: 11 }} tickFormatter={(v) => `R$${v/1000}k`}/>
                  <Tooltip contentStyle={{ background: "#151c2d", border: "1px solid #303950", borderRadius: 12, color: "#f4f6fb" }} formatter={(value) => money(Number(value))}/>
                  <Area type="monotone" dataKey="income" name="Receitas" stroke="#9a8cff" strokeWidth={2.5} fill="url(#incomeFill)"/>
                  <Area type="monotone" dataKey="expenses" name="Despesas" stroke="#35c99a" strokeWidth={2.5} fill="url(#expenseFill)"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-note"><span className="note-dot"/> <span>O grÃ¡fico acima usa dados ilustrativos. Seus lanÃ§amentos aparecem nos indicadores e na lista abaixo.</span></div>
          </div>

          <div className="panel insight-panel" id="insights">
            <div className="insight-title"><div className="ai-icon"><Sparkles size={18}/></div><div><h2>AnÃ¡lise inteligente</h2><p>Resumo automÃ¡tico dos seus dados</p></div></div>
            <div className="insight-highlight"><span className="insight-label">VISÃƒO DO SEU DINHEIRO</span><strong>{totals.balance >= 0 ? "Seu saldo estÃ¡ positivo." : "AtenÃ§Ã£o ao seu saldo."}</strong><p>{totals.balance >= 0 ? `VocÃª tem ${money(totals.balance)} de saldo considerando os lanÃ§amentos registrados.` : `Suas despesas superam as receitas em ${money(Math.abs(totals.balance))}. Revise seus gastos.`}</p></div>
            <div className="insight-row"><div className="mini-icon purple"><Lightbulb size={16}/></div><div><strong>Maior categoria de despesa</strong><p>{topCategory ? `${topCategory[0]} Â· ${money(topCategory[1])}` : "Adicione despesas para visualizar."}</p></div></div>
            <div className="insight-row"><div className="mini-icon green"><TrendingUp size={16}/></div><div><strong>Taxa de economia</strong><p>{savingsRate.toFixed(1).replace(".", ",")}% das receitas permanecem no saldo.</p></div></div>
            <div className="insight-disclaimer">Esta anÃ¡lise Ã© automÃ¡tica e informativa. NÃ£o Ã© recomendaÃ§Ã£o de investimento.</div>
          </div>
        </section>

        <section className="lower-grid">
          <div className="panel transactions-panel" id="transactions">
            <div className="panel-heading transactions-heading"><div><h2>Ãšltimos lanÃ§amentos</h2><p>Consulte e organize suas movimentaÃ§Ãµes.</p></div><button className="text-btn" onClick={() => setModalOpen(true)}>Adicionar novo <Plus size={15}/></button></div>
            <div className="table-tools"><div className="search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar lanÃ§amento..."/></div><div className="filter-tabs"><button className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>Todos</button><button className={filter === "income" ? "selected" : ""} onClick={() => setFilter("income")}>Receitas</button><button className={filter === "expense" ? "selected" : ""} onClick={() => setFilter("expense")}>Despesas</button></div></div>
            <div className="transaction-list">
              {filtered.length === 0 ? <div className="empty-state"><FileText size={24}/><strong>Nenhum lanÃ§amento encontrado</strong><span>Adicione uma movimentaÃ§Ã£o ou altere sua busca.</span></div> : filtered.slice(0, 8).map(t => (
                <div className="transaction-row" key={t.id}>
                  <div className={`transaction-icon ${t.type}`}>{t.type === "income" ? <ArrowDownLeft size={17}/> : <ArrowUpRight size={17}/>}</div>
                  <div className="transaction-main"><strong>{t.title}</strong><span>{t.category} Â· {new Date(`${t.date}T12:00:00`).toLocaleDateString("pt-BR")}</span></div>
                  <strong className={`transaction-amount ${t.type}`}>{t.type === "income" ? "+" : "âˆ’"} {money(t.amount)}</strong>
                  <button className="delete-btn" onClick={() => deleteTransaction(t.id)} title="Excluir lanÃ§amento" aria-label={`Excluir ${t.title}`}><Trash2 size={15}/></button>
                </div>
              ))}
            </div>
          </div>

          <div className="panel goals-panel" id="goals">
            <div className="panel-heading"><div><h2>Despesas por categoria</h2><p>DistribuiÃ§Ã£o dos seus gastos</p></div><Activity size={18} className="subtle-icon"/></div>
            {expenseByCategory.length === 0 ? <div className="empty-state compact">Adicione despesas para ver as categorias.</div> : <div className="category-list">{expenseByCategory.slice(0, 5).map(([category, amount], index) => {
              const colors = ["#8e7cff", "#35c99a", "#f3b85b", "#5ca9ff", "#e879a9"];
              const percent = totals.expenses ? amount / totals.expenses * 100 : 0;
              return <div className="category-item" key={category}><div className="category-top"><span><i style={{ background: colors[index % colors.length] }}/>{category}</span><strong>{money(amount)}</strong></div><div className="progress-track"><div style={{ width: `${percent}%`, background: colors[index % colors.length] }}/></div><small>{percent.toFixed(1).replace(".", ",")}% das despesas</small></div>;
            })}</div>}
            <div className="category-footer"><span>Total de despesas</span><strong>{money(totals.expenses)}</strong></div>
          </div>
        </section>
        <footer className="footer"><span>Â© 2026 FINANCE IA</span><span>OrganizaÃ§Ã£o financeira com clareza.</span><span>VersÃ£o 1.0 Â· DemonstraÃ§Ã£o</span></footer>
      </main>

      {modalOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
        <form className="modal" onSubmit={addTransaction}>
          <div className="modal-heading"><div><span className="eyebrow">MOVIMENTAÃ‡ÃƒO FINANCEIRA</span><h2>Novo lanÃ§amento</h2></div><button type="button" className="icon-btn" onClick={() => setModalOpen(false)} aria-label="Fechar"><X size={19}/></button></div>
          <div className="type-switch"><button type="button" className={form.type === "expense" ? "active expense-tab" : ""} onClick={() => setForm({ ...form, type: "expense" })}>Despesa</button><button type="button" className={form.type === "income" ? "active income-tab" : ""} onClick={() => setForm({ ...form, type: "income" })}>Receita</button></div>
          <label>DescriÃ§Ã£o<input required autoFocus placeholder="Ex.: Compra de materiais" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label>
          <div className="form-two"><label>Valor (R$)<input required inputMode="decimal" placeholder="0,00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}/></label><label>Data<input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}/></label></div>
          <label>Categoria<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{(form.type === "income" ? ["SalÃ¡rio", "ServiÃ§os", "Vendas", "Investimentos", "Outros"] : ["AlimentaÃ§Ã£o", "Moradia", "Transporte", "SaÃºde", "EducaÃ§Ã£o", "Lazer", "ServiÃ§os", "Outros"]).map(c => <option key={c}>{c}</option>)}</select></label>
          <div className="modal-actions"><button type="button" className="outline-btn" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit" className="primary-btn"><Plus size={16}/> Salvar lanÃ§amento</button></div>
        </form>
      </div>}
    </div>
  );
}

function StatCard({ title, value, icon, tone, detail }: { title: string; value: string; icon: React.ReactNode; tone: string; detail: string }) {
  return <div className="stat-card"><div className="stat-top"><span>{title}</span><div className={`stat-icon ${tone}`}>{icon}</div></div><strong className="stat-value">{value}</strong><div className="stat-detail"><span className={`detail-dot ${tone}`}/>{detail}</div></div>;
}

export default App;

