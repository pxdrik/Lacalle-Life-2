import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite, type Transaction } from "@electric-sql/pglite";

/**
 * Um Postgres de verdade para testar as regras de acesso (RLS) e as funções
 * do banco, sem Docker e sem servidor: o PGlite é o Postgres compilado para
 * rodar dentro do Node.
 *
 * Até 01/10/2026 o isolamento entre contas tinha sido conferido "por desenho"
 * (`docs/arquitetura-sincronizacao.md`). O Life Pro é a primeira função cuja
 * segurança depende de regras entre usuários diferentes, então elas passam a
 * ser testadas num banco que as aplica de fato (`docs/visao-adm-plano.md`,
 * Etapa 0).
 *
 * O que imita do Supabase, e só isso:
 *
 * - os papéis `anon`, `authenticated` e `service_role`;
 * - `auth.users` (só o que as migrações referenciam) e `auth.uid()`, lido de
 *   `request.jwt.claim.sub` como o Supabase faz;
 * - as permissões padrão do esquema `public` (o Supabase concede tudo nas
 *   tabelas a `anon` e `authenticated`, e quem barra é a RLS e os `revoke`
 *   das migrações). Sem isso o teste passaria por falta de permissão, não
 *   pela regra que se quer provar.
 *
 * As migrações vêm de `supabase/migrations`, as mesmas que vão para produção,
 * aplicadas em ordem.
 */
const BOOTSTRAP = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text
);
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

export function migrationFiles(): readonly string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

export interface TestDb {
  readonly db: PGlite;
  /** Cria um usuário em `auth.users` e devolve o id. */
  readonly createUser: (email: string) => Promise<string>;
  /**
   * Roda `fn` como o app roda: papel `authenticated` (ou `anon`, com
   * `null`) e `auth.uid()` = `userId`, numa transação. O papel e o usuário
   * valem só dentro dela (`set local`); um erro desfaz tudo. Cada teste usa
   * usuários próprios (`createUser`), então um não enxerga o estado do outro.
   */
  readonly as: <T>(userId: string | null, fn: (tx: Transaction) => Promise<T>) => Promise<T>;
}

export async function createTestDb(): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (const file of migrationFiles()) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    } catch (error) {
      throw new Error(`Migração ${file} falhou: ${String(error)}`);
    }
  }

  return {
    db,
    createUser: async (email) => {
      const { rows } = await db.query<{ id: string }>(
        "insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id",
        [email],
      );
      return rows[0]!.id;
    },
    as: (userId, fn) =>
      db.transaction(async (tx) => {
        await tx.query(`set local role ${userId === null ? "anon" : "authenticated"}`);
        await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
        return fn(tx);
      }),
  };
}
