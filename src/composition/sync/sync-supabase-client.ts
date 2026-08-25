/**
 * O subconjunto do cliente Supabase que o motor de sync realmente usa —
 * não o `SupabaseClient` inteiro do `@supabase/supabase-js`, que arrasta
 * dezenas de métodos irrelevantes aqui e torna um fake de teste um exercício
 * de encaixar tipos em vez de testar comportamento.
 *
 * O cliente real do `supabase-js` já satisfaz esta interface
 * estruturalmente — nenhuma conversão é necessária ao passá-lo para
 * `pushProfile`/`pullProfile`, só a assinatura do parâmetro é mais estreita.
 */
export interface SyncSupabaseClient {
  readonly auth: {
    getUser(): Promise<{ readonly data: { readonly user: { readonly id: string } | null } }>;
  };
  rpc<T = unknown>(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{
    readonly data: readonly T[] | null;
    readonly error: { readonly message: string } | null;
  }>;
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): Promise<{
        readonly data: readonly Record<string, unknown>[] | null;
        readonly error: { readonly message: string } | null;
      }>;
    };
  };
}
