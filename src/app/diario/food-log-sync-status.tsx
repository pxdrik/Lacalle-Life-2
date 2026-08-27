"use client";

import { useEffect, useState } from "react";

import { isSupabaseConfigured } from "@/core/auth/env";
import {
  resolveFoodLogConflictAndSync,
  runFoodLogSync,
} from "@/composition/sync/sync-engine";
import type { MealConflict } from "@/composition/sync/food-log-merge";
import type { FoodLogConflictResolution } from "@/composition/sync/food-log-sync";
import { createSupabaseAuthRepository } from "@/features/auth/data/supabase-auth-repository";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { Notice } from "@/design-system/components/notice";

/**
 * Sincronização do dia do diário — vive aqui, dentro de `app/`, não em
 * `features/diet`, porque chama `@/composition/sync` diretamente
 * (`features/**` não pode importar composition — regra 4 do `AGENTS.md`).
 *
 * A UI não decide nada sozinha: só mostra o que `runFoodLogSync`/
 * `resolveFoodLogConflictAndSync` já decidiram. Um dia limpo ou "stale"
 * (corrida de versão perdida, não um conflito de verdade — §24.1) não
 * mostra nada além do botão comum de sincronizar — a sincronização é
 * transparente, exatamente como um dia comum deve parecer. Só um
 * conflito de verdade (por `Meal.id`) troca o botão pela tela de
 * resolução, com os dois valores lado a lado — nunca uma terceira opção
 * de merge automático que o motor não definiu, e nunca um jeito de
 * "sincronizar de novo" contornar o bloqueio: enquanto há conflito, o
 * botão comum simplesmente não existe na árvore.
 *
 * O `Meal` de domínio que `MealCard`/o editor de dieta usam nunca aparece
 * aqui — os conflitos carregam `WireMeal` (a representação de fio, com
 * `deletedAt`), que é um detalhe do motor de sync, não do modelo que a UI
 * do diário conhece.
 */
interface SyncedState {
  readonly day: string;
  readonly conflicts: readonly MealConflict[] | null;
  readonly error: string | null;
}

const IDLE: SyncedState = { day: "", conflicts: null, error: null };

type AuthKnowledge = "unknown" | "anonymous" | "authenticated";

export function FoodLogSyncStatus({ day }: { readonly day: string }) {
  const [pending, setPending] = useState(false);
  // Achado de auditoria externa (27/08/2026): sem sessão, "Sincronizar" era
  // um clique morto — `pushFoodLog`/`pullFoodLog` já voltam
  // "not-authenticated" em silêncio (por design, ver `runFoodLogSync`), então
  // nada visível acontecia e nada explicava por quê. `"unknown"` cobre o
  // instante entre montar e `getUser()` responder, para quem já está logado
  // não ver o aviso piscar antes do botão; não configurado resolve direto em
  // "anonymous", sem round-trip nenhum.
  const [auth, setAuth] = useState<AuthKnowledge>(() =>
    isSupabaseConfigured() ? "unknown" : "anonymous",
  );
  // Marcado com o próprio dia, do mesmo jeito que `useFoodLogDay` marca
  // `loaded` — assim trocar de dia não mostra por um instante o conflito
  // (ou a falta dele) do dia anterior antes do novo sync terminar.
  const [synced, setSynced] = useState<SyncedState>(IDLE);
  const current = synced.day === day ? synced : IDLE;

  // Roda uma vez por sessão de página, não por dia — trocar de dia no
  // diário não muda quem está logado.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const repository = createSupabaseAuthRepository();
    let active = true;

    void repository.getUser().then((user) => {
      if (active) setAuth(user === null ? "anonymous" : "authenticated");
    });

    const unsubscribe = repository.onAuthStateChange((user) => {
      if (active) setAuth(user === null ? "anonymous" : "authenticated");
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Sincroniza sozinho ao abrir o dia — a UI não espera um clique para um
  // dia comum parecer em dia. Sem spinner aqui (transparente); `sync`,
  // mais abaixo, é a versão com feedback usada pelo clique manual e pela
  // resolução. Definida dentro do próprio efeito, no mesmo formato de
  // `load()` em `useFoodLogDay` — uma função separada, referenciada só
  // por identidade no array de dependências, não deixa o linter enxergar
  // que o `setSynced` só roda depois do `await`.
  useEffect(() => {
    let active = true;

    async function autoSync() {
      // Not configured is a permanent state in some environments (a
      // production deploy missing its Supabase env vars, a local-only
      // checkout), not a transient failure — sitting quietly in it, the
      // same way `pushFoodLog`/`pullFoodLog` already sit quietly in
      // "not-authenticated", is correct. Throwing here instead meant this
      // effect re-fired on every day change and logged the same exception
      // each time, with an alarming "Falha ao sincronizar." Notice for a
      // state that isn't a failure of anything that happened this session.
      if (!isSupabaseConfigured()) return;

      try {
        const outcome = await runFoodLogSync(day);
        if (!active) return;
        setSynced({
          day,
          conflicts: outcome.pull.status === "conflict" ? outcome.pull.conflicts : null,
          error: null,
        });
      } catch (cause) {
        if (active) {
          setSynced({
            day,
            conflicts: null,
            error: cause instanceof Error ? cause.message : "Falha ao sincronizar.",
          });
        }
      }
    }

    void autoSync();

    return () => {
      active = false;
    };
  }, [day]);

  async function sync() {
    setPending(true);
    try {
      const outcome = await runFoodLogSync(day);
      setSynced({
        day,
        conflicts: outcome.pull.status === "conflict" ? outcome.pull.conflicts : null,
        error: null,
      });
    } catch (cause) {
      setSynced({
        day,
        conflicts: null,
        error: cause instanceof Error ? cause.message : "Falha ao sincronizar.",
      });
    } finally {
      setPending(false);
    }
  }

  async function resolve(mealId: string, resolution: FoodLogConflictResolution) {
    if (current.conflicts === null) return;
    setPending(true);

    try {
      const outcome = await resolveFoodLogConflictAndSync(
        day,
        current.conflicts,
        new Map([[mealId, resolution]]),
      );
      setSynced({
        day,
        conflicts: outcome.pull.status === "conflict" ? outcome.pull.conflicts : null,
        error: null,
      });
    } catch (cause) {
      setSynced({
        day,
        conflicts: current.conflicts,
        error: cause instanceof Error ? cause.message : "Falha ao resolver o conflito.",
      });
    } finally {
      setPending(false);
    }
  }

  const { conflicts, error } = current;

  if (conflicts !== null && conflicts.length > 0) {
    return (
      <div className="mt-4 space-y-3">
        {error !== null && <Notice tone="warning">{error}</Notice>}
        {conflicts.map((conflict) => (
          <MealConflictCard
            key={conflict.mealId}
            conflict={conflict}
            pending={pending}
            onResolve={(resolution) => void resolve(conflict.mealId, resolution)}
          />
        ))}
      </div>
    );
  }

  if (auth === "anonymous") {
    return (
      <div className="mt-4 flex items-center gap-2">
        <p className="text-xs text-ink-subtle">
          Dados salvos neste dispositivo. Entre na sua conta para sincronizar.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 flex items-center gap-2">
      {auth === "authenticated" && (
        <Button variant="ghost" size="sm" pending={pending} onClick={() => void sync()}>
          Sincronizar
        </Button>
      )}
      {error !== null && <Notice tone="warning">{error}</Notice>}
    </div>
  );
}

function MealConflictCard({
  conflict,
  pending,
  onResolve,
}: {
  readonly conflict: MealConflict;
  readonly pending: boolean;
  readonly onResolve: (resolution: FoodLogConflictResolution) => void;
}) {
  const localDeleted = conflict.local.deletedAt !== null;
  const remoteDeleted = conflict.remote.deletedAt !== null;
  const name = localDeleted ? conflict.remote.name : conflict.local.name;

  return (
    <Card tone="hero" as="section">
      <p className="text-ink">
        <strong>{name}</strong> foi alterada em outro dispositivo.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <MealSide label="Neste dispositivo" meal={conflict.local} deleted={localDeleted} />
        <MealSide label="Outro dispositivo" meal={conflict.remote} deleted={remoteDeleted} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          pending={pending}
          onClick={() => {
            onResolve("keep-local");
          }}
        >
          {localDeleted ? "Manter exclusão" : "Manter neste dispositivo"}
        </Button>
        <Button
          size="sm"
          pending={pending}
          onClick={() => {
            onResolve("use-server");
          }}
        >
          {remoteDeleted ? "Usar exclusão do outro" : "Usar outra versão"}
        </Button>
      </div>
    </Card>
  );
}

function MealSide({
  label,
  meal,
  deleted,
}: {
  readonly label: string;
  readonly meal: MealConflict["local"];
  readonly deleted: boolean;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      {deleted ? (
        <p className="mt-1.5 text-sm text-ink-subtle">Refeição apagada.</p>
      ) : (
        <ul className="mt-1.5 space-y-0.5 text-sm text-ink">
          {meal.items.length === 0 ? (
            <li className="text-ink-subtle">Sem itens.</li>
          ) : (
            meal.items.map((item) => (
              <li key={item.id}>
                {item.name} {item.grams}
                {item.unit}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
