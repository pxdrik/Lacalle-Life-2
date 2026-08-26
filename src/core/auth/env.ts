/**
 * As duas variáveis que todo cliente Supabase (navegador, servidor,
 * middleware) precisa. Lidas e validadas num lugar só — falhar cedo e com
 * mensagem clara é melhor que um `createBrowserClient(undefined, undefined)`
 * quebrando de um jeito opaco na primeira chamada de rede.
 *
 * `NEXT_PUBLIC_*` porque o cliente do navegador precisa delas — não são
 * segredo: a chave publicável é desenhada para ficar exposta, e RLS é quem
 * de fato protege o dado (ver `docs/arquitetura-sincronizacao.md`).
 */
export interface SupabaseEnv {
  readonly url: string;
  readonly anonKey: string;
}

/**
 * Whether the two variables `getSupabaseEnv` needs are actually set —
 * without throwing. For a caller that treats "not configured" as a normal,
 * permanent state to sit quietly in (an auto-sync effect, say) rather than
 * an error to catch and report on every attempt.
 */
export function isSupabaseConfigured(): boolean {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL !== undefined &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "" &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== undefined &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== ""
  );
}

export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url === undefined || url === "") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL não está definida.");
  }
  if (anonKey === undefined || anonKey === "") {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY não está definida.");
  }

  return { url, anonKey };
}
