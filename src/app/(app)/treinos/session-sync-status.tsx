"use client";

import { useEffect, useState } from "react";

import { isSupabaseConfigured } from "@/core/auth/env";
import {
  resolveSessionConflictAndSync,
  runSessionSync,
} from "@/composition/sync/sync-engine";
import type { SessionConflict, SessionConflictResolution } from "@/composition/sync/session-sync";
import { createSupabaseAuthRepository } from "@/features/auth/data/supabase-auth-repository";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { Notice } from "@/design-system/components/notice";

/**
 * Sincronização das sessões (treinos executados) — vive aqui, dentro de
 * `app/`, não em `features/workouts`, mesma regra de `RoutineSyncStatus`
 * (`features/**` não pode importar `@/composition`, regra 4 do
 * `AGENTS.md`).
 *
 * Montado em `/treinos`, ao lado de `RoutineSyncStatus`, não na tela de
 * execução (`/sessao/[id]`) nem em `/evolucao`: uma sessão em andamento
 * nunca sincroniza (§8.4), então uma tela de sincronização na tela de
 * execução não teria nada para mostrar na maior parte do tempo; `/treinos`
 * é o hub de treino que a pessoa já abre com frequência, o mesmo raciocínio
 * que já vale para rotinas.
 *
 * Mesmo desenho de `RoutineSyncStatus`: sincroniza sozinha ao montar a
 * tela, sem spinner, e só troca o botão comum pela tela de resolução
 * quando há conflito de verdade — um conflito aqui só pode existir para
 * uma sessão já finalizada (nada em andamento chega a este ponto).
 */
interface SyncedState {
  readonly conflicts: readonly SessionConflict[];
  readonly error: string | null;
}

const IDLE: SyncedState = { conflicts: [], error: null };

type AuthKnowledge = "unknown" | "anonymous" | "authenticated";

export function SessionSyncStatus() {
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
        const outcome = await runSessionSync();
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
      const outcome = await runSessionSync();
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
    sessionId: string,
    resolution: SessionConflictResolution,
    remote: SessionConflict["remote"],
  ) {
    setPending(true);
    try {
      const outcome = await resolveSessionConflictAndSync(sessionId, resolution, remote);
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
          <SessionConflictCard
            key={conflict.sessionId}
            conflict={conflict}
            pending={pending}
            onResolve={(resolution) => void resolve(conflict.sessionId, resolution, conflict.remote)}
          />
        ))}
      </div>
    );
  }

  // `RoutineSyncStatus`, montado logo acima na mesma tela, já mostra este
  // aviso — as duas mensagens eram idênticas letra por letra, e apareciam
  // uma embaixo da outra (achado de auditoria de design, 02/09/2026:
  // "Dados salvos neste dispositivo..." duas vezes seguidas em `/treinos`).
  // Sem conta não há nada para sincronizar em nenhuma das duas listas, então
  // uma frase basta; quando autenticado, o botão abaixo continua próprio
  // desta lista ("Sincronizar treinos executados"), porque aí a ação é
  // realmente distinta da de `RoutineSyncStatus`.
  if (auth === "anonymous") {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {auth === "authenticated" && (
        <Button variant="ghost" size="sm" pending={pending} onClick={() => void sync()}>
          Sincronizar treinos executados
        </Button>
      )}
      {error !== null && <Notice tone="warning">{error}</Notice>}
    </div>
  );
}

function SessionConflictCard({
  conflict,
  pending,
  onResolve,
}: {
  readonly conflict: SessionConflict;
  readonly pending: boolean;
  readonly onResolve: (resolution: SessionConflictResolution) => void;
}) {
  const name = conflict.local?.name ?? conflict.remote?.name ?? "Treino executado";

  return (
    <Card tone="hero" as="section">
      <p className="text-ink">
        <strong>{name}</strong> foi alterada em outro dispositivo.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <SessionSide label="Neste dispositivo" session={conflict.local} />
        <SessionSide label="Outro dispositivo" session={conflict.remote} />
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

function SessionSide({
  label,
  session,
}: {
  readonly label: string;
  readonly session: SessionConflict["local"];
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      {session === null ? (
        <p className="mt-1.5 text-sm text-ink-subtle">Sessão apagada.</p>
      ) : (
        <p className="mt-1.5 text-sm text-ink">
          {session.exercises.length}{" "}
          {session.exercises.length === 1 ? "exercício" : "exercícios"}
        </p>
      )}
    </div>
  );
}
