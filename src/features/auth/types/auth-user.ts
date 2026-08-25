/**
 * O que o resto do app pode saber sobre quem está logado, nesta sprint.
 *
 * Deliberadamente pequeno — `id` é o UUID que toda tabela do schema
 * aprovado (`docs/arquitetura-sincronizacao.md`) vai usar como `user_id`
 * quando a Sprint de Sync chegar; `email` é só para a UI mostrar "logado
 * como fulano@...". Nenhum outro campo do `auth.users` do Supabase tem uso
 * ainda, e não é criado até ter um.
 */
export interface AuthUser {
  readonly id: string;
  readonly email: string | null;
}
