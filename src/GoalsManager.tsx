import { useEffect, useState } from "react";
import { Plus, Target, Trash2, Pencil, CalendarDays, PiggyBank, CheckCircle2 } from "lucide-react";
import { createFinancialGoal, deleteFinancialGoal, fetchFinancialGoals, updateFinancialGoal, type AuthSession, type FinancialGoal } from "./lib/supabase";

type Props = { session: AuthSession; balance: number; formatMoney: (value: number) => string };

const blank = { title: "", target_amount: "", saved_amount: "0", deadline: "" };
const moneyInput = (value: string) => Number(value.replace(/\./g, "").replace(",", "."));

export default function GoalsManager({ session, balance, formatMoney }: Props) {
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setBusy(true); setError("");
    try { setGoals(await fetchFinancialGoals(session)); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar suas metas."); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, [session.user.id]);

  const startNew = () => { setEditing(null); setForm(blank); setOpen(true); setError(""); };
  const startEdit = (goal: FinancialGoal) => {
    setEditing(goal.id);
    setForm({ title: goal.title, target_amount: String(goal.target_amount).replace(".", ","), saved_amount: String(goal.saved_amount).replace(".", ","), deadline: goal.deadline });
    setOpen(true); setError("");
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const target = moneyInput(form.target_amount);
    const saved = moneyInput(form.saved_amount);
    if (!form.title.trim() || !Number.isFinite(target) || target <= 0 || !Number.isFinite(saved) || saved < 0 || !form.deadline) {
      setError("Preencha o nome, os valores e o prazo corretamente."); return;
    }
    setSaving(true); setError("");
    try {
      const payload = { title: form.title.trim(), target_amount: target, saved_amount: saved, deadline: form.deadline };
      const result = editing ? await updateFinancialGoal(session, editing, payload) : await createFinancialGoal(session, payload);
      setGoals(current => editing ? current.map(g => g.id === editing ? result : g) : [...current, result].sort((a,b) => a.deadline.localeCompare(b.deadline)));
      setOpen(false); setForm(blank); setEditing(null);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar a meta."); }
    finally { setSaving(false); }
  };
  const remove = async (id: string) => {
    if (!window.confirm("Excluir esta meta financeira?")) return;
    try { await deleteFinancialGoal(session, id); setGoals(current => current.filter(g => g.id !== id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível excluir a meta."); }
  };

  const totalTarget = goals.reduce((sum,g) => sum + Number(g.target_amount), 0);
  const totalSaved = goals.reduce((sum,g) => sum + Number(g.saved_amount), 0);
  const daysLeft = (date: string) => Math.ceil((new Date(date + "T23:59:59").getTime() - Date.now()) / 86400000);

  return <section className="page-section goals-manager">
    <div className="page-heading">
      <div><p className="eyebrow">PLANEJAMENTO FINANCEIRO</p><h1>Metas financeiras</h1><p className="muted-text">Defina objetivos, acompanhe o progresso e saiba quanto falta para chegar lá.</p></div>
      <button className="primary-btn" onClick={startNew}><Plus size={16}/> Nova meta</button>
    </div>
    <div className="goals-kpis">
      <div className="panel"><span>Valor total das metas</span><strong>{formatMoney(totalTarget)}</strong></div>
      <div className="panel"><span>Já guardado</span><strong className="goal-positive">{formatMoney(totalSaved)}</strong></div>
      <div className="panel"><span>Falta guardar</span><strong>{formatMoney(Math.max(0,totalTarget-totalSaved))}</strong></div>
    </div>
    {error && <div className="cloud-alert" role="alert">{error}</div>}
    {busy ? <div className="panel goals-empty">Carregando suas metas...</div> : goals.length === 0 ? <div className="panel goals-empty"><div className="goals-empty-icon"><Target size={28}/></div><h2>Seu próximo objetivo começa aqui</h2><p>Crie uma meta como reserva de emergência, viagem ou compra de um bem. O Finance IA acompanha o quanto falta para você chegar lá.</p><button className="primary-btn" onClick={startNew}><Plus size={16}/> Criar primeira meta</button></div> :
      <div className="goals-cards">{goals.map(goal => {
        const progress = Math.min(100, Number(goal.saved_amount) / Number(goal.target_amount) * 100);
        const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.saved_amount));
        const days = daysLeft(goal.deadline);
        const monthly = days > 0 ? remaining / Math.max(1, days / 30.4375) : remaining;
        return <article className="panel goal-card" key={goal.id}>
          <div className="goal-card-head"><div className="goal-icon"><PiggyBank size={19}/></div><div className="goal-actions"><button className="edit-btn" onClick={() => startEdit(goal)} aria-label="Editar meta"><Pencil size={15}/></button><button className="delete-btn" onClick={() => void remove(goal.id)} aria-label="Excluir meta"><Trash2 size={15}/></button></div></div>
          <h2>{goal.title}</h2><div className="goal-amounts"><strong>{formatMoney(Number(goal.saved_amount))}</strong><span>de {formatMoney(Number(goal.target_amount))}</span></div>
          <div className="goal-progress"><div style={{width: progress + "%"}}/></div>
          <div className="goal-progress-meta"><b>{progress.toFixed(1).replace(".", ",")}% concluído</b><span>Faltam {formatMoney(remaining)}</span></div>
          <div className="goal-details"><span><CalendarDays size={14}/> {new Date(goal.deadline + "T12:00:00").toLocaleDateString("pt-BR")}</span><span>{days < 0 ? "Prazo vencido" : days === 0 ? "Vence hoje" : days + " dias restantes"}</span></div>
          <div className="goal-monthly"><CheckCircle2 size={15}/> Para atingir no prazo: <b>{formatMoney(monthly)}/mês</b></div>
        </article>;
      })}</div>}
    {open && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !saving) setOpen(false); }}><form className="modal goal-form" onSubmit={submit}>
      <div className="modal-heading"><div><span className="eyebrow">OBJETIVO FINANCEIRO</span><h2>{editing ? "Editar meta" : "Criar nova meta"}</h2></div><button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Fechar">×</button></div>
      <label>Nome da meta<input autoFocus value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="Ex.: Reserva de emergência" maxLength={70}/></label>
      <div className="form-two"><label>Valor desejado (R$)<input inputMode="decimal" value={form.target_amount} onChange={e => setForm({...form,target_amount:e.target.value})} placeholder="10000,00"/></label><label>Já guardado (R$)<input inputMode="decimal" value={form.saved_amount} onChange={e => setForm({...form,saved_amount:e.target.value})} placeholder="0,00"/></label></div>
      <label>Prazo para alcançar<input type="date" min={new Date().toISOString().slice(0,10)} value={form.deadline} onChange={e => setForm({...form,deadline:e.target.value})}/></label>
      {error && <p className="invoice-error">{error}</p>}
      <div className="modal-actions"><button type="button" className="outline-btn" onClick={() => setOpen(false)}>Cancelar</button><button className="primary-btn" disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar meta"}</button></div>
    </form></div>}
    <p className="goal-balance-note">Saldo registrado atualmente: <b>{formatMoney(balance)}</b>. O valor guardado nas metas é informado por você e não movimenta automaticamente seu saldo bancário.</p>
  </section>;
}
