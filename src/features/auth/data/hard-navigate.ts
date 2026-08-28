/**
 * Uma troca de identidade — login, cadastro, atualização de senha que abre
 * uma sessão nova, ou logout — precisa de uma navegação completa, não de
 * `router.push` + `router.refresh()`.
 *
 * `router.refresh()` só re-executa Server Components; o estado do lado do
 * cliente sobrevive inteiro, inclusive o `let connection` de
 * `composition/repositories.ts` e os `once()` de `composition/data-providers.tsx`
 * que guardam a conexão IndexedDB da identidade anterior. Uma navegação de
 * verdade descarta esse estado de módulo de graça, sem precisar de um
 * mecanismo próprio de invalidação — é a mesma linha que
 * `composition/identity.ts` já assume ao memoizar a identidade só até a
 * próxima carga de página.
 */
export function hardNavigateTo(path: string): void {
  window.location.assign(path);
}
