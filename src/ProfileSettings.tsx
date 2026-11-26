import { useEffect, useState } from "react";
import { Activity, CheckCircle2, Save, UserRound } from "lucide-react";
import { fetchPersonalProfile, updatePersonalProfile, type AuthSession, type PersonalProfile } from "./lib/supabase";

export default function ProfileSettings({ session }: { session: AuthSession }) {
  const [profile, setProfile] = useState<PersonalProfile>({ firstName: "", lastName: "", age: null });
  const [ageInput, setAgeInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetchPersonalProfile(session).then(value => {
      if (!active) return;
      setProfile(value);
      setAgeInput(value.age === null ? "" : String(value.age));
    }).catch(error => {
      if (active) setFeedback({ type: "error", message: error instanceof Error ? error.message : "Não foi possível carregar o perfil." });
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session.user.id]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const age = ageInput.trim() ? Number(ageInput) : null;
    if (age !== null && (!Number.isInteger(age) || age < 13 || age > 110)) {
      setFeedback({ type: "error", message: "Informe uma idade válida entre 13 e 110 anos." });
      return;
    }
    if (!profile.firstName.trim()) {
      setFeedback({ type: "error", message: "Informe seu primeiro nome para a IA reconhecer seu perfil." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const saved = await updatePersonalProfile(session, { ...profile, firstName: profile.firstName.trim(), lastName: profile.lastName.trim(), age });
      setProfile(saved);
      setFeedback({ type: "success", message: "Perfil salvo. A IA usará essas informações nas próximas análises." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Não foi possível salvar seu perfil." });
    } finally {
      setSaving(false);
    }
  };

  return <section className="page-section profile-page">
    <div className="page-heading"><div><p className="eyebrow">IDENTIDADE E PERSONALIZAÇÃO</p><h1>Meu perfil</h1><p className="muted-text">Ajude o Finance IA a entender seu contexto para personalizar as análises.</p></div></div>
    <form className="profile-card" onSubmit={save}>
      <div className="panel-heading"><div className="insight-title"><div className="ai-icon"><UserRound size={19}/></div><div><h2>Seus dados pessoais</h2><p>Informações que acompanham sua conta.</p></div></div><span className="ai-live-label"><i/> Perfil</span></div>
      <div className="profile-intro"><span className="profile-intro-icon"><Activity size={20}/></span><div><strong>Uma IA que considera sua fase de vida</strong><p>Seu nome ajuda a conversa ficar mais natural. Sua idade pode contextualizar horizontes de planejamento. As recomendações continuam baseadas nos seus dados financeiros e objetivos informados.</p></div></div>
      {loading ? <p className="profile-feedback">Carregando seu perfil...</p> : <>
        <div className="profile-fields">
          <label>Nome<input autoComplete="given-name" maxLength={60} value={profile.firstName} onChange={event => setProfile(current => ({ ...current, firstName: event.target.value }))} placeholder="Seu primeiro nome" required/></label>
          <label>Sobrenome<input autoComplete="family-name" maxLength={80} value={profile.lastName} onChange={event => setProfile(current => ({ ...current, lastName: event.target.value }))} placeholder="Seu sobrenome"/></label>
          <label>Idade<input type="number" inputMode="numeric" min="13" max="110" value={ageInput} onChange={event => setAgeInput(event.target.value)} placeholder="Ex.: 35"/></label>
        </div>
        <div className="profile-save-row"><span className={feedback ? "profile-feedback "+feedback.type : "profile-feedback"} role="status">{feedback?.message || "Você pode atualizar essas informações quando quiser."}</span><button className="primary-btn" type="submit" disabled={saving}><Save size={15}/>{saving ? "Salvando..." : "Salvar perfil"}</button></div>
      </>}
      <p className="profile-privacy"><CheckCircle2 size={12} style={{display:"inline",verticalAlign:"-2px",marginRight:5}}/>Seu perfil fica salvo nos metadados da sua conta Supabase e é enviado ao Finance IA no servidor autenticado. Não aparece publicamente.</p>
    </form>
  </section>;
}
