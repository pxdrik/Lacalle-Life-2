"use client";

import { useEffect, useState } from "react";

import { isSupabaseConfigured } from "@/core/auth/env";
import {
  resolveDietConflictAndSync,
  runDietSync,
} from "@/composition/sync/sync-engine";
import type { DietConflict, DietConflictResolution } from "@/composition/sync/diet-sync";
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
 * sem spinner (transparente), e sem botão manual nenhum (18/09/2026,
 * pedido do Pedro) — só troca o silêncio pela tela de resolução quando há
 * conflito de verdade. A diferença é que aqui um conflito é uma dieta
 * inteira, não uma refeição dentro de um dia — e pode haver mais de uma
 * dieta em conflito ao mesmo tempo, cada uma resolvida independentemente
 * das outras (resolver uma não bloqueia nem destrava as demais).
 */
interface SyncedState {
  readonly conflicts: readonly DietConflict[];
  readonly error: string | null;
}

const IDLE: SyncedState = { conflicts: [], error: null };

export function DietSyncStatus() {
  const [pending, setPending] = useState(false);
  const [synced, setSynced] = useState<SyncedState>(IDLE);

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
