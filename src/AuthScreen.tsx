import { useState } from "react";
import { Activity, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { isSupabaseConfigured, signIn, signUp, type AuthSession } from "./lib/supabase";

export default function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "signin") {
        onAuthenticated(await signIn(email.trim(), password));
      } else {
        const result = await signUp(email.trim(), password);
        if (result.session) onAuthenticated(result.session);
        else setMessage("Conta criada. Confira seu e-mail para confirmar o cadastro e depois entre.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir a solicitação.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-brand"><span><Activity size={23}/></span><div><strong>FINANCE <b>IA</b></strong><small>CONTROLE FINANCEIRO PESSOAL</small></div></div>
        {!isSupabaseConfigured ? (
          <div className="auth-message">
            <LockKeyhole size={25}/>
            <h1>Conecte seu banco de dados</h1>
            <p>O acesso seguro está preparado, mas falta configurar o projeto Supabase no ambiente de publicação.</p>
            <ol>
              <li>Crie um projeto no Supabase.</li>
              <li>Execute o arquivo SQL da pasta <code>supabase/migrations</code> no SQL Editor.</li>
              <li>Cadastre <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> nas variáveis de ambiente do Render e publique novamente.</li>
            </ol>
            <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Abrir Supabase ↗</a>
          </div>
        ) : (
          <>
            <div className="auth-heading"><p className="eyebrow">SUA VIDA FINANCEIRA, EM UM SÓ LUGAR</p><h1>{mode === "signin" ? "Acesse sua conta" : "Crie sua conta"}</h1><p>Seus lançamentos ficam protegidos e sincronizados na nuvem.</p></div>
            <form className="auth-form" onSubmit={submit}>
              <label>E-mail<div className="auth-input"><Mail size={17}/><input type="email" required autoComplete="email" placeholder="seu@email.com" value={email} onChange={event => setEmail(event.target.value)}/></div></label>
              <label>Senha<div className="auth-input"><LockKeyhole size={17}/><input type={showPassword ? "text" : "password"} required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="Mínimo de 6 caracteres" value={password} onChange={event => setPassword(event.target.value)}/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
              {error && <p className="auth-error" role="alert">{error}</p>}
              {message && <p className="auth-success" role="status">{message}</p>}
              <button className="primary-btn auth-submit" type="submit" disabled={busy}>{busy ? "Aguarde..." : mode === "signin" ? "Entrar com segurança" : "Criar minha conta"}</button>
            </form>
            <p className="auth-switch">{mode === "signin" ? "Ainda não tem conta?" : "Já tem uma conta?"} <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }}>{mode === "signin" ? "Criar conta" : "Fazer login"}</button></p>
          </>
        )}
        <p className="auth-footnote">Acesso protegido por autenticação. Nunca compartilhe sua senha.</p>
      </section>
    </main>
  );
}
