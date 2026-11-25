import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { FormEvent } from "react";
import { Bot, Send, Sparkles, User, LoaderCircle } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };

// Alguns modelos escapam caracteres Markdown mesmo quando o chat espera texto formatado.
function normalizeMarkdown(value: string): string {
  return value.replace(/\\([#|*_~>])/g, "$1");
}

export default function FinancialAssistant({ accessToken }: { accessToken: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    const history = messages.slice(-8);
    setMessages(current => [...current, { role: "user", content: message }]);
    setDraft("");
    setError("");

    // Saudações isoladas são reconhecidas imediatamente, sem gastar uma chamada de IA.
    const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[!?.,;:]+/g, " ").trim();
    const greetingOnly = /^(oi|ola|bom dia|boa tarde|boa noite|bom dia tudo bem|boa tarde tudo bem|boa noite tudo bem|tudo bem|tudo bom|e ai|opa)(\s+(finance ia|finance))?$/.test(normalized);
    if (greetingOnly) {
      const hour = new Date().getHours();
      const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
      setMessages(current => [...current, {
        role: "assistant",
        content: greeting + "! Estou aqui para ajudar. Posso analisar seus lançamentos, identificar seus maiores gastos, calcular médias e acompanhar suas metas."
      }]);
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
        body: JSON.stringify({ message, history })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível consultar a inteligência artificial.");
      const answer = typeof result.answer === "string" ? result.answer.trim() : "";
      if (!answer) throw new Error("A IA não retornou texto. Tente novamente; a solicitação não gerou uma resposta visível.");
      setMessages(current => [...current, { role: "assistant", content: answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao conversar com a IA.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="panel ai-assistant-panel">
    <div className="panel-heading ai-assistant-heading">
      <div className="insight-title"><div className="ai-icon"><Bot size={19}/></div><div><h2>Converse com o Finance IA</h2><p>Inteligência artificial conectada aos seus lançamentos e metas</p></div></div>
      <span className="ai-live-label"><i/> IA</span>
    </div>
    <div className="ai-chat-messages" aria-live="polite">
      {messages.length === 0 ? <div className="ai-chat-welcome"><Sparkles size={22}/><strong>O que você quer entender sobre seu dinheiro?</strong><p>Pergunte sobre seus gastos, metas, faturas ou decisões de compra. A IA consulta os dados registrados na sua conta.</p><div className="ai-prompt-examples"><button type="button" onClick={() => setDraft("Analise minha situação financeira e aponte os principais riscos.")}>Analise minhas finanças</button><button type="button" onClick={() => setDraft("Quais são meus maiores gastos e o que merece atenção?")}>Onde estou gastando mais?</button><button type="button" onClick={() => setDraft("Posso assumir uma compra de R$ 1.500 sem comprometer minhas contas?")}>Posso fazer uma compra?</button></div></div> : messages.map((item, index) => <div className={`ai-chat-message ${item.role}`} key={index}><span className="ai-message-avatar">{item.role === "assistant" ? <Bot size={15}/> : <User size={15}/>}</span><div className="ai-message-content"><strong>{item.role === "assistant" ? "Finance IA" : "Você"}</strong><div className="ai-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{normalizeMarkdown(item.content)}</ReactMarkdown></div></div></div>)}
      {busy && <div className="ai-chat-loading"><LoaderCircle size={16}/> Analisando seus dados...</div>}
    </div>
    {error && <p className="ai-chat-error" role="alert">{error}</p>}
    <form className="ai-chat-form" onSubmit={send}>
      <textarea value={draft} onChange={event => setDraft(event.target.value)} placeholder="Pergunte qualquer coisa sobre suas finanças..." rows={2} maxLength={4000} disabled={busy}/>
      <button className="primary-btn" type="submit" disabled={busy || !draft.trim()} aria-label="Enviar pergunta"><Send size={16}/><span>Enviar</span></button>
    </form>
    <p className="ai-chat-disclaimer">A IA pode cometer erros. Confira informações importantes antes de tomar decisões financeiras. Seus dados são consultados com a autenticação da sua conta.</p>
  </section>;
}
