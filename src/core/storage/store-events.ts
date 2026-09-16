/**
 * "Algo mudou no store X" — o sinal que faltava para uma tela saber que
 * outra escreveu no mesmo dado, sem precisar de refresh manual.
 *
 * Achado real (17/09/2026, pedido do Pedro): criar uma dieta e o Diário não
 * reconhecer a mudança até recarregar a página. Causa: cada hook de leitura
 * (`useDietList`, `useFoodLogDay`...) lê do IndexedDB uma vez e guarda em
 * `useState` — sem nenhum jeito de saber que outro componente, ou um pull de
 * sincronização rodando em segundo plano, escreveu no mesmo store depois
 * disso. Fica em `core/storage`, não em `core/sync`: uma edição direta do
 * usuário e um pull remoto são só dois chamadores do mesmo sinal — o hook
 * que escuta nunca precisa saber qual dos dois foi.
 *
 * Um `EventTarget` por processo (módulo, não uma classe) — sobrevive a
 * navegação client-side dentro da mesma aba, que é o caso real relatado;
 * não cruza abas nem dispositivos, isso já é trabalho da sincronização.
 */
const target = new EventTarget();

/** Avisa quem estiver ouvindo `store` que uma escrita local aconteceu. */
export function notifyStoreChanged(store: string): void {
  target.dispatchEvent(new Event(store));
}

/**
 * Assina mudanças em `store`. Devolve a função de cancelamento — para usar
 * direto no retorno de um `useEffect`, sem embrulho.
 */
export function onStoreChanged(store: string, listener: () => void): () => void {
  target.addEventListener(store, listener);
  return () => {
    target.removeEventListener(store, listener);
  };
}
