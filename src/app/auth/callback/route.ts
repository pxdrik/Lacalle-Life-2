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
/**
 * `next` chega de uma query string — qualquer um pode montar um link para
 * este endpoint com `?next=` apontando para fora do app. `origin + next`
 * concatenados já barra a maioria dos casos óbvios (uma URL absoluta vira
 * malformada e `NextResponse.redirect` rejeita), mas não vale depender
 * disso: `//evil.com` ou `/\evil.com` dependem de como o navegador
 * normaliza, não do que o servidor concatenou. Só um caminho local, começando
 * em uma única barra, é aceito — qualquer outra coisa cai no padrão `/`.
 */
export function safeNextPath(value: string | null): string {
  if (
    value !== null &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
  ) {
    return value;
  }
  return "/";
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code !== null) {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/entrar`);
}
