"use client";

import { useEffect, useState } from "react";

import { isSupabaseConfigured } from "@/core/auth/env";
import {
  resolveDietConflictAndSync,
  runDietSync,
} from "@/composition/sync/sync-engine";
import type { DietConflict, DietConflictResolution } from "@/composition/sync/diet-sync";
import { createSupabaseAuthRepository } from "@/features/auth/data/supabase-auth-repository";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { Notice } from "@/design-system/components/notice";

/**
 * Sincronização das dietas — vive aqui, dentro de `app/`, não em
 * `features/diet`, mesma regra de `FoodLogSyncStatus`/`ManualSyncButton`
 * (`features/**` não pode importar `@/composition`, regra 4 do
 * `AGENTS.md`).
 *
 * Mesmo desenho de `FoodLogSyncStatus`: sincroniza sozinha ao montar a tela,
 * sem spinner (transparente), e só troca o botão comum pela tela de
 * resolução quando há conflito de verdade. A diferença é que aqui um
 * conflito é uma dieta inteira, não uma refeição dentro de um dia — e pode
 * haver mais de uma dieta em conflito ao mesmo tempo, cada uma resolvida
 * independentemente das outras (resolver uma não bloqueia nem destrava as
 * demais).
 */
interface SyncedState {
  readonly conflicts: readonly DietConflict[];
  readonly error: string | null;
}

const IDLE: SyncedState = { conflicts: [], error: null };

type AuthKnowledge = "unknown" | "anonymous" | "authenticated";

export function DietSyncStatus() {
  const [pending, setPending] = useState(false);
  const [auth, setAuth] = useState<AuthKnowledge>(() =>
    isSupabaseConfigured() ? "unknown" : "anonymous",
  );
  const [synced, setSynced] = useState<SyncedState>(IDLE);

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

  useEffect(() => {
    let active = true;

    async function autoSync() {
      if (!isSupabaseConfigured()) return;

      try {
        const outcome = await runDietSync();
        if (!active) return;
        setSynced({
          conflicts: outcome.pull.status === "done" ? outcome.pull.conflicts : [],
          error: outcome.pull.status === "error" ? outcome.pull.message : null,
        });
      } catch (cause) {
        if (active) {
          setSynced({
            conflicts: [],
            error: cause instanceof Error ? cause.message : "Falha ao sincronizar.",
          });
        }
      }
    }

    void autoSync();

    return () => {
      active = false;
    };
  }, []);

  async function sync() {
    setPending(true);
    try {
      const outcome = await runDietSync();
      setSynced({
        conflicts: outcome.pull.status === "done" ? outcome.pull.conflicts : [],
        error: outcome.pull.status === "error" ? outcome.pull.message : null,
      });
    } catch (cause) {
      setSynced({
        conflicts: [],
        error: cause instanceof Error ? cause.message : "Falha ao sincronizar.",
      });
    } finally {
      setPending(false);
    }
  }

  async function resolve(dietId: string, resolution: DietConflictResolution, remote: DietConflict["remote"]) {
    setPending(true);
    try {
      const outcome = await resolveDietConflictAndSync(dietId, resolution, remote);
      setSynced({
        conflicts: outcome.pull.status === "done" ? outcome.pull.conflicts : [],
        error: outcome.pull.status === "error" ? outcome.pull.message : null,
      });
    } catch (cause) {
      setSynced((current) => ({
        conflicts: current.conflicts,
        error: cause instanceof Error ? cause.message : "Falha ao resolver o conflito.",
      }));
    } finally {
      setPending(false);
    }
  }

  const { conflicts, error } = synced;

  if (conflicts.length > 0) {
    return (
      <div className="space-y-3">
        {error !== null && <Notice tone="warning">{error}</Notice>}
        {conflicts.map((conflict) => (
          <DietConflictCard
            key={conflict.dietId}
            conflict={conflict}
            pending={pending}
            onResolve={(resolution) => void resolve(conflict.dietId, resolution, conflict.remote)}
          />
        ))}
      </div>
    );
  }

  if (auth === "anonymous") {
    return (
      <p className="text-xs text-ink-subtle">
        Dados salvos neste dispositivo. Entre na sua conta para sincronizar.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {auth === "authenticated" && (
        <Button variant="ghost" size="sm" pending={pending} onClick={() => void sync()}>
          Sincronizar dietas
        </Button>
      )}
      {error !== null && <Notice tone="warning">{error}</Notice>}
    </div>
  );
}

function DietConflictCard({
  conflict,
  pending,
  onResolve,
}: {
  readonly conflict: DietConflict;
  readonly pending: boolean;
  readonly onResolve: (resolution: DietConflictResolution) => void;
}) {
  const name = conflict.local?.name ?? conflict.remote?.name ?? "Dieta";

  return (
    <Card tone="hero" as="section">
      <p className="text-ink">
        <strong>{name}</strong> foi alterada em outro dispositivo.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <DietSide label="Neste dispositivo" diet={conflict.local} />
        <DietSide label="Outro dispositivo" diet={conflict.remote} />
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
          {conflict.local === null ? "Manter exclusão" : "Manter neste dispositivo"}
        </Button>
        <Button
          size="sm"
          pending={pending}
          onClick={() => {
            onResolve("use-server");
          }}
        >
          {conflict.remote === null ? "Usar exclusão do outro" : "Usar outra versão"}
        </Button>
      </div>
    </Card>
  );
}

function DietSide({
  label,
  diet,
}: {
  readonly label: string;
  readonly diet: DietConflict["local"];
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      {diet === null ? (
        <p className="mt-1.5 text-sm text-ink-subtle">Dieta apagada.</p>
      ) : (
        <p className="mt-1.5 text-sm text-ink">
          {diet.meals.length} {diet.meals.length === 1 ? "refeição" : "refeições"}
        </p>
      )}
    </div>
  );
}
