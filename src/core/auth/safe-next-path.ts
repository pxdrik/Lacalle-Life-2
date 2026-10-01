/**
 * `next` chega de uma query string (retorno do e-mail, `/entrar`, `/cadastro`)
 * — qualquer um pode montar um link para
 * essas páginas com `?next=` apontando para fora do app. `origin + next`
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
