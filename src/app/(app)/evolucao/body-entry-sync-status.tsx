"use client";

import { useEffect, useState } from "react";

import { isSupabaseConfigured } from "@/core/auth/env";
import { formatDecimal } from "@/core/format/decimal";
import {
  resolveBodyEntryConflictAndSync,
  runBodyEntrySync,
} from "@/composition/sync/sync-engine";
import type {
  BodyEntryConflict,
  BodyEntryConflictResolution,
} from "@/composition/sync/body-entry-sync";
import { createSupabaseAuthRepository } from "@/features/auth/data/supabase-auth-repository";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { Notice } from "@/design-system/components/notice";

/**
 * Sincronização do histórico de peso/medidas — vive aqui, dentro de
 * `app/`, não em `features/body`, mesma regra de `DietSyncStatus`
 * (`features/**` não pode importar `@/composition`, regra 4 do
 * `AGENTS.md`).
 *
 * Mesmo desenho de `DietSyncStatus`: sincroniza sozinha ao montar a tela,
 * sem spinner (transparente), e só troca o botão comum pela tela de
 * resolução quando há conflito de verdade. A diferença é que aqui um
 * conflito é um dia inteiro (peso, gordura corporal, medidas, notas), não
 * uma dieta ou rotina — e pode haver mais de um dia em conflito ao mesmo
 * tempo, cada um resolvido independentemente dos outros.
 *
 * Montada dentro de `/evolucao`, junto de `BodyScreen` — a única tela que
 * lê e edita `BodyEntry`.
 */
interface SyncedState {
  readonly conflicts: readonly BodyEntryConflict[];
  readonly error: string | null;
}

const IDLE: SyncedState = { conflicts: [], error: null };

type AuthKnowledge = "unknown" | "anonymous" | "authenticated";

export function BodyEntrySyncStatus() {
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
        const outcome = await runBodyEntrySync();
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
      const outcome = await runBodyEntrySync();
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
    day: string,
    resolution: BodyEntryConflictResolution,
    remote: BodyEntryConflict["remote"],
  ) {
    setPending(true);
    try {
      const outcome = await resolveBodyEntryConflictAndSync(day, resolution, remote);
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
          <BodyEntryConflictCard
            key={conflict.day}
            conflict={conflict}
            pending={pending}
            onResolve={(resolution) => void resolve(conflict.day, resolution, conflict.remote)}
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
          Sincronizar peso e medidas
        </Button>
      )}
      {error !== null && <Notice tone="warning">{error}</Notice>}
    </div>
  );
}

function BodyEntryConflictCard({
  conflict,
  pending,
  onResolve,
}: {
  readonly conflict: BodyEntryConflict;
  readonly pending: boolean;
  readonly onResolve: (resolution: BodyEntryConflictResolution) => void;
}) {
  return (
    <Card tone="hero" as="section">
      <p className="text-ink">
        O registro de <strong>{conflict.day}</strong> foi alterado em outro
        dispositivo.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <BodyEntrySide label="Neste dispositivo" entry={conflict.local} />
        <BodyEntrySide label="Outro dispositivo" entry={conflict.remote} />
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

function BodyEntrySide({
  label,
  entry,
}: {
  readonly label: string;
  readonly entry: BodyEntryConflict["local"];
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      {entry === null ? (
        <p className="mt-1.5 text-sm text-ink-subtle">Registro apagado.</p>
      ) : entry.weightKg !== null ? (
        <p className="mt-1.5 text-sm text-ink">
          <span className="tabular-nums">{formatDecimal(entry.weightKg)}</span> kg
        </p>
      ) : (
        <p className="mt-1.5 text-sm text-ink-subtle">Sem peso registrado.</p>
      )}
    </div>
  );
}
