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
const SETTINGS_KEY = "finance-ia-settings-v1";
type AppSettings = { theme: "dark" | "light"; accent: "purple" | "blue" | "green" | "red"; currency: "BRL" | "USD" | "EUR" };
const DEFAULT_SETTINGS: AppSettings = { theme: "dark", accent: "purple", currency: "BRL" };
const ACCENT_COLORS: Record<AppSettings["accent"], string> = {
  purple: "#9a8cff", blue: "#55a6ff", green: "#35c99a", red: "#f07883"
};

// Corrige textos antigos gravados no navegador com UTF-8 interpretado como Latin-1.
// A conversão só é aplicada quando o resultado remove os sinais típicos de corrupção.
function repairMojibake(value: string): string {
  if (!/[ÃÂ]/.test(value)) return value;

  const characters = Array.from(value);
  if (characters.some(character => character.codePointAt(0)! > 255)) return value;

  try {
    const bytes = Uint8Array.from(characters, character => character.charCodeAt(0));
    const repaired = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return /[ÃÂ]/.test(repaired) ? value : repaired;
  } catch {
    return value;
  }
}

function repairStoredTransactions(value: unknown): Transaction[] {
  if (!Array.isArray(value)) return initialTransactions;

  return value.map((item) => {
    if (!item || typeof item !== "object") return item;
    const transaction = item as Transaction;

    return {
      ...transaction,
      title: typeof transaction.title === "string"
        ? repairMojibake(transaction.title)
        : transaction.title,
      category: typeof transaction.category === "string"
        ? repairMojibake(transaction.category)
        : transaction.category,
    };
  }) as Transaction[];
}

const money = (value: number, currency: AppSettings["currency"] = "BRL") => value.toLocaleString("pt-BR", { style: "currency", currency });
const today = new Date().toISOString().slice(0, 10);

const initialTransactions: Transaction[] = [
  { id: "1", title: "Salário", category: "Salário", date: today, amount: 4200, type: "income" },
  { id: "2", title: "Supermercado", category: "Alimentação", date: today, amount: 386.5, type: "expense" },
  { id: "3", title: "Conta de energia", category: "Moradia", date: today, amount: 142.8, type: "expense" },
  { id: "4", title: "Projeto freelance", category: "Serviços", date: today, amount: 650, type: "income" },
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
      return saved
        ? repairStoredTransactions(JSON.parse(saved) as unknown)
        : initialTransactions;
    } catch {
      return initialTransactions;
    }
  });
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [activePage, setActivePage] = useState(() => window.location.hash === "#settings" ? "settings" : "dashboard");
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

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    const syncPage = () => setActivePage(window.location.hash === "#settings" ? "settings" : "dashboard");
    window.addEventListener("hashchange", syncPage);
    return () => window.removeEventListener("hashchange", syncPage);
  }, []);

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
    const rows = [["Descrição", "Categoria", "Data", "Tipo", "Valor"], ...transactions.map(t => [
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

  const formatMoney = (value: number) => money(value, settings.currency);
  const topCategory = expenseByCategory[0];
  const savingsRate = totals.income > 0 ? Math.max(0, (totals.balance / totals.income) * 100) : 0;

  return (
    <div
      className={`app-shell ${settings.theme === "light" ? "theme-light" : ""}`}
      style={{ "--accent": ACCENT_COLORS[settings.accent], "--accent-soft": settings.accent === "purple" ? "#29264b" : settings.accent === "blue" ? "#1c3551" : settings.accent === "green" ? "#163c37" : "#432630" } as React.CSSProperties}
    >
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Activity size={21} /></div>
          <div><strong>FINANCE <span>IA</span></strong><small>CONTROLE INTELIGENTE</small></div>
          <button className="icon-btn mobile-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={19}/></button>
        </div>
        <div className="workspace-label">MENU PRINCIPAL</div>
        <nav className="nav-list">
          <a className={`nav-item ${activePage === "dashboard" ? "active" : ""}`} href="#dashboard" onClick={() => setActivePage("dashboard")}><LayoutDashboard size={18}/> Visão geral</a>
          <a className="nav-item" href="#transactions"><Wallet size={18}/> Lançamentos</a>
          <a className="nav-item" href="#insights"><Sparkles size={18}/> Análise inteligente <span className="new-pill">NOVO</span></a>
          <a className="nav-item" href="#goals"><Target size={18}/> Metas financeiras</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><CircleHelp size={18}/></div>
            <strong>Precisa de ajuda?</strong>
            <p>Organize suas finanças com mais clareza.</p>
            <a href="#insights">Ver dicas <span>→</span></a>
          </div>
          <a className={`nav-item muted ${activePage === "settings" ? "active" : ""}`} href="#settings" onClick={() => setActivePage("settings")}><Settings size={18}/> Configurações</a>
          <div className="profile">
            <div className="avatar">R</div>
            <div className="profile-text"><strong>Minha conta</strong><small>Plano demonstração</small></div>
            <ChevronDown size={16} className="profile-chevron"/>
          </div>
        </div>
      </aside>

      {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"/>}

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu size={20}/></button>
            <div><div className="breadcrumb">Workspace <span>/</span> <b>Visão geral</b></div><div className="welcome">Bom dia! <span>Vamos cuidar do seu dinheiro.</span></div></div>
          </div>
          <div className="topbar-actions">
            <div className="date-chip"><CalendarDays size={15}/> {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
            <button className="icon-btn notification-btn" aria-label="Notificações"><Bell size={18}/><i/></button>
            <button className="primary-btn top-add" onClick={() => setModalOpen(true)}><Plus size={17}/> Novo lançamento</button>
          </div>
        </header>

        {activePage === "settings" ? (
          <section className="settings-page">
            <div className="page-heading">
              <div><p className="eyebrow">PREFERÊNCIAS DO SISTEMA</p><h1>Configurações</h1><p className="muted-text">Personalize a aparência do seu Finance IA.</p></div>
            </div>
            <div className="panel settings-panel">
              <div className="settings-section-heading"><div><h2>Aparência e preferências</h2><p>Personalize a visualização e os valores do seu Finance IA.</p></div><span className="settings-preview-icon"><Settings size={19}/></span></div>
              <div className="settings-control">
                <div><strong>Tema</strong><small>Alterne entre o modo escuro e claro.</small></div>
                <div className="settings-options">
                  <button className={`settings-choice ${settings.theme === "dark" ? "selected" : ""}`} onClick={() => setSettings(current => ({ ...current, theme: "dark" }))}>◐ Escuro</button>
                  <button className={`settings-choice ${settings.theme === "light" ? "selected" : ""}`} onClick={() => setSettings(current => ({ ...current, theme: "light" }))}>☀ Claro</button>
                </div>
              </div>
              <div className="settings-control accent-control">
                <div><strong>Cor principal</strong><small>Personalize botões, destaques e elementos de navegação.</small></div>
                <div className="accent-options">
                  {([{ id: "purple", label: "Roxo" }, { id: "blue", label: "Azul" }, { id: "green", label: "Verde" }, { id: "red", label: "Vermelho" }] as const).map(color => (
                    <button key={color.id} className={`accent-choice ${settings.accent === color.id ? "selected" : ""}`} onClick={() => setSettings(current => ({ ...current, accent: color.id }))} aria-pressed={settings.accent === color.id}>
                      <i style={{ background: ACCENT_COLORS[color.id] }}/>{color.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="settings-control currency-control">
                <div><strong>Moeda</strong><small>Define como os valores financeiros são apresentados.</small></div>
                <select className="settings-select" value={settings.currency} onChange={event => setSettings(current => ({ ...current, currency: event.target.value as AppSettings["currency"] }))}>
                  <option value="BRL">Real brasileiro (BRL · R$)</option>
                  <option value="USD">Dólar americano (USD · US$)</option>
                  <option value="EUR">Euro (EUR · €)</option>
                </select>
              </div>
              <div className="settings-footer"><span>Suas preferências são salvas automaticamente neste navegador. A troca de moeda altera apenas a exibição, não converte os lançamentos.</span><button className="outline-btn" onClick={() => setSettings(DEFAULT_SETTINGS)}>Restaurar padrão</button></div>
            </div>
          </section>
        ) : <>
        <section className="page-heading">
          <div><p className="eyebrow">SEU RESUMO FINANCEIRO</p><h1>Visão geral</h1><p className="muted-text">Acompanhe sua vida financeira em um só lugar.</p></div>
          <button className="outline-btn" onClick={exportCsv}><Download size={16}/> Exportar dados</button>
        </section>

        <section className="stats-grid">
          <StatCard title="Saldo disponível" value={formatMoney(totals.balance)} icon={<Wallet size={19}/>} tone="purple" detail="Receitas menos despesas" />
          <StatCard title="Receitas" value={formatMoney(totals.income)} icon={<ArrowDownLeft size={19}/>} tone="green" detail="Entradas registradas" />
          <StatCard title="Despesas" value={formatMoney(totals.expenses)} icon={<ArrowUpRight size={19}/>} tone="red" detail="Saídas registradas" />
          <StatCard title="Taxa de economia" value={`${savingsRate.toFixed(1).replace(".", ",")}%`} icon={<TrendingUp size={19}/>} tone="blue" detail="Saldo sobre receitas" />
        </section>

        <section className="content-grid">
          <div className="panel chart-panel">
            <div className="panel-heading"><div><h2>Fluxo financeiro</h2><p>Visão demonstrativa dos últimos 6 meses</p></div><button className="select-chip">Últimos 6 meses <ChevronDown size={14}/></button></div>
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
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#78839b", fontSize: 11 }} tickFormatter={(v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: settings.currency, notation: "compact", maximumFractionDigits: 1 }).format(v)}/>
                  <Tooltip contentStyle={{ background: "#151c2d", border: "1px solid #303950", borderRadius: 12, color: "#f4f6fb" }} formatter={(value) => formatMoney(Number(value))}/>
                  <Area type="monotone" dataKey="income" name="Receitas" stroke="#9a8cff" strokeWidth={2.5} fill="url(#incomeFill)"/>
                  <Area type="monotone" dataKey="expenses" name="Despesas" stroke="#35c99a" strokeWidth={2.5} fill="url(#expenseFill)"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-note"><span className="note-dot"/> <span>O gráfico acima usa dados ilustrativos. Seus lançamentos aparecem nos indicadores e na lista abaixo.</span></div>
          </div>

          <div className="panel insight-panel" id="insights">
            <div className="insight-title"><div className="ai-icon"><Sparkles size={18}/></div><div><h2>Análise inteligente</h2><p>Resumo automático dos seus dados</p></div></div>
            <div className="insight-highlight"><span className="insight-label">VISÃO DO SEU DINHEIRO</span><strong>{totals.balance >= 0 ? "Seu saldo está positivo." : "Atenção ao seu saldo."}</strong><p>{totals.balance >= 0 ? `Você tem ${formatMoney(totals.balance)} de saldo considerando os lançamentos registrados.` : `Suas despesas superam as receitas em ${formatMoney(Math.abs(totals.balance))}. Revise seus gastos.`}</p></div>
            <div className="insight-row"><div className="mini-icon purple"><Lightbulb size={16}/></div><div><strong>Maior categoria de despesa</strong><p>{topCategory ? `${topCategory[0]} · ${formatMoney(topCategory[1])}` : "Adicione despesas para visualizar."}</p></div></div>
            <div className="insight-row"><div className="mini-icon green"><TrendingUp size={16}/></div><div><strong>Taxa de economia</strong><p>{savingsRate.toFixed(1).replace(".", ",")}% das receitas permanecem no saldo.</p></div></div>
            <div className="insight-disclaimer">Esta análise é automática e informativa. Não é recomendação de investimento.</div>
          </div>
        </section>

        <section className="lower-grid">
          <div className="panel transactions-panel" id="transactions">
            <div className="panel-heading transactions-heading"><div><h2>Últimos lançamentos</h2><p>Consulte e organize suas movimentações.</p></div><button className="text-btn" onClick={() => setModalOpen(true)}>Adicionar novo <Plus size={15}/></button></div>
            <div className="table-tools"><div className="search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar lançamento..."/></div><div className="filter-tabs"><button className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>Todos</button><button className={filter === "income" ? "selected" : ""} onClick={() => setFilter("income")}>Receitas</button><button className={filter === "expense" ? "selected" : ""} onClick={() => setFilter("expense")}>Despesas</button></div></div>
            <div className="transaction-list">
              {filtered.length === 0 ? <div className="empty-state"><FileText size={24}/><strong>Nenhum lançamento encontrado</strong><span>Adicione uma movimentação ou altere sua busca.</span></div> : filtered.slice(0, 8).map(t => (
                <div className="transaction-row" key={t.id}>
                  <div className={`transaction-icon ${t.type}`}>{t.type === "income" ? <ArrowDownLeft size={17}/> : <ArrowUpRight size={17}/>}</div>
                  <div className="transaction-main"><strong>{t.title}</strong><span>{t.category} · {new Date(`${t.date}T12:00:00`).toLocaleDateString("pt-BR")}</span></div>
                  <strong className={`transaction-amount ${t.type}`}>{t.type === "income" ? "+" : "−"} {formatMoney(t.amount)}</strong>
                  <button className="delete-btn" onClick={() => deleteTransaction(t.id)} title="Excluir lançamento" aria-label={`Excluir ${t.title}`}><Trash2 size={15}/></button>
                </div>
              ))}
            </div>
          </div>

          <div className="panel goals-panel" id="goals">
            <div className="panel-heading"><div><h2>Despesas por categoria</h2><p>Distribuição dos seus gastos</p></div><Activity size={18} className="subtle-icon"/></div>
            {expenseByCategory.length === 0 ? <div className="empty-state compact">Adicione despesas para ver as categorias.</div> : <div className="category-list">{expenseByCategory.slice(0, 5).map(([category, amount], index) => {
              const colors = ["#8e7cff", "#35c99a", "#f3b85b", "#5ca9ff", "#e879a9"];
              const percent = totals.expenses ? amount / totals.expenses * 100 : 0;
              return <div className="category-item" key={category}><div className="category-top"><span><i style={{ background: colors[index % colors.length] }}/>{category}</span><strong>{formatMoney(amount)}</strong></div><div className="progress-track"><div style={{ width: `${percent}%`, background: colors[index % colors.length] }}/></div><small>{percent.toFixed(1).replace(".", ",")}% das despesas</small></div>;
            })}</div>}
            <div className="category-footer"><span>Total de despesas</span><strong>{formatMoney(totals.expenses)}</strong></div>
          </div>
        </section>
        <footer className="footer"><span>© 2026 FINANCE IA</span><span>Organização financeira com clareza.</span><span>Versão 1.0 · Demonstração</span></footer>
        </>}
      </main>

      {modalOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
        <form className="modal" onSubmit={addTransaction}>
          <div className="modal-heading"><div><span className="eyebrow">MOVIMENTAÇÃO FINANCEIRA</span><h2>Novo lançamento</h2></div><button type="button" className="icon-btn" onClick={() => setModalOpen(false)} aria-label="Fechar"><X size={19}/></button></div>
          <div className="type-switch"><button type="button" className={form.type === "expense" ? "active expense-tab" : ""} onClick={() => setForm({ ...form, type: "expense" })}>Despesa</button><button type="button" className={form.type === "income" ? "active income-tab" : ""} onClick={() => setForm({ ...form, type: "income" })}>Receita</button></div>
          <label>Descrição<input required autoFocus placeholder="Ex.: Compra de materiais" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label>
          <div className="form-two"><label>Valor ({settings.currency})<input required inputMode="decimal" placeholder="0,00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}/></label><label>Data<input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}/></label></div>
          <label>Categoria<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{(form.type === "income" ? ["Salário", "Serviços", "Vendas", "Investimentos", "Outros"] : ["Alimentação", "Moradia", "Transporte", "Saúde", "Educação", "Lazer", "Serviços", "Outros"]).map(c => <option key={c}>{c}</option>)}</select></label>
          <div className="modal-actions"><button type="button" className="outline-btn" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit" className="primary-btn"><Plus size={16}/> Salvar lançamento</button></div>
        </form>
      </div>}
    </div>
  );
}

function StatCard({ title, value, icon, tone, detail }: { title: string; value: string; icon: React.ReactNode; tone: string; detail: string }) {
  return <div className="stat-card"><div className="stat-top"><span>{title}</span><div className={`stat-icon ${tone}`}>{icon}</div></div><strong className="stat-value">{value}</strong><div className="stat-detail"><span className={`detail-dot ${tone}`}/>{detail}</div></div>;
}

export default App;

