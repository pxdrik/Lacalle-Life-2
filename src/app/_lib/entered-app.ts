/**
 * O sinal de "esta pessoa já esteve no app antes", puramente local.
 *
 * Existe só para a Landing Page em `/` decidir se mostra a si mesma de novo ou
 * pula direto para `/hoje` — não é um dado de conta, não sincroniza, e some se
 * o armazenamento do navegador for limpo, o que é a consequência certa: sem
 * ele, a pessoa só vê a Landing uma vez a mais, nunca perde nada.
 *
 * `try/catch`: `localStorage` pode lançar em navegação privada ou com
 * armazenamento bloqueado, e `theme-store.ts`/`density-store.ts` já lidam com
 * o mesmo risco do mesmo jeito — ver esses arquivos para o precedente.
 */
const ENTERED_APP_KEY = "lacalle-life.entered-app";

/** Chamado quando `/hoje` monta, não pelo clique em "Experimentar sem conta" — assim qualquer forma de chegar lá (o CTA, um link salvo, entrar numa conta) conta igual. */
export function markAppEntered(): void {
  try {
    window.localStorage.setItem(ENTERED_APP_KEY, "1");
  } catch {
    // Sem armazenamento disponível: sem problema, ver o comentário do arquivo.
  }
}

export function hasEnteredAppBefore(): boolean {
  try {
    return window.localStorage.getItem(ENTERED_APP_KEY) === "1";
  } catch {
    return false;
  }
}
