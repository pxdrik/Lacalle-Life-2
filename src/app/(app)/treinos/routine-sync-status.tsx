"use client";

import { useEffect, useState } from "react";

import { isSupabaseConfigured } from "@/core/auth/env";
import {
  resolveRoutineConflictAndSync,
  runRoutineSync,
} from "@/composition/sync/sync-engine";
import type { RoutineConflict, RoutineConflictResolution } from "@/composition/sync/routine-sync";
import { createSupabaseAuthRepository } from "@/features/auth/data/supabase-auth-repository";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { Notice } from "@/design-system/components/notice";

/**
 * Sincronização das rotinas — vive aqui, dentro de `app/`, não em
 * `features/workouts`, mesma regra de `DietSyncStatus` (`features/**` não
 * pode importar `@/composition`, regra 4 do `AGENTS.md`).
 *
 * Mesmo desenho de `DietSyncStatus`: sincroniza sozinha ao montar a tela,
 * sem spinner (transparente), e só troca o botão comum pela tela de
 * resolução quando há conflito de verdade. Um conflito é uma rotina
 * inteira, e pode haver mais de uma em conflito ao mesmo tempo, cada uma
 * resolvida independentemente das outras.
 */
interface SyncedState {
  readonly conflicts: readonly RoutineConflict[];
  readonly error: string | null;
}

const IDLE: SyncedState = { conflicts: [], error: null };

type AuthKnowledge = "unknown" | "anonymous" | "authenticated";

export function RoutineSyncStatus() {
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
        const outcome = await runRoutineSync();
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
      const outcome = await runRoutineSync();
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

  async function resolve(
    routineId: string,
    resolution: RoutineConflictResolution,
    remote: RoutineConflict["remote"],
  ) {
    setPending(true);
    try {
      const outcome = await resolveRoutineConflictAndSync(routineId, resolution, remote);
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
          <RoutineConflictCard
            key={conflict.routineId}
            conflict={conflict}
            pending={pending}
            onResolve={(resolution) => void resolve(conflict.routineId, resolution, conflict.remote)}
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
          Sincronizar treinos
        </Button>
      )}
      {error !== null && <Notice tone="warning">{error}</Notice>}
    </div>
  );
}

function RoutineConflictCard({
  conflict,
  pending,
  onResolve,
}: {
  readonly conflict: RoutineConflict;
  readonly pending: boolean;
  readonly onResolve: (resolution: RoutineConflictResolution) => void;
}) {
  const name = conflict.local?.name ?? conflict.remote?.name ?? "Rotina";

  return (
    <Card tone="hero" as="section">
      <p className="text-ink">
        <strong>{name}</strong> foi alterada em outro dispositivo.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <RoutineSide label="Neste dispositivo" routine={conflict.local} />
        <RoutineSide label="Outro dispositivo" routine={conflict.remote} />
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

function RoutineSide({
  label,
  routine,
}: {
  readonly label: string;
  readonly routine: RoutineConflict["local"];
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      {routine === null ? (
        <p className="mt-1.5 text-sm text-ink-subtle">Rotina apagada.</p>
      ) : (
        <p className="mt-1.5 text-sm text-ink">
          {routine.exercises.length}{" "}
          {routine.exercises.length === 1 ? "exercício" : "exercícios"}
        </p>
      )}
    </div>
  );
}
