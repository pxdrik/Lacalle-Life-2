import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseEnv } from "./env";

/**
 * O cliente Supabase para Server Components e Route Handlers.
 *
 * Uma instância nova por request, ao contrário do cliente do navegador — os
 * cookies vêm de `next/headers`, que é por-request, então guardar uma
 * instância entre requests vazaria a sessão de uma pessoa para a próxima.
 *
 * `setAll` pode lançar quando chamado de dentro de um Server Component puro
 * (que não pode escrever cookie) — o app engole isso de propósito, porque
 * `middleware.ts` já renova a sessão a cada request; um Server Component só
 * *lê* a sessão que o middleware acabou de renovar, nunca precisa escrevê-la
 * de novo.
 */
export async function getSupabaseServerClient(): Promise<
  ReturnType<typeof createServerClient>
> {
  const env = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Ver doc do módulo: esperado dentro de um Server Component.
        }
      },
    },
  });
}
