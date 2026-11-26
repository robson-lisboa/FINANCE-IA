import { useState } from "react";
import type { AuthSession } from "./lib/supabase";

export default function AccountDeletion({ session }: { session: AuthSession }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const deleteAccount = async () => {
    const confirmed = window.confirm("ATENÇÃO: sua conta e seus lançamentos e metas serão excluídos permanentemente. Essa ação não pode ser desfeita. Deseja continuar?");
    if (!confirmed) return;
    const typed = window.prompt('Para confirmar, digite EXCLUIR:');
    if (typed !== "EXCLUIR") return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { Authorization: "Bearer " + session.access_token }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível excluir sua conta.");
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("finance-ia-")) localStorage.removeItem(key);
      }
      window.location.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir sua conta.");
      setBusy(false);
    }
  };

  return (
    <div className="settings-control" style={{ borderTop: "1px solid var(--border, #333)", marginTop: 24, paddingTop: 24 }}>
      <div>
        <strong>Excluir minha conta</strong>
        <small>Apaga permanentemente seu acesso, lançamentos e metas financeiras.</small>
        {error && <p className="auth-error" role="alert">{error}</p>}
      </div>
      <button type="button" className="outline-btn" onClick={deleteAccount} disabled={busy} style={{ borderColor: "#d65b68", color: "#d65b68" }}>
        {busy ? "Excluindo..." : "Excluir minha conta"}
      </button>
    </div>
  );
}
