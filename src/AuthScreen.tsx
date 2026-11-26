import { useEffect, useState } from "react";
import { Activity, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { isSupabaseConfigured, signIn, signUp, requestPasswordRecovery, updatePasswordWithRecoveryToken, type AuthSession } from "./lib/supabase";

export default function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const recoveryParams = new URLSearchParams(window.location.hash.slice(1));
  const initialRecoveryToken = recoveryParams.get("type") === "recovery" ? recoveryParams.get("access_token") : null;
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "newpassword">(initialRecoveryToken ? "newpassword" : "signin");
  const [recoveryToken] = useState<string | null>(initialRecoveryToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialRecoveryToken && window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [initialRecoveryToken]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "forgot") {
        await requestPasswordRecovery(email.trim());
        setMessage("Se o e-mail estiver cadastrado, enviaremos um link para criar uma nova senha. Confira também o spam.");
      } else if (mode === "newpassword") {
        if (!recoveryToken) throw new Error("Link de recuperação inválido. Solicite outro e-mail.");
        if (newPassword.length < 6) throw new Error("A nova senha deve ter pelo menos 6 caracteres.");
        if (newPassword !== confirmPassword) throw new Error("As senhas não coincidem.");
        await updatePasswordWithRecoveryToken(recoveryToken, newPassword);
        setPassword(""); setNewPassword(""); setConfirmPassword("");
        setMessage("Senha alterada com sucesso. Agora você pode entrar com a nova senha.");
        setMode("signin");
      } else if (mode === "signin") {
        const session = await signIn(email.trim(), password);
        setPassword("");
        setShowPassword(false);
        onAuthenticated(session);
      } else {
        const result = await signUp(email.trim(), password);
        if (result.session) {
          setPassword("");
          setShowPassword(false);
          onAuthenticated(result.session);
        }
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
            <div className="auth-heading"><p className="eyebrow">SUA VIDA FINANCEIRA, EM UM SÓ LUGAR</p><h1>{mode === "signin" ? "Acesse sua conta" : mode === "signup" ? "Crie sua conta" : mode === "forgot" ? "Recuperar senha" : "Criar nova senha"}</h1><p>{mode === "forgot" ? "Informe seu e-mail para receber um link seguro de recuperação." : mode === "newpassword" ? "Escolha uma nova senha para sua conta." : "Seus lançamentos ficam protegidos e sincronizados na nuvem."}</p></div>
            <form className="auth-form" onSubmit={submit} autoComplete="off">
              {mode !== "newpassword" && <label>E-mail<div className="auth-input"><Mail size={17}/><input type="email" required autoComplete="email" placeholder="seu@email.com" value={email} onChange={event => setEmail(event.target.value)}/></div></label>}
              {(mode === "signin" || mode === "signup") && <label>Senha<div className="auth-input"><LockKeyhole size={17}/><input type={showPassword ? "text" : "password"} required minLength={6} autoComplete="new-password" placeholder="Mínimo de 6 caracteres" value={password} onChange={event => setPassword(event.target.value)}/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>}
              {mode === "newpassword" && <>
                <label>Nova senha<div className="auth-input"><LockKeyhole size={17}/><input type="password" required minLength={6} autoComplete="new-password" placeholder="Mínimo de 6 caracteres" value={newPassword} onChange={event => setNewPassword(event.target.value)}/></div></label>
                <label>Confirmar nova senha<div className="auth-input"><LockKeyhole size={17}/><input type="password" required minLength={6} autoComplete="new-password" placeholder="Digite novamente" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)}/></div></label>
              </>}
              {error && <p className="auth-error" role="alert">{error}</p>}
              {message && <p className="auth-success" role="status">{message}</p>}
              <button className="primary-btn auth-submit" type="submit" disabled={busy}>{busy ? "Aguarde..." : mode === "signin" ? "Entrar com segurança" : mode === "signup" ? "Criar minha conta" : mode === "forgot" ? "Enviar link de recuperação" : "Salvar nova senha"}</button>
            </form>
            {mode === "signin" && <p className="auth-switch"><button type="button" onClick={() => { setMode("forgot"); setError(""); setMessage(""); }}>Esqueci minha senha</button></p>}
            {(mode === "signin" || mode === "signup") ? <p className="auth-switch">{mode === "signin" ? "Ainda não tem conta?" : "Já tem uma conta?"} <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setPassword(""); setShowPassword(false); setError(""); setMessage(""); }}>{mode === "signin" ? "Criar conta" : "Fazer login"}</button></p> : <p className="auth-switch"><button type="button" onClick={() => { setMode("signin"); setError(""); setMessage(""); setNewPassword(""); setConfirmPassword(""); }}>Voltar ao login</button></p>}
          </>
        )}
        <p className="auth-footnote">Acesso protegido por autenticação. Nunca compartilhe sua senha.</p>
      </section>
    </main>
  );
}
