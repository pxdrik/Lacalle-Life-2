"use client";

import { useEffect, useState } from "react";

import { isSupabaseConfigured } from "@/core/auth/env";
import {
  resolveRoutineConflictAndSync,
  runRoutineSync,
} from "@/composition/sync/sync-engine";
import type { RoutineConflict, RoutineConflictResolution } from "@/composition/sync/routine-sync";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { Notice } from "@/design-system/components/notice";

/**
 * Sincronização das rotinas — vive aqui, dentro de `app/`, não em
 * `features/workouts`, mesma regra de `DietSyncStatus` (`features/**` não
 * pode importar `@/composition`, regra 4 do `AGENTS.md`).
 *
 * Mesmo desenho de `DietSyncStatus`: sincroniza sozinha ao montar a tela,
 * sem spinner (transparente), e sem botão manual nenhum (18/09/2026,
 * pedido do Pedro) — só troca o silêncio pela tela de resolução quando há
 * conflito de verdade. Um conflito é uma rotina inteira, e pode haver mais
 * de uma em conflito ao mesmo tempo, cada uma resolvida independentemente
 * das outras.
 */
interface SyncedState {
  readonly conflicts: readonly RoutineConflict[];
  readonly error: string | null;
}

const IDLE: SyncedState = { conflicts: [], error: null };

export function RoutineSyncStatus() {
  const [pending, setPending] = useState(false);
  const [synced, setSynced] = useState<SyncedState>(IDLE);

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

  // Nem o botão manual de sincronizar aparece mais, logado ou não — pedido
  // do Pedro (18/09/2026), um passo além do de ontem (que só tirava o
  // aviso pra quem estava sem conta). A sincronização em si continua
  // rodando sozinha ao montar a tela (o efeito acima); só resta mostrar
  // algo se esse auto-sync falhou de verdade.
  if (error !== null) {
    return <Notice tone="warning">{error}</Notice>;
  }

  return null;
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
