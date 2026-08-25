import type { SyncQueryBuilder, SyncQueryResult } from "./sync-supabase-client";

/**
 * Constrói um `SyncQueryBuilder` fake que aceita qualquer número de
 * `.eq()` encadeados (ignorados — o fake não filtra de verdade, quem
 * chama já decide o resultado) e resolve para `result` quando aguardado.
 * Reaproveitado pelos testes de `profile-sync` e `food-log-sync`.
 */
export function chainableEq(result: SyncQueryResult): SyncQueryBuilder {
  return chainableEqLazy(() => result);
}

/**
 * Variante que só avalia `getResult` quando o builder é aguardado — para
 * um fake de servidor com estado mutável (ex.: `FakeServer` dos testes
 * adversariais), onde o resultado precisa refletir o estado no momento do
 * `await`, não no momento em que o cliente fake foi construído.
 */
export function chainableEqLazy(
  getResult: () => SyncQueryResult,
): SyncQueryBuilder {
  const builder: SyncQueryBuilder = {
    eq: () => builder,
    then: (onfulfilled, onrejected) =>
      Promise.resolve(getResult()).then(onfulfilled, onrejected),
  };
  return builder;
}
