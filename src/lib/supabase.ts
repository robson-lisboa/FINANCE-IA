export type FinanceTransaction = {
  id: string;
  title: string;
  category: string;
  date: string;
  amount: number;
  type: "income" | "expense";
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in?: number;
  user: { id: string; email?: string };
};

const STORAGE_KEY = "finance-ia-auth-session-v1";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error("O banco ainda não foi conectado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
  }
}

function saveSession(session: AuthSession | null) {
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
}

export function readStoredSession(): AuthSession | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return null;

    const parsed: unknown = JSON.parse(value);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("access_token" in parsed) ||
      typeof parsed.access_token !== "string" ||
      !("refresh_token" in parsed) ||
      typeof parsed.refresh_token !== "string" ||
      !("user" in parsed) ||
      !parsed.user ||
      typeof parsed.user !== "object" ||
      !("id" in parsed.user) ||
      typeof parsed.user.id !== "string" ||
      !parsed.user.id
    ) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed as AuthSession;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

async function authRequest<T>(path: string, body?: unknown): Promise<T> {
  ensureConfigured();
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY! },
    body: JSON.stringify(body ?? {}),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.msg || result.message || result.error_description || "Não foi possível autenticar.");
  return result as T;
}

function buildAuthSession(value: unknown): AuthSession {
  if (!value || typeof value !== "object") {
    throw new Error("O serviço de autenticação retornou uma sessão inválida. Tente entrar novamente.");
  }

  const result = value as Partial<AuthSession>;
  if (
    typeof result.access_token !== "string" || !result.access_token ||
    typeof result.refresh_token !== "string" || !result.refresh_token ||
    !result.user || typeof result.user !== "object" ||
    typeof result.user.id !== "string" || !result.user.id
  ) {
    throw new Error("O login foi recebido, mas os dados da conta vieram incompletos. Nenhuma sessão inválida foi salva.");
  }

  return {
    ...result,
    expires_at: typeof result.expires_at === "number"
      ? result.expires_at
      : Math.floor(Date.now() / 1000) + (typeof result.expires_in === "number" ? result.expires_in : 3600),
    user: {
      id: result.user.id,
      ...(typeof result.user.email === "string" ? { email: result.user.email } : {}),
    },
  } as AuthSession;
}

export async function signIn(email: string, password: string): Promise<AuthSession> {
  const result = await authRequest<unknown>("token?grant_type=password", { email, password });
  const session = buildAuthSession(result);
  saveSession(session);
  return session;
}

export async function signUp(email: string, password: string): Promise<{ session: AuthSession | null; needsEmailConfirmation: boolean }> {
  const result = await authRequest<unknown>("signup", { email, password });
  if (result && typeof result === "object" && "access_token" in result && "refresh_token" in result && (result as { access_token?: unknown }).access_token && (result as { refresh_token?: unknown }).refresh_token) {
    const session = buildAuthSession(result);
    saveSession(session);
    return { session, needsEmailConfirmation: false };
  }
  return { session: null, needsEmailConfirmation: true };
}

export async function signOut(session: AuthSession): Promise<void> {
  try {
    await fetch(SUPABASE_URL + "/auth/v1/logout", {
      method: "POST",
      headers: { apikey: SUPABASE_KEY!, Authorization: "Bearer " + session.access_token },
    });
  } catch {
    // Encerra a sessão local mesmo quando a rede estiver indisponível.
  }
  saveSession(null);
}

export async function refreshSession(session: AuthSession): Promise<AuthSession> {
  const stored = readStoredSession();
  const current = stored && stored.user.id === session.user.id && stored.expires_at > session.expires_at
    ? stored
    : session;
  if (current.expires_at > Math.floor(Date.now() / 1000) + 60) return current;
  const result = await authRequest<AuthSession>("token?grant_type=refresh_token", { refresh_token: current.refresh_token });
  const refreshed = { ...result, expires_at: result.expires_at ?? Math.floor(Date.now() / 1000) + (result.expires_in ?? 3600) };
  saveSession(refreshed);
  return refreshed;
}

async function dataRequest<T>(session: AuthSession, path: string, init: RequestInit = {}): Promise<T> {
  ensureConfigured();
  const activeSession = await refreshSession(session);
  const response = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: "Bearer " + activeSession.access_token,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (response.status === 204) return undefined as T;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.details || "Falha ao acessar os lançamentos na nuvem.");
  return result as T;
}

export async function fetchTransactions(session: AuthSession): Promise<FinanceTransaction[]> {
  return dataRequest<FinanceTransaction[]>(session, "transactions?select=id,title,category,date,amount,type&order=date.desc");
}

export async function insertTransactions(session: AuthSession, transactions: Omit<FinanceTransaction, "id">[]): Promise<FinanceTransaction[]> {
  if (!transactions.length) return [];
  return dataRequest<FinanceTransaction[]>(session, "transactions?select=id,title,category,date,amount,type", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(transactions.map(transaction => ({ ...transaction, user_id: session.user.id }))),
  });
}

export async function deleteTransactionFromCloud(session: AuthSession, id: string): Promise<void> {
  await dataRequest<void>(session, `transactions?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}
