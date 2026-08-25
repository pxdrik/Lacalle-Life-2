"use client";

import { useState } from "react";

import { runProfileSync } from "@/composition/sync/sync-engine";
import { Button } from "@/design-system/components/button";
import { Notice } from "@/design-system/components/notice";

/**
 * Sincronização manual do perfil — vive aqui, dentro de `app/`, e não em
 * `features/auth`, porque chama `@/composition/sync` diretamente e
 * `features/**` não tem permissão de importar composition (mesma regra do
 * `AGENTS.md` que já vale para o resto do app).
 *
 * Primeira fatia do motor de sync: só `profile`. Botão manual em vez de
 * automático de propósito — provar o mecanismo (outbox, push, pull,
 * conflito) antes de decidir quando disparar sozinho.
 */
export function ManualSyncButton() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setPending(true);
    setResult(null);

    try {
      const outcome = await runProfileSync();
      setResult(`push: ${outcome.push.status} · pull: ${outcome.pull.status}`);
    } catch (cause) {
      setResult(cause instanceof Error ? cause.message : "Falha ao sincronizar.");
    } finally {
      setPending(false);
    }
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
