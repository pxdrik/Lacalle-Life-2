import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

import { getSupabaseEnv } from "./env";

/**
 * Renova a sessão Supabase, se houver uma, escrevendo os cookies atualizados
 * direto em `response` — o mesmo objeto que `middleware.ts` já monta para a
 * CSP, nunca um segundo `NextResponse` que apagaria os headers dela.
 *
 * Chamado em toda rota (o `config.matcher` de `middleware.ts` já cobre
 * praticamente tudo) para que o token de acesso nunca expire enquanto a
 * pessoa navega — sem isto, uma sessão parada por tempo demais numa aba
 * aberta silenciosamente vira deslogada na próxima leitura.
 *
 * Falha de rede ou variável de ambiente ausente nunca derruba a página: o
 * resto do app — todo o domínio local-first — não depende de auth
 * funcionando, e um erro aqui bloquearia toda rota através do middleware.
 */
export async function refreshSupabaseSession(
  request: NextRequest,
  response: NextResponse,
): Promise<void> {
  try {
    const env = getSupabaseEnv();

    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // O valor devolvido não importa — a chamada existe pelo efeito colateral
    // de renovar o token, que `setAll` acima já gravou em `response`.
    await supabase.auth.getUser();
  } catch {
    // Ver doc do módulo: nunca deixa a ausência ou falha do Supabase
    // derrubar uma rota que não tem nada a ver com auth.
  }
}
