import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/core/auth/supabase-server-client";

/**
 * Onde todo link de e-mail do Supabase aterrissa — confirmação de cadastro
 * e redefinição de senha, os dois. `code` na URL (fluxo PKCE, o padrão desta
 * versão do SDK) precisa ser trocado por uma sessão antes de qualquer coisa
 * que dependa de estar logado funcionar — é por isso que
 * `resetPasswordForEmail` no repositório aponta para cá, com `next` apontando
 * para `/atualizar-senha`, em vez de direto para lá.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code !== null) {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/entrar`);
}
