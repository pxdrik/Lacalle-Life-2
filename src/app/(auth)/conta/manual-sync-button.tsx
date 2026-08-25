"use client";

import { useState } from "react";

import { formatDecimal } from "@/core/format/decimal";
import { resolveProfileConflictAndSync, runProfileSync } from "@/composition/sync/sync-engine";
import type { PullProfileResult } from "@/composition/sync/profile-sync";
import { Button } from "@/design-system/components/button";
import { Notice } from "@/design-system/components/notice";

type ConflictResult = Extract<PullProfileResult, { status: "conflict" }>;

/**
 * Sincronização manual do perfil — vive aqui, dentro de `app/`, e não em
 * `features/auth`, porque chama `@/composition/sync` diretamente e
 * `features/**` não tem permissão de importar composition (mesma regra do
 * `AGENTS.md` que já vale para o resto do app).
 *
 * Primeira fatia do motor de sync: só `profile`. Botão manual em vez de
 * automático de propósito — provar o mecanismo (outbox, push, pull,
 * conflito) antes de decidir quando disparar sozinho.
 *
 * **Um conflito nunca se resolve clicando "sincronizar" de novo.** Enquanto
 * `pull.status === "conflict"`, o botão normal some e só a escolha explícita
 * aparece — é a garantia central que o motor promete para a família Profile
 * (docs/arquitetura-sincronizacao.md §8.1/§16/§22.3): nenhum dispositivo
 * sobrescreve o outro em silêncio.
 */
export function ManualSyncButton() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ConflictResult | null>(null);

  async function handleSync() {
    setPending(true);
    setResult(null);

    try {
      const outcome = await runProfileSync();
      setResult(`push: ${outcome.push.status} · pull: ${outcome.pull.status}`);
      setConflict(outcome.pull.status === "conflict" ? outcome.pull : null);
    } catch (cause) {
      setResult(cause instanceof Error ? cause.message : "Falha ao sincronizar.");
    } finally {
      setPending(false);
    }
  }

  async function handleResolve(resolution: "keep-local" | "use-server") {
    if (conflict === null) return;
    setPending(true);
    setResult(null);

    try {
      const outcome = await resolveProfileConflictAndSync(resolution, conflict.remote);
      setResult(`push: ${outcome.push.status} · pull: ${outcome.pull.status}`);
      setConflict(outcome.pull.status === "conflict" ? outcome.pull : null);
    } catch (cause) {
      setResult(cause instanceof Error ? cause.message : "Falha ao resolver o conflito.");
    } finally {
      setPending(false);
    }
  }

  if (conflict !== null) {
    return (
      <Notice tone="warning" title="Conflito de dados">
        <p>Este perfil foi alterado em outro dispositivo.</p>
        <div className="mt-2 space-y-1 text-ink-muted">
          <p>
            Neste dispositivo:{" "}
            <strong className="tabular-nums text-ink">
              {formatDecimal(conflict.local.nutrition.weightKg)} kg
            </strong>
          </p>
          <p>
            Outro dispositivo:{" "}
            <strong className="tabular-nums text-ink">
              {formatDecimal(conflict.remote.nutrition.weightKg)} kg
            </strong>
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            pending={pending}
            onClick={() => void handleResolve("keep-local")}
          >
            Manter {formatDecimal(conflict.local.nutrition.weightKg)} kg
          </Button>
          <Button
            size="sm"
            pending={pending}
            onClick={() => void handleResolve("use-server")}
          >
            Usar {formatDecimal(conflict.remote.nutrition.weightKg)} kg
          </Button>
        </div>
      </Notice>
    );
  }

  return (
    <div className="space-y-2">
      <Button variant="secondary" pending={pending} onClick={() => void handleSync()}>
        Sincronizar perfil agora
      </Button>
      {result !== null && (
        <Notice tone="info">
          <span className="font-mono text-xs">{result}</span>
        </Notice>
      )}
    </div>
  );
}
