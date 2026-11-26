import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, Mail, Save, ShieldCheck, UserRound } from "lucide-react";
import { fetchPersonalProfile, updatePersonalProfile, type AuthSession, type PersonalProfile } from "./lib/supabase";

const EMPTY_PROFILE: PersonalProfile = { firstName: "", lastName: "", birthDate: "", age: null, showNameInSidebar: false };

function getAge(date: string): number | null {
  if (!date) return null;
  const birth = new Date(date + "T00:00:00");
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

function initials(firstName: string, lastName: string) {
  const first = firstName.trim().split(/\s+/)[0]?.[0] || "";
  const last = lastName.trim().split(/\s+/).filter(Boolean).slice(-1)[0]?.[0] || "";
  return (first + last).toLocaleUpperCase("pt-BR") || "EU";
}

export default function ProfileSettings({ session }: { session: AuthSession }) {
  const [profile, setProfile] = useState<PersonalProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetchPersonalProfile(session).then(value => {
      if (active) setProfile(value);
    }).catch(error => {
      if (active) setFeedback({ type: "error", message: error instanceof Error ? error.message : "Não foi possível carregar o perfil." });
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session.user.id]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const firstName = profile.firstName.trim();
    const lastName = profile.lastName.trim();
    if (!firstName) {
      setFeedback({ type: "error", message: "Informe seu nome." });
      return;
    }
    if (profile.birthDate) {
      const birth = new Date(profile.birthDate + "T00:00:00");
      const age = getAge(profile.birthDate);
      if (Number.isNaN(birth.getTime()) || birth > new Date() || age === null || age > 110) {
        setFeedback({ type: "error", message: "Confira a data de nascimento informada." });
        return;
      }
    }
    setSaving(true);
    setFeedback(null);
    try {
      const saved = await updatePersonalProfile(session, { ...profile, firstName, lastName, age: getAge(profile.birthDate) });
      setProfile(saved);
      setFeedback({ type: "success", message: "Seus dados foram atualizados com segurança." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Não foi possível salvar seu perfil." });
    } finally {
      setSaving(false);
    }
  };

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");

  return <section className="page-section profile-page">
    <div className="page-heading"><div><p className="eyebrow">SUA CONTA</p><h1>Meu perfil</h1><p className="muted-text">Seus dados pessoais e preferências de identificação.</p></div></div>
    <form className="profile-card profile-settings-card" onSubmit={save}>
      <div className="profile-hero">
        <div className="profile-large-avatar">{initials(profile.firstName, profile.lastName)}</div>
        <div className="profile-hero-copy"><span className="eyebrow">PERFIL FINANCE IA</span><h2>{fullName || "Configure seu nome"}</h2><p>{session.user.email || "E-mail da conta"}</p></div>
        <span className="profile-secure-tag"><ShieldCheck size={14}/> Privado</span>
      </div>
      {loading ? <p className="profile-feedback">Carregando seus dados...</p> : <>
        <div className="profile-section-title"><UserRound size={17}/><div><h3>Dados pessoais</h3><p>Essas informações ficam vinculadas à sua conta.</p></div></div>
        <div className="profile-fields profile-fields-standard">
          <label>Nome<input autoComplete="given-name" maxLength={60} value={profile.firstName} onChange={event => setProfile(current => ({ ...current, firstName: event.target.value }))} placeholder="Seu nome" required/></label>
          <label>Sobrenome<input autoComplete="family-name" maxLength={80} value={profile.lastName} onChange={event => setProfile(current => ({ ...current, lastName: event.target.value }))} placeholder="Seu sobrenome"/></label>
          <label className="profile-birth-field">Data de nascimento<span className="profile-input-icon"><CalendarDays size={15}/><input type="date" autoComplete="bday" max={new Date().toISOString().slice(0,10)} value={profile.birthDate} onChange={event => setProfile(current => ({ ...current, birthDate: event.target.value }))}/></span></label>
          <label className="profile-email-field">E-mail da conta<span className="profile-readonly-field"><Mail size={15}/><input value={session.user.email || ""} readOnly aria-readonly="true"/></span></label>
        </div>
        <div className="profile-section-title profile-preferences-title"><ShieldCheck size={17}/><div><h3>Privacidade e exibição</h3><p>Você decide o que aparece no menu lateral.</p></div></div>
        <label className="profile-display-option"><span><strong>Mostrar meu nome no menu</strong><small>Desativado: aparece apenas “Meu perfil” e suas iniciais. Ativado: seu nome também será exibido.</small></span><input type="checkbox" checked={profile.showNameInSidebar} onChange={event => setProfile(current => ({ ...current, showNameInSidebar: event.target.checked }))}/></label>
        <div className="profile-save-row"><span className={feedback ? "profile-feedback "+feedback.type : "profile-feedback"} role="status">{feedback?.message || "Você pode alterar essas informações quando quiser."}</span><button className="primary-btn" type="submit" disabled={saving}><Save size={15}/>{saving ? "Salvando..." : "Salvar alterações"}</button></div>
      </>}
      <p className="profile-privacy"><CheckCircle2 size={13}/> Seus dados não são exibidos publicamente. A data de nascimento é usada apenas para calcular sua idade e contextualizar o planejamento.</p>
    </form>
  </section>;
}
