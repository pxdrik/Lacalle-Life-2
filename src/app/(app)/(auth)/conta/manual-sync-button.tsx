"use client";

import { useEffect, useRef, useState } from "react";

import { isSupabaseConfigured } from "@/core/auth/env";
import { formatDecimal } from "@/core/format/decimal";
import { resolveProfileConflictAndSync, runProfileSync } from "@/composition/sync/sync-engine";
import type { PullProfileResult } from "@/composition/sync/profile-sync";
import { notifyProfileChanged } from "@/features/profile/data/profile-changed";
import { Button } from "@/design-system/components/button";
import { Notice } from "@/design-system/components/notice";
import { SyncingOverlay } from "@/design-system/components/syncing-overlay";

type ConflictResult = Extract<PullProfileResult, { status: "conflict" }>;

/**
 * Sincronização manual do perfil — vive aqui, dentro de `app/`, e não em
 * `features/auth`, porque chama `@/composition/sync` diretamente e
 * `features/**` não tem permissão de importar composition (mesma regra do
 * `AGENTS.md` que já vale para o resto do app).
 *
 * Sincroniza sozinho ao montar a tela, mesmo desenho de `DietSyncStatus`/
 * `FoodLogSyncStatus`/`RoutineSyncStatus` — achado ao vivo contra produção
 * (02/09/2026): `profile` era a única das quatro entidades que ainda exigia
 * o clique manual até para *puxar*, não só para empurrar, e um conflito
 * real (dois pesos diferentes em dois aparelhos) ficou invisível vários
 * dias só porque ninguém pensou em abrir esta tela e clicar o botão. O
 * botão continua existindo — um clique explícito depois do automático
 * silencioso ainda é o único jeito de forçar uma nova tentativa depois de
 * um erro.
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

  const FAILURE_MESSAGE = "Não foi possível sincronizar agora. Tente de novo em instantes.";

  // Só o clique manual e a resolução de conflito passam por isto — a
  // sincronização automática ao montar tem sua própria guarda (`active` no
  // efeito) e nunca mostra a tela de carregamento, então não há nada para
  // cancelar nela. `true` quando a própria pessoa pediu "Cancelar": o
  // resultado da chamada em andamento, quando finalmente chegar, é
  // descartado (`isActive` em `syncAndReport` cobre isso), e o botão volta
  // ao normal na hora, sem esperar a rede.
  const cancelledRef = useRef(false);

  // Compartilhada pelo efeito de montagem, pelo clique manual e pela
  // resolução de conflito. Nunca mostra o status técnico do resultado
  // (`push: X · pull: Y`) num sucesso — achado do Pedro: "isso não deveria
  // aparecer pro usuário", e de fato não é informação acionável para quem
  // só quer saber se está sincronizado. Só um conflito real ou um erro de
  // verdade interrompe o silêncio. `isActive`, quando passado, é checado
  // depois de cada `await` antes de qualquer `setState` — a mesma guarda que
  // já existia inline no efeito de montagem, só compartilhada agora.
  //
  // Achado do Pedro: a tela de carregamento sumia assim que a rede
  // respondia, antes do número na tela ter realmente trocado — porque puxar
  // dado novo e a tela mostrar esse dado novo sempre foram dois passos
  // separados (`useProfile` só lê uma vez, ao montar). `notifyProfileChanged`
  // é o segundo passo, e `syncAndReport` só solta o `pending` depois que ele
  // também termina — a tela de carregamento agora cobre os dois.
  async function syncAndReport(
    run: () => Promise<{
      readonly push: { readonly status: string };
      readonly pull: PullProfileResult;
    }>,
    isActive: () => boolean = () => true,
  ) {
    try {
      const outcome = await run();
      if (!isActive()) return;
      const failed =
        outcome.push.status === "error" || outcome.pull.status === "error";
      setConflict(outcome.pull.status === "conflict" ? outcome.pull : null);
      setResult(failed ? FAILURE_MESSAGE : null);

      if (!failed && outcome.pull.status !== "conflict") {
        await notifyProfileChanged();
        if (!isActive()) return;
      }
    } catch {
      if (isActive()) setResult(FAILURE_MESSAGE);
    }
  }

  useEffect(() => {
    let active = true;

    async function autoSync() {
      if (isSupabaseConfigured()) {
        await syncAndReport(runProfileSync, () => active);
      }
    }

    void autoSync();
    return () => {
      active = false;
    };
  }, []);

  async function handleSync() {
    cancelledRef.current = false;
    setPending(true);
    setResult(null);
    await syncAndReport(runProfileSync, () => !cancelledRef.current);
    if (!cancelledRef.current) setPending(false);
  }

  async function handleResolve(resolution: "keep-local" | "use-server") {
    if (conflict === null) return;
    cancelledRef.current = false;
    setPending(true);
    setResult(null);
    await syncAndReport(
      () => resolveProfileConflictAndSync(resolution, conflict.remote),
      () => !cancelledRef.current,
    );
    if (!cancelledRef.current) setPending(false);
  }

  // Escape para quando a sincronização trava — sem timeout embutido, uma
  // rede que nunca responde deixaria a tela de carregamento presa para
  // sempre. Não cancela a chamada de rede em si (não tem como, o fetch
  // continua correndo em segundo plano); só para de esperar por ela e
  // devolve o controle. Se aquela chamada eventualmente responder,
  // `isActive` em `syncAndReport` garante que o resultado tardio é
  // descartado, não reaparece na tela por baixo do que a pessoa já viu.
  function handleCancel() {
    cancelledRef.current = true;
    setPending(false);
  }

  // `pending` só fica `true` dentro de `handleSync`/`handleResolve` — a
  // sincronização automática ao montar nunca toca nele, de propósito (não
  // deveria interromper quem nem clicou em nada). Cobrir a tela é seguro
  // exatamente por isso: só aparece quando a própria pessoa pediu a
  // sincronização e está esperando por ela, nunca em segundo plano.
  if (pending) {
    return <SyncingOverlay onCancel={handleCancel} />;
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
          {/* Nunca ficam em `pending`: enquanto está, o retorno antecipado
              acima já trocou a tela inteira por `SyncingOverlay`. */}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void handleResolve("keep-local")}
          >
            Manter {formatDecimal(conflict.local.nutrition.weightKg)} kg
          </Button>
          <Button
            size="sm"
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
      <Button variant="secondary" onClick={() => void handleSync()}>
        Sincronizar dados
      </Button>
      {result !== null && <Notice tone="danger">{result}</Notice>}
    </div>
  );
}
