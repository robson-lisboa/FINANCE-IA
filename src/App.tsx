import { useEffect, useMemo, useState } from "react";
import AuthScreen from "./AuthScreen";
import AccountDeletion from "./AccountDeletion";
import ProfileSettings from "./ProfileSettings";
import InvoiceImporter from "./InvoiceImporter";
import GoalsManager from "./GoalsManager";
import FinancialDiagnosis from "./FinancialDiagnosis";
import FinancialEvolution from "./FinancialEvolution";
import PlanningCenter from "./PlanningCenter";
import ProactiveAdvisor from "./ProactiveAdvisor";
import { parseBrazilianMoney } from "./lib/money-core.js";
import { DEFAULT_SETTINGS, readSettings, type AppSettings } from "./lib/preferences.js";
import { deleteTransactionFromCloud, fetchTransactions, insertTransactions, updateTransactionInCloud, readStoredSession, signOut, type AuthSession } from "./lib/supabase";
import {
  Activity, ArrowDownLeft, ArrowUpRight, Bell, CalendarDays,
  CircleHelp, Download, LayoutDashboard, Menu, Plus, Search,
  Settings, Target, TrendingUp, Wallet, X, Trash2, Sparkles, FileText, Pencil, CheckCircle2
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
const LEGACY_BACKUP_KEY = "finance-ia-local-backup-before-cloud-v1";

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
  if (!Array.isArray(value)) return [];

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
const today = (() => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
})();

const initialTransactions: Transaction[] = [];function FinanceDashboard({ session, onSignOut, onSessionExpired }: { session: AuthSession; onSignOut: () => void; onSessionExpired: () => void }) {
  const accountStorageKey = STORAGE_KEY + "-" + session.user.id;
  const settingsStorageKey = SETTINGS_KEY + "-" + session.user.id;
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(accountStorageKey);
      return saved
        ? repairStoredTransactions(JSON.parse(saved) as unknown)
        : initialTransactions;
    } catch {
      return initialTransactions;
    }
  });
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      return readSettings(localStorage.getItem(settingsStorageKey));
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [activePage, setActivePage] = useState(() => ["dashboard", "transactions", "insights", "planning", "goals", "profile", "settings"].includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : "dashboard");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [search, setSearch] = useState("");
  const [transactionMonth, setTransactionMonth] = useState(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`);
  const [form, setForm] = useState({
    title: "", category: "Outros", date: today, amount: "", type: "expense" as Kind
  });
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudError, setCloudError] = useState("");
  const notificationStorageKey = "finance-ia-notifications-read-" + session.user.id;
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(notificationStorageKey) || "[]") as string[]; }
    catch { return []; }
  });

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const loadCloudData = async () => {
      setCloudBusy(true);
      setCloudError("");
      try {
        const savedLocal = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(accountStorageKey);
        if (savedLocal && !localStorage.getItem(LEGACY_BACKUP_KEY)) {
          localStorage.setItem(LEGACY_BACKUP_KEY, savedLocal);
        }
        const remote = await fetchTransactions(session);
        if (!active) return;
        if (remote.length > 0) {
          setTransactions(remote);
        } else {
          const local = savedLocal ? repairStoredTransactions(JSON.parse(savedLocal) as unknown) : [];
          const shouldImport = local.length > 0 && window.confirm("Encontrei " + local.length + " lançamento(s) neste navegador. Deseja importar para sua conta na nuvem? Os dados locais só serão substituídos depois da importação.");
          if (shouldImport) {
            const imported = await insertTransactions(session, local.map(({ id: _id, ...transaction }) => transaction));
            if (active) {
              setTransactions(imported);
              localStorage.removeItem(LEGACY_BACKUP_KEY);
            }
          } else {
            setTransactions([]);
          }
        }
        if (active) {
          setCloudLoaded(true);
          if (localStorage.getItem(STORAGE_KEY)) localStorage.removeItem(STORAGE_KEY);
        }
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : "Não foi possível carregar seus dados da nuvem.";
          if (/sua sessão expirou ou não é mais válida/i.test(message)) onSessionExpired();
          else setCloudError(message);
        }
      } finally {
        if (active) setCloudBusy(false);
      }
    };
    void loadCloudData();
    return () => { active = false; };
  }, [session.user.id, accountStorageKey]);

  useEffect(() => {
    if (cloudLoaded) localStorage.setItem(accountStorageKey, JSON.stringify(transactions));
  }, [transactions, cloudLoaded, accountStorageKey]);

  useEffect(() => {
    localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
  }, [settings, settingsStorageKey]);

  useEffect(() => {
    const syncPage = () => { const page = window.location.hash.slice(1); setActivePage(["dashboard", "transactions", "insights", "planning", "goals", "profile", "settings"].includes(page) ? page : "dashboard"); };
    window.addEventListener("hashchange", syncPage);
    return () => window.removeEventListener("hashchange", syncPage);
  }, []);

  const totals = useMemo(() => {
    const income = transactions.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
    const expenses = transactions.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
    return { income, expenses, balance: income - expenses };
  }, [transactions]);

  const availableTransactionMonths = useMemo(() => {
    const keys = new Set(transactions.filter(t => /^\d{4}-\d{2}-\d{2}$/.test(t.date)).map(t => t.date.slice(0, 7)));
    for (let offset = 0; offset < 12; offset++) {
      const monthDate = new Date(currentTime.getFullYear(), currentTime.getMonth() - offset, 1);
      keys.add(`${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`);
    }
    return [...keys].sort((a, b) => b.localeCompare(a));
  }, [transactions, currentTime]);
  const monthOptionLabel = (key: string) => {
    const [year, month] = key.split("-").map(Number);
    const monthName = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    return monthName + "/" + String(year).slice(-2);
  };

  const filtered = useMemo(() => transactions
    .filter(t => t.date.startsWith(transactionMonth))
    .filter(t => filter === "all" || t.type === filter)
    .filter(t => `${t.title} ${t.category}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date)), [transactions, transactionMonth, filter, search]);

  const monthlyTotals = useMemo(() => {
    const current = transactions.filter(t => t.date.startsWith(transactionMonth));
    const income = current.filter(t => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
    const expenses = current.filter(t => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
    return { income, expenses, balance: income - expenses, count: current.length };
  }, [transactions, transactionMonth]);

  const expenseByCategory = useMemo(() => {
    const totalsByCategory = transactions.filter(t => t.type === "expense" && t.date.startsWith(transactionMonth)).reduce<Record<string, number>>((acc, t) => {
      acc[t.category || "Sem categoria"] = (acc[t.category || "Sem categoria"] || 0) + Number(t.amount);
      return acc;
    }, {});
    return Object.entries(totalsByCategory).sort((a, b) => b[1] - a[1]);
  }, [transactions, transactionMonth]);

  // Agrupa os lançamentos reais nos últimos seis meses, incluindo o mês atual.
  const chartData = useMemo(() => {
    const [selectedYear, selectedMonthNumber] = transactionMonth.split("-").map(Number);
    const selectedDate = new Date(selectedYear, selectedMonthNumber - 1, 1);
    const months = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 5 + index, 1);
      const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
      return {
        key,
        month: monthDate.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        income: 0,
        expenses: 0,
      };
    });

    const totalsByMonth = new Map(months.map(month => [month.key, month]));
    transactions.forEach(transaction => {
      if (!transaction.date || !/^\d{4}-\d{2}-\d{2}$/.test(transaction.date)) return;
      const month = totalsByMonth.get(transaction.date.slice(0, 7));
      if (!month || !Number.isFinite(transaction.amount)) return;
      if (transaction.type === "income") month.income += transaction.amount;
      if (transaction.type === "expense") month.expenses += transaction.amount;
    });

    return months.map(({ month, income, expenses }) => ({ month, income, expenses }));
  }, [transactions, transactionMonth]);

  const openNewTransaction = () => {
    setEditingId(null);
    setForm({ title: "", category: "Outros", date: today, amount: "", type: "expense" });
    setModalOpen(true);
  };

  const openEditTransaction = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setForm({ title: transaction.title, category: transaction.category, date: transaction.date, amount: String(transaction.amount).replace(".", ","), type: transaction.type });
    setModalOpen(true);
  };

  const addTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAmount = parseBrazilianMoney(form.amount);
    if (!cloudLoaded || !form.title.trim() || parsedAmount === null || parsedAmount <= 0) return;
    const amount = parsedAmount;
    setCloudError("");
    try {
      const payload = { title: form.title.trim(), category: form.category, date: form.date, amount, type: form.type };
      if (editingId) {
        const saved = await updateTransactionInCloud(session, editingId, payload);
        setTransactions(current => current.map(transaction => transaction.id === editingId ? saved : transaction));
      } else {
        const saved = await insertTransactions(session, [payload]);
        setTransactions(current => [saved[0], ...current]);
      }
      setForm({ title: "", category: "Outros", date: today, amount: "", type: "expense" });
      setEditingId(null);
      setModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível salvar o lançamento na nuvem.";
      if (/sua sessão expirou ou não é mais válida/i.test(message)) onSessionExpired();
      else setCloudError(message);
    }
  };

  const deleteTransaction = async (id: string) => {
    setCloudError("");
    try {
      await deleteTransactionFromCloud(session, id);
      setTransactions(current => current.filter(t => t.id !== id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível excluir o lançamento na nuvem.";
      if (/sua sessão expirou ou não é mais válida/i.test(message)) onSessionExpired();
      else setCloudError(message);
    }
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

  type AiAlert = { id:string; title:string; severity:"critical"|"warning"|"info"; message:string; evidence:string; action:string };
  const [notifications,setNotifications] = useState<AiAlert[]>([]);
  const [notificationSummary,setNotificationSummary] = useState("");
  const [notificationsLoading,setNotificationsLoading] = useState(false);
  const [notificationError,setNotificationError] = useState("");
  const [notificationRefresh,setNotificationRefresh] = useState(0);
  const transactionFingerprint = useMemo(()=>transactions.map(t=>[t.id,t.date,t.amount,t.type,t.title,t.category].join("|")).join(";"),[transactions]);
  const unreadNotifications = notifications.filter(item=>!readNotifications.includes(item.id)).length;
  useEffect(()=>{localStorage.setItem(notificationStorageKey,JSON.stringify(readNotifications));},[readNotifications,notificationStorageKey]);
  useEffect(()=>{
    if(!notificationsOpen) return;
    const controller=new AbortController();
    setNotificationsLoading(true);
    setNotificationError("");
    fetch("/api/assistant/alerts",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:JSON.stringify({selectedMonth:transactionMonth}),signal:controller.signal})
      .then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"Falha ao consultar a IA.");return data;})
      .then(data=>{if(controller.signal.aborted)return;setNotifications(Array.isArray(data.alerts)?data.alerts:[]);setNotificationSummary(typeof data.summary==="string"?data.summary:"");})
      .catch(error=>{if(!controller.signal.aborted)setNotificationError(error instanceof Error?error.message:"Não foi possível analisar agora.");})
      .finally(()=>{if(!controller.signal.aborted)setNotificationsLoading(false);});
    return ()=>controller.abort();
  },[notificationsOpen,transactionMonth,transactionFingerprint,session.access_token,notificationRefresh]);
  const markNotificationRead = (id:string) => setReadNotifications(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id]);
  const formatMoney = (value: number) => money(value, settings.currency);
  const savingsRate = monthlyTotals.income > 0 ? (monthlyTotals.balance / monthlyTotals.income) * 100 : null;
  const previousMonthKey = (() => {
    const [year, month] = transactionMonth.split("-").map(Number);
    const date = new Date(year, month - 2, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  })();
  const previousMonthTotals = transactions.filter(t => t.date.startsWith(previousMonthKey)).reduce(
    (totals, transaction) => {
      if (transaction.type === "income") totals.income += Number(transaction.amount) || 0;
      if (transaction.type === "expense") totals.expenses += Number(transaction.amount) || 0;
      return totals;
    },
    { income: 0, expenses: 0 }
  );
  const previousMonthBalance = previousMonthTotals.income - previousMonthTotals.expenses;
  const financialHealth = (() => {
    if (monthlyTotals.count < 3 || monthlyTotals.income <= 0) return { status: "unknown", label: "Dados insuficientes", color: "#8190a8", description: "Cadastre receitas e despesas para um diagnóstico confiável." };
    if (monthlyTotals.balance < 0) return { status: "critical", label: "Saúde crítica", color: "#ef6b75", description: "As despesas estão acima das receitas registradas." };
    if (previousMonthTotals.income > 0 && previousMonthBalance < 0 && monthlyTotals.balance >= 0) return { status: "recovery", label: "Em recuperação", color: "#e5a34d", description: "O resultado melhorou e saiu do negativo em relação ao mês anterior." };
    const rate = (monthlyTotals.balance / monthlyTotals.income) * 100;
    if (rate >= 20) return { status: "excellent", label: "Saúde excelente", color: "#35c99a", description: "Você está mantendo uma boa margem entre receitas e despesas." };
    if (rate >= 10) return { status: "good", label: "Saúde boa", color: "#69b98b", description: "Seu resultado está positivo. Continue acompanhando os gastos." };
    return { status: "attention", label: "Atenção ao orçamento", color: "#d9ad52", description: "Sua margem está positiva, mas merece acompanhamento." };
  })();

  if (!cloudLoaded) {
    return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><span><Activity size={23}/></span><div><strong>FINANCE <b>IA</b></strong><small>CONTROLE FINANCEIRO PESSOAL</small></div></div><h1 className="auth-heading">Conectando sua conta</h1><p className="auth-footnote">{cloudBusy ? "Carregando seus dados protegidos..." : cloudError || "Aguardando sincronização."}</p>{cloudError && <button className="primary-btn auth-submit" onClick={() => window.location.reload()}>Tentar novamente</button>}</section></main>;
  }

  return (
    <div
      className={`app-shell health-${financialHealth.status} ${settings.theme === "light" ? "theme-light" : ""} density-${settings.density} font-${settings.fontScale}`}
      style={{ "--accent": financialHealth.status === "unknown" ? (settings.customAccent || ACCENT_COLORS[settings.accent]) : financialHealth.color, "--accent-soft": `color-mix(in srgb, ${financialHealth.status === "unknown" ? (settings.customAccent || ACCENT_COLORS[settings.accent]) : financialHealth.color} 18%, transparent)`, "--health-tint": `color-mix(in srgb, ${financialHealth.color} 5%, transparent)` } as React.CSSProperties}
    >
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Activity size={21} /></div>
          <div><strong>FINANCE <span>IA</span></strong><small>CONTROLE INTELIGENTE</small></div>
          <button className="icon-btn mobile-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={19}/></button>
        </div>
        <div className="workspace-label">MENU PRINCIPAL</div>
        <nav className="nav-list">
          <a className={`nav-item ${activePage === "dashboard" ? "active" : ""}`} href="#dashboard" onClick={() => { setActivePage("dashboard"); setMenuOpen(false); }}><LayoutDashboard size={18}/> Visão geral</a>
          <a className={`nav-item ${activePage === "transactions" ? "active" : ""}`} href="#transactions" onClick={() => { setActivePage("transactions"); setMenuOpen(false); }}><Wallet size={18}/> Lançamentos</a>
          <a className={`nav-item ${activePage === "insights" ? "active" : ""}`} href="#insights" onClick={() => { setActivePage("insights"); setMenuOpen(false); }}><Sparkles size={18}/> Análise inteligente</a>
          <a className={`nav-item ${activePage === "planning" ? "active" : ""}`} href="#planning" onClick={() => { setActivePage("planning"); setMenuOpen(false); }}><TrendingUp size={18}/> Planejamento</a>
          <a className={`nav-item ${activePage === "goals" ? "active" : ""}`} href="#goals" onClick={() => { setActivePage("goals"); setMenuOpen(false); }}><Target size={18}/> Metas financeiras</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><CircleHelp size={18}/></div>
            <strong>Precisa de ajuda?</strong>
            <p>Organize suas finanças com mais clareza.</p>
            <button type="button" className="help-link" onClick={() => setHelpOpen(true)}>Ver dicas <span>→</span></button>
          </div>
          <a className={`nav-item muted ${activePage === "profile" ? "active" : ""}`} href="#profile" onClick={() => { setActivePage("profile"); setMenuOpen(false); }}><Activity size={18}/> Meu perfil</a>
          <a className={`nav-item muted ${activePage === "settings" ? "active" : ""}`} href="#settings" onClick={() => { setActivePage("settings"); setMenuOpen(false); }}><Settings size={18}/> Configurações</a>
          <div className="profile">
            <div className="avatar">R</div>
            <div className="profile-text"><strong>{session.user.email || "Minha conta"}</strong><small>Conta sincronizada</small></div>
            <button className="profile-signout" onClick={onSignOut} title="Sair da conta">Sair</button>
          </div>
        </div>
      </aside>

      {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"/>}

      <main className="main-content" id="dashboard">
        {cloudError && <div className="cloud-alert" role="alert">{cloudError}</div>}
        {cloudBusy && <div className="cloud-status">Sincronizando seus lançamentos com segurança...</div>}
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-btn mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu size={20}/></button>
            <div><div className="breadcrumb">Workspace <span>/</span> <b>{{dashboard: "Visão geral", transactions: "Lançamentos", insights: "Relatório inteligente", planning: "Planejamento financeiro", goals: "Metas financeiras", profile: "Meu perfil", settings: "Configurações"}[activePage] || "Visão geral"}</b></div><div className="welcome">{currentTime.getHours() < 12 ? "Bom dia" : currentTime.getHours() < 18 ? "Boa tarde" : "Boa noite"}! <span>Vamos cuidar do seu dinheiro.</span><span className="health-status-pill" title={financialHealth.description}><i/> {financialHealth.label}</span></div></div>
          </div>
          <div className="topbar-actions">
            <label className="month-filter-control global-month-filter"><CalendarDays size={16}/><span>Período</span><select aria-label="Selecionar mês do painel" value={transactionMonth} onChange={e => setTransactionMonth(e.target.value)}>{availableTransactionMonths.map(month => <option key={month} value={month}>{monthOptionLabel(month)}</option>)}</select></label>
            <div className="notification-wrap">
              <button type="button" className={`icon-btn notification-btn ${notificationsOpen ? "is-open" : ""}`} aria-label={`Notificações: ${unreadNotifications} não lidas`} aria-expanded={notificationsOpen} onClick={()=>setNotificationsOpen(open=>!open)}><Bell size={18}/>{unreadNotifications>0 && <i/>}<span className="notification-count">{unreadNotifications>99?"99+":unreadNotifications}</span></button>
              {notificationsOpen && <div className="notification-popover" role="dialog" aria-label="Central de notificações">
                <div className="notification-popover-head"><div><strong>Notificações</strong><small>{unreadNotifications} não lida(s) · {monthOptionLabel(transactionMonth)}</small></div><button type="button" className="text-btn" onClick={()=>setReadNotifications(current=>[...new Set([...current,...notifications.map(item=>item.id)])])} disabled={unreadNotifications===0||notificationsLoading}>Marcar todas como lidas</button></div>
                <div className="notification-ai-summary"><Sparkles size={15}/><span>{notificationSummary||"A IA vai examinar seus lançamentos e procurar sinais que merecem atenção."}</span></div>
                {notificationError && <div className="notification-error" role="alert"><span>{notificationError}</span><button type="button" onClick={()=>setNotificationRefresh(value=>value+1)}>Tentar novamente</button></div>}
                <div className="notification-items">{notificationsLoading?<div className="notification-empty"><span className="notification-ai-spinner"/><strong>Analisando suas finanças...</strong><span>A IA está comparando seus lançamentos e procurando padrões.</span></div>:notificationError?null:notifications.length===0?<div className="notification-empty"><CheckCircle2 size={21}/><strong>Nenhum alerta relevante encontrado</strong><span>A IA não identificou sinais que justifiquem um alerta nos registros disponíveis deste mês.</span></div>:notifications.map(item=><button type="button" key={item.id} className={`notification-item ${item.severity} ${readNotifications.includes(item.id)?"read":""}`} onClick={()=>markNotificationRead(item.id)}><span className="notification-item-icon">{item.severity==="critical"?"!":item.severity==="warning"?"⚠":"i"}</span><span className="notification-item-copy"><strong>{item.title}</strong><small>{item.message}</small><small className="notification-evidence"><b>O que a IA observou:</b> {item.evidence}</small><small className="notification-action"><b>Próxima ação:</b> {item.action}</small><em>{readNotifications.includes(item.id)?"Lida · toque para marcar como não lida":"Nova · toque para marcar como lida"}</em></span></button>)}</div>
                <div className="notification-popover-foot"><span>IA analisa até 250 lançamentos da sua conta.</span><button type="button" onClick={()=>setNotificationsOpen(false)}>Fechar</button></div>
              </div>}
            </div>
            <button className="primary-btn top-add" onClick={openNewTransaction}><Plus size={17}/> Novo lançamento</button>
          </div>
        </header>

        {activePage === "profile" ? (
          <ProfileSettings session={session}/>
        ) : activePage === "settings" ? (
          <section className="settings-page">
            <div className="page-heading">
              <div><p className="eyebrow">PREFERÊNCIAS DO SISTEMA</p><h1>Configurações</h1><p className="muted-text">Personalize a aparência do seu Finance IA.</p></div>
            </div>
            <div className="panel settings-panel">
              <div className="settings-section-heading"><div><h2>Aparência e preferências</h2><p>Personalize o visual e escolha o que aparece no seu painel.</p></div><span className="settings-preview-icon"><Settings size={19}/></span></div>
              <div className="settings-control">
                <div><strong>Tema</strong><small>Alterne entre modo escuro e claro.</small></div>
                <div className="settings-options">
                  <button type="button" className={`settings-choice ${settings.theme === "dark" ? "selected" : ""}`} onClick={() => setSettings(current => ({ ...current, theme: "dark" }))}>◐ Escuro</button>
                  <button type="button" className={`settings-choice ${settings.theme === "light" ? "selected" : ""}`} onClick={() => setSettings(current => ({ ...current, theme: "light" }))}>☀ Claro</button>
                </div>
              </div>
              <div className="settings-control accent-control">
                <div><strong>Cor principal</strong><small>Escolha uma cor pronta ou crie a sua.</small></div>
                <div className="accent-options">
                  {([{ id: "purple", label: "Roxo" }, { id: "blue", label: "Azul" }, { id: "green", label: "Verde" }, { id: "red", label: "Vermelho" }] as const).map(color => (
                    <button type="button" key={color.id} className={`accent-choice ${!settings.customAccent && settings.accent === color.id ? "selected" : ""}`} onClick={() => setSettings(current => ({ ...current, accent: color.id, customAccent: "" }))} aria-pressed={!settings.customAccent && settings.accent === color.id}>
                      <i style={{ background: ACCENT_COLORS[color.id] }}/>{color.label}
                    </button>
                  ))}
                  <label className={`accent-choice custom-color-choice ${settings.customAccent ? "selected" : ""}`}>
                    <i style={{ background: settings.customAccent || "#9a8cff" }}/> Personalizada
                    <input aria-label="Escolher cor personalizada" type="color" value={settings.customAccent || ACCENT_COLORS[settings.accent]} onChange={event => setSettings(current => ({ ...current, customAccent: event.target.value }))}/>
                  </label>
                </div>
              </div>
              <div className="settings-control">
                <div><strong>Espaçamento</strong><small>Escolha uma tela mais compacta ou mais arejada.</small></div>
                <div className="settings-options">
                  <button type="button" className={`settings-choice ${settings.density === "comfortable" ? "selected" : ""}`} onClick={() => setSettings(current => ({ ...current, density: "comfortable" }))}>Confortável</button>
                  <button type="button" className={`settings-choice ${settings.density === "compact" ? "selected" : ""}`} onClick={() => setSettings(current => ({ ...current, density: "compact" }))}>Compacto</button>
                </div>
              </div>
              <div className="settings-control">
                <div><strong>Tamanho do texto</strong><small>Ajuste a leitura do painel.</small></div>
                <div className="settings-options">
                  {([{id:"small",label:"Pequeno"},{id:"normal",label:"Padrão"},{id:"large",label:"Grande"}] as const).map(size => <button type="button" key={size.id} className={`settings-choice ${settings.fontScale === size.id ? "selected" : ""}`} onClick={() => setSettings(current => ({ ...current, fontScale: size.id }))}>{size.label}</button>)}
                </div>
              </div>
              <div className="settings-control currency-control">
                <div><strong>Moeda de exibição</strong><small>Altera apenas o símbolo e a formatação, não converte valores.</small></div>
                <select className="settings-select" value={settings.currency} onChange={event => setSettings(current => ({ ...current, currency: event.target.value as AppSettings["currency"] }))}>
                  <option value="BRL">Real brasileiro (BRL · R$)</option>
                  <option value="USD">Dólar americano (USD · US$)</option>
                  <option value="EUR">Euro (EUR · €)</option>
                </select>
              </div>
              <div className="settings-widget-section">
                <div><strong>Meu painel inicial</strong><small>Ative somente os blocos que deseja visualizar. As alterações aparecem imediatamente.</small></div>
                <div className="settings-widget-grid">
                  {([{id:"stats",label:"Indicadores financeiros"},{id:"chart",label:"Gráfico de fluxo"},{id:"advisor",label:"Consultor inteligente"},{id:"transactions",label:"Últimos lançamentos"},{id:"categories",label:"Despesas por categoria"}] as const).map(widget => (
                    <label className="settings-toggle" key={widget.id}>
                      <input type="checkbox" checked={settings.widgets[widget.id]} onChange={event => setSettings(current => ({ ...current, widgets: { ...current.widgets, [widget.id]: event.target.checked } }))}/>
                      <span>{widget.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="settings-footer"><span>Preferências salvas automaticamente neste navegador e restauradas ao voltar. Seus lançamentos não são alterados por estas opções.</span><button type="button" className="outline-btn" onClick={() => setSettings(DEFAULT_SETTINGS)}>Restaurar padrão</button></div>
              <AccountDeletion session={session} />
            </div>
          </section>
        ) : activePage === "transactions" ? (
          <section className={`page-section dashboard-layout dashboard-${financialHealth.status}`}>
            <div className="page-heading">
              <div><p className="eyebrow">CONTROLE DE MOVIMENTAÇÕES</p><h1>Lançamentos</h1><p className="muted-text">Consulte, pesquise e organize todas as suas receitas e despesas.</p></div>
              <div className="transaction-actions"><button className="outline-btn" onClick={() => setInvoiceOpen(true)}><FileText size={16}/> Importar fatura</button> <button className="primary-btn" onClick={openNewTransaction}><Plus size={16}/> Novo lançamento</button></div>
            </div>
            <div className="panel transactions-panel full-page-panel">
              <div className="table-tools">
                <label className="month-filter-control"><CalendarDays size={16}/><span>Mês</span><select aria-label="Filtrar lançamentos por mês" value={transactionMonth} onChange={e => setTransactionMonth(e.target.value)}>{availableTransactionMonths.map(month => <option key={month} value={month}>{monthOptionLabel(month)}</option>)}</select></label>
                <div className="search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por descrição ou categoria..."/></div>
                <div className="filter-tabs"><button className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>Todos</button><button className={filter === "income" ? "selected" : ""} onClick={() => setFilter("income")}>Receitas</button><button className={filter === "expense" ? "selected" : ""} onClick={() => setFilter("expense")}>Despesas</button></div>
              </div>
              <div className="transaction-list">
                {filtered.length === 0 ? <div className="empty-state"><FileText size={24}/><strong>Nenhum lançamento encontrado</strong><span>Cadastre uma movimentação ou altere sua busca.</span></div> : filtered.map(t => (
                  <div className="transaction-row" key={t.id}>
                    <div className={`transaction-icon ${t.type}`}>{t.type === "income" ? <ArrowDownLeft size={17}/> : <ArrowUpRight size={17}/>}</div>
                    <div className="transaction-main"><strong>{t.title}</strong><span>{t.category} · {new Date(`${t.date}T12:00:00`).toLocaleDateString("pt-BR")}</span></div>
                    <strong className={`transaction-amount ${t.type}`}>{t.type === "income" ? "+" : "−"} {formatMoney(t.amount)}</strong>
                    <button className="edit-btn" onClick={() => openEditTransaction(t)} title="Editar lançamento" aria-label={`Editar ${t.title}`}><Pencil size={15}/></button>
                    <button className="delete-btn" onClick={() => deleteTransaction(t.id)} title="Excluir lançamento" aria-label={`Excluir ${t.title}`}><Trash2 size={15}/></button>
                  </div>
                ))}
              </div>
              <div className="category-footer"><span>{filtered.length} lançamento(s) em {monthOptionLabel(transactionMonth)}</span><strong>{formatMoney(filtered.reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0))}</strong></div>
            </div>
          </section>
        ) : activePage === "insights" ? (
          <FinancialDiagnosis transactions={transactions} formatMoney={formatMoney} accessToken={session.access_token} selectedMonth={transactionMonth}/>
        ) : activePage === "planning" ? (
          <PlanningCenter transactions={transactions} formatMoney={formatMoney} selectedMonth={transactionMonth}/>
        ) : activePage === "goals" ? (
          <GoalsManager session={session} balance={totals.balance} formatMoney={formatMoney}/>
        ) : (
        <>
        <section className="page-section">
        <section className="page-heading">
          <div><p className="eyebrow">SEU RESUMO FINANCEIRO</p><h1>Visão geral</h1><p className="muted-text">Acompanhe sua vida financeira em {monthOptionLabel(transactionMonth)}.</p></div>
          <button className="outline-btn" onClick={exportCsv}><Download size={16}/> Exportar dados</button>
        </section>

        <section className={`health-guidance health-guidance-${financialHealth.status}`} aria-live="polite">
          <div className="health-guidance-mark"><Activity size={19}/></div>
          <div className="health-guidance-copy">
            <span className="eyebrow">PRIORIDADE DO MOMENTO</span>
            <strong>{financialHealth.status === "critical" ? "Vamos recuperar o equilíbrio" : financialHealth.status === "recovery" ? "Continue no caminho da recuperação" : financialHealth.status === "attention" ? "Proteja sua margem financeira" : financialHealth.status === "excellent" ? "Transforme seu resultado em conquistas" : financialHealth.status === "good" ? "Mantenha sua evolução" : "Vamos conhecer sua vida financeira"}</strong>
            <p>{financialHealth.status === "critical" ? "Comece revisando despesas e compromissos próximos. O foco agora é reduzir a diferença entre o que entra e o que sai." : financialHealth.status === "recovery" ? "Seu resultado voltou ao positivo em relação ao mês anterior. Preserve esse avanço e acompanhe os gastos variáveis." : financialHealth.status === "attention" ? "Sua margem está positiva, mas pequena. Observe despesas recorrentes e evite comprometer o orçamento antes de fechar o mês." : financialHealth.status === "excellent" ? "Com uma margem positiva, você pode fortalecer sua reserva e avançar em metas sem perder o controle." : financialHealth.status === "good" ? "Seu orçamento está positivo. Continue acompanhando a evolução das receitas e despesas." : "Cadastre receitas e despesas do período para receber prioridades e recomendações baseadas nos seus próprios dados."}</p>
          </div>
          <span className="health-guidance-status">{financialHealth.label}</span>
        </section>

        <FinancialEvolution transactions={transactions} selectedMonth={transactionMonth} formatMoney={formatMoney}/>

        {settings.widgets.stats && <section className="stats-grid">
          <StatCard title="Resultado do mês" value={formatMoney(monthlyTotals.balance)} icon={<Wallet size={19}/>} tone="purple" detail={`Receitas menos despesas · ${monthOptionLabel(transactionMonth)}`} />
          <StatCard title="Receitas do mês" value={formatMoney(monthlyTotals.income)} icon={<ArrowDownLeft size={19}/>} tone="green" detail={`Entradas em ${monthOptionLabel(transactionMonth)}`} />
          <StatCard title="Despesas do mês" value={formatMoney(monthlyTotals.expenses)} icon={<ArrowUpRight size={19}/>} tone="red" detail={`Saídas em ${monthOptionLabel(transactionMonth)}`} />
          <StatCard title="Taxa de economia" value={savingsRate === null ? "—" : `${savingsRate.toFixed(1).replace(".", ",")}%`} icon={<TrendingUp size={19}/>} tone="blue" detail={`Resultado sobre receitas · ${monthOptionLabel(transactionMonth)}`} />
        </section>}

        {(settings.widgets.chart || settings.widgets.advisor) && <section className="content-grid" style={{ gridTemplateColumns: settings.widgets.chart && settings.widgets.advisor ? undefined : "minmax(0, 1fr)" }}>
          {settings.widgets.chart && <div className="panel chart-panel">
            <div className="panel-heading"><div><h2>Fluxo financeiro</h2><p>Seis meses até {monthOptionLabel(transactionMonth)}, calculados pelos seus lançamentos</p></div><span className="select-chip">6 meses até {monthOptionLabel(transactionMonth)}</span></div>
            <div className="chart-legend"><span><i className="legend-income"/> Receitas</span><span><i className="legend-expense"/> Despesas</span></div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={settings.customAccent || ACCENT_COLORS[settings.accent]} stopOpacity={0.28}/><stop offset="95%" stopColor={settings.customAccent || ACCENT_COLORS[settings.accent]} stopOpacity={0}/></linearGradient>
                    <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#35c99a" stopOpacity={0.16}/><stop offset="95%" stopColor="#35c99a" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid stroke="#242b3d" strokeDasharray="4 5" vertical={false}/>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#78839b", fontSize: 12 }}/>
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#78839b", fontSize: 11 }} tickFormatter={(v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: settings.currency, notation: "compact", maximumFractionDigits: 1 }).format(v)}/>
                  <Tooltip contentStyle={{ background: "#151c2d", border: "1px solid #303950", borderRadius: 12, color: "#f4f6fb" }} formatter={(value) => formatMoney(Number(value))}/>
                  <Area type="monotone" dataKey="income" name="Receitas" stroke={settings.customAccent || ACCENT_COLORS[settings.accent]} strokeWidth={2.5} fill="url(#incomeFill)"/>
                  <Area type="monotone" dataKey="expenses" name="Despesas" stroke="#35c99a" strokeWidth={2.5} fill="url(#expenseFill)"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-note"><span className="note-dot"/> <span>{transactions.length === 0 ? "Ainda não há lançamentos. Adicione receitas e despesas para construir seu histórico." : "Este gráfico é atualizado automaticamente com os lançamentos cadastrados."}</span></div>
          </div>}

          {settings.widgets.advisor && <ProactiveAdvisor transactions={transactions} formatMoney={formatMoney} selectedMonth={transactionMonth}/>}
        </section>}

        {(settings.widgets.transactions || settings.widgets.categories) && <section className="lower-grid" style={{ gridTemplateColumns: settings.widgets.transactions && settings.widgets.categories ? undefined : "minmax(0, 1fr)" }}>
          {settings.widgets.transactions && <div className="panel transactions-panel" id="transactions">
            <div className="panel-heading transactions-heading"><div><h2>Últimos lançamentos</h2><p>Consulte e organize suas movimentações.</p></div><button className="text-btn" onClick={openNewTransaction}>Adicionar novo <Plus size={15}/></button></div>
            <div className="table-tools"><div className="search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar lançamento..."/></div><div className="filter-tabs"><button className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>Todos</button><button className={filter === "income" ? "selected" : ""} onClick={() => setFilter("income")}>Receitas</button><button className={filter === "expense" ? "selected" : ""} onClick={() => setFilter("expense")}>Despesas</button></div></div>
            <div className="transaction-list">
              {filtered.length === 0 ? <div className="empty-state"><FileText size={24}/><strong>Nenhum lançamento encontrado</strong><span>Adicione uma movimentação ou altere sua busca.</span></div> : filtered.slice(0, 8).map(t => (
                <div className="transaction-row" key={t.id}>
                  <div className={`transaction-icon ${t.type}`}>{t.type === "income" ? <ArrowDownLeft size={17}/> : <ArrowUpRight size={17}/>}</div>
                  <div className="transaction-main"><strong>{t.title}</strong><span>{t.category} · {new Date(`${t.date}T12:00:00`).toLocaleDateString("pt-BR")}</span></div>
                  <strong className={`transaction-amount ${t.type}`}>{t.type === "income" ? "+" : "−"} {formatMoney(t.amount)}</strong>
                  <button className="edit-btn" onClick={() => openEditTransaction(t)} title="Editar lançamento" aria-label={`Editar ${t.title}`}><Pencil size={15}/></button>
                  <button className="delete-btn" onClick={() => deleteTransaction(t.id)} title="Excluir lançamento" aria-label={`Excluir ${t.title}`}><Trash2 size={15}/></button>
                </div>
              ))}
            </div>
          </div>}

          {settings.widgets.categories && <div className="panel goals-panel" id="goals">
            <div className="panel-heading"><div><h2>Despesas por categoria</h2><p>Distribuição dos gastos em {monthOptionLabel(transactionMonth)}</p></div><Activity size={18} className="subtle-icon"/></div>
            {expenseByCategory.length === 0 ? <div className="empty-state compact">Adicione despesas para ver as categorias.</div> : <div className="category-list">{expenseByCategory.slice(0, 5).map(([category, amount], index) => {
              const colors = ["#8e7cff", "#35c99a", "#f3b85b", "#5ca9ff", "#e879a9"];
              const percent = monthlyTotals.expenses ? amount / monthlyTotals.expenses * 100 : 0;
              return <div className="category-item" key={category}><div className="category-top"><span><i style={{ background: colors[index % colors.length] }}/>{category}</span><strong>{formatMoney(amount)}</strong></div><div className="progress-track"><div style={{ width: `${percent}%`, background: colors[index % colors.length] }}/></div><small>{percent.toFixed(1).replace(".", ",")}% das despesas</small></div>;
            })}</div>}
            <div className="category-footer"><span>Total de despesas · {monthOptionLabel(transactionMonth)}</span><strong>{formatMoney(monthlyTotals.expenses)}</strong></div>
          </div>}
        </section>}
        </section>
        <footer className="footer"><span>© 2026 FINANCE IA</span><span>Organização financeira com clareza.</span><span>Versão 1.0 · Demonstração</span></footer>
        </>
        )}
      </main>

      {invoiceOpen && <InvoiceImporter transactions={transactions} onClose={() => setInvoiceOpen(false)} onImport={async rows => { const normalizeTitle = (value: string) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim(); const existing = new Set(transactions.filter(t => t.type === "expense").map(t => `${normalizeTitle(t.title)}|${t.date}|${t.amount.toFixed(2)}`)); const fresh = rows.filter(row => !existing.has(`${normalizeTitle(row.title)}|${row.date}|${row.amount.toFixed(2)}`)); if (!fresh.length) throw new Error("Essas compras já existem nos seus lançamentos. Nenhuma duplicidade foi importada."); const saved = await insertTransactions(session, fresh.map(row => ({ ...row, type: "expense" as Kind }))); setTransactions(current => [...saved, ...current]); const counts = new Map<string, number>(); fresh.forEach(row => { const key = row.date.slice(0, 7); counts.set(key, (counts.get(key) || 0) + 1); }); const detectedMonth = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]; if (detectedMonth) setTransactionMonth(detectedMonth); }} />}
      {helpOpen && <div className="modal-backdrop help-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setHelpOpen(false); }}>
        <section className="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
          <div className="modal-heading">
            <div><span className="eyebrow">CENTRAL DE AJUDA</span><h2 id="help-title">Como podemos ajudar?</h2></div>
            <button type="button" className="icon-btn" onClick={() => setHelpOpen(false)} aria-label="Fechar ajuda"><X size={19}/></button>
          </div>
          <p className="help-intro">Veja orientações rápidas para começar a usar o Finance IA.</p>
          <div className="help-topic"><strong>1. Cadastrar receitas e despesas</strong><p>Clique em “Novo lançamento”, escolha Receita ou Despesa, informe descrição, valor, data e categoria e depois selecione “Salvar lançamento”.</p></div>
          <div className="help-topic"><strong>2. Acompanhar seu saldo</strong><p>Na Visão geral, o saldo é calculado pelas receitas menos as despesas que você cadastrou. Os gráficos são atualizados com esses lançamentos.</p></div>
          <div className="help-topic"><strong>3. Consultar e filtrar lançamentos</strong><p>Use a busca para localizar uma movimentação e os filtros Todos, Receitas e Despesas para organizar a lista.</p></div>
          <div className="help-topic"><strong>4. Personalizar o sistema</strong><p>Em Configurações, você pode alterar tema, criar uma cor, ajustar texto e espaçamento e escolher quais blocos aparecem no painel. A moeda muda apenas a exibição, sem conversão.</p></div>
          <div className="help-note">Dica: seus lançamentos são sincronizados com sua conta na nuvem. Se aparecer uma mensagem de erro, confira sua conexão e tente novamente.</div>
        </section>
      </div>}
      {modalOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
        <form className="modal" onSubmit={addTransaction}>
          <div className="modal-heading"><div><span className="eyebrow">MOVIMENTAÇÃO FINANCEIRA</span><h2>{editingId ? "Editar lançamento" : "Novo lançamento"}</h2></div><button type="button" className="icon-btn" onClick={() => setModalOpen(false)} aria-label="Fechar"><X size={19}/></button></div>
          <div className="type-switch"><button type="button" className={form.type === "expense" ? "active expense-tab" : ""} onClick={() => setForm({ ...form, type: "expense" })}>Despesa</button><button type="button" className={form.type === "income" ? "active income-tab" : ""} onClick={() => setForm({ ...form, type: "income" })}>Receita</button></div>
          <label>Descrição<input required autoFocus placeholder="Ex.: Compra de materiais" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label>
          <div className="form-two"><label>Valor ({settings.currency})<input required inputMode="decimal" placeholder="0,00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}/></label><label>Data<input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}/></label></div>
          <label>Categoria<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{(form.type === "income" ? ["Salário", "Serviços", "Vendas", "Investimentos", "Outros"] : ["Alimentação", "Moradia", "Transporte", "Saúde", "Educação", "Lazer", "Serviços", "Outros"]).map(c => <option key={c}>{c}</option>)}</select></label>
          <div className="modal-actions"><button type="button" className="outline-btn" onClick={() => { setModalOpen(false); setEditingId(null); }}>Cancelar</button><button type="submit" className="primary-btn" disabled={!cloudLoaded || cloudBusy}>{editingId ? <><CheckCircle2 size={16}/> Salvar alterações</> : <><Plus size={16}/> Salvar lançamento</>}</button></div>
        </form>
      </div>}
    </div>
  );
}

function StatCard({ title, value, icon, tone, detail }: { title: string; value: string; icon: React.ReactNode; tone: string; detail: string }) {
  return <div className="stat-card"><div className="stat-top"><span>{title}</span><div className={`stat-icon ${tone}`}>{icon}</div></div><strong className="stat-value">{value}</strong><div className="stat-detail"><span className={`detail-dot ${tone}`}/>{detail}</div></div>;
}

function App() {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    setSession(readStoredSession());
    setCheckingSession(false);
  }, []);

  const handleSignOut = async () => {
    if (!session) return;
    await signOut(session);
    setSession(null);
  };

  if (checkingSession) return <main className="auth-screen"><div className="cloud-status">Preparando acesso seguro...</div></main>;
  if (!session) return <AuthScreen onAuthenticated={setSession}/>;
  if (!session.user || typeof session.user.id !== "string" || !session.user.id) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <h1 className="auth-heading">Sessão incompleta</h1>
          <p className="auth-footnote">Não foi possível validar os dados da sua conta. Entre novamente para continuar.</p>
          <button className="primary-btn auth-submit" onClick={() => {
            localStorage.removeItem("finance-ia-auth-session-v1");
            setSession(null);
          }}>Voltar ao login</button>
        </section>
      </main>
    );
  }
  return <FinanceDashboard key={session.user.id} session={session} onSignOut={() => { void handleSignOut(); }} onSessionExpired={() => setSession(null)}/>;
}

export default App;

