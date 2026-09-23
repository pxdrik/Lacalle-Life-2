"use client";

import { useEffect } from "react";

import {
  BodyDataProvider,
  FoodLogDataProvider,
  WorkoutDataProvider,
} from "@/composition/data-providers";
import {
  runBodyEntrySync,
  runDietSync,
  runFoodLogSync,
  runProfileSync,
  runRoutineSync,
  runSessionSync,
} from "@/composition/sync/sync-engine";
import { isSupabaseConfigured } from "@/core/auth/env";
import { dayKey } from "@/core/format/day";

/**
 * RM11 (roadmap 23/09/2026) — carrega tudo já na abertura do app, em vez de
 * cada aba só abrir o próprio repositório (e só então sincronizar) na
 * primeira vez que alguém entra nela.
 *
 * As fábricas em `data-providers.tsx` já memoizam cada repositório
 * (`once<T>`) pelo tempo de vida da página — a mesma promise resolvida
 * volta instantânea para quem pedir de novo. O que não existia era algo
 * chamando essas fábricas *antes* de a pessoa abrir a aba: sem isto, o
 * primeiro IndexedDB só abria quando `/treinos` montava o próprio
 * `WorkoutDataProvider`, e a navegação inteira pagava esse custo uma vez
 * por aba, na ordem em que a pessoa foi clicando.
 *
 * Montado aqui, em `(app)/layout.tsx` — que só existe uma vez por entrada no
 * app e nunca remonta entre `/hoje`, `/diario`, `/treinos` etc. (ver o
 * comentário desse arquivo) — todo repositório começa a abrir em paralelo
 * no instante em que o app aparece, e cada tela específica que já embrulha
 * o próprio provider (`FoodLogDataProvider` em `/diario`, `WorkoutDataProvider`
 * em `/treinos`, e por aí) recebe de volta a mesma promise já resolvida.
 * Aquelas chamadas continuam de propósito — cada tela documenta ali mesmo
 * de que repositório precisa, e ganhar isso de graça pelo layout quebraria
 * silenciosamente se este componente um dia sumisse.
 *
 * O pull de sincronização entra pela mesma porta, uma vez, ao montar: perfil,
 * dietas, rotinas, sessões, corpo (cada um cobre todo o histórico) e o
 * diário do dia de hoje — o único que a abertura do app pode adivinhar, já
 * que o diário é por dia. Silencioso de propósito, mesma convenção do push
 * debounçado em `data-providers.tsx`: uma falha aqui (rede fora, sem sessão)
 * não aparece em lugar nenhum, e a tela real — `FoodLogSyncStatus` e as
 * outras `*-sync-status.tsx` — roda o próprio sync de novo ao montar e
 * mostra um erro de verdade, se ele persistir.
 */
export function AppDataBoot({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    runProfileSync().catch(() => undefined);
    runDietSync().catch(() => undefined);
    runRoutineSync().catch(() => undefined);
    runSessionSync().catch(() => undefined);
    runBodyEntrySync().catch(() => undefined);
    runFoodLogSync(dayKey(new Date())).catch(() => undefined);
  }, []);

  return (
    <FoodLogDataProvider>
      <WorkoutDataProvider>
        <BodyDataProvider>{children}</BodyDataProvider>
      </WorkoutDataProvider>
    </FoodLogDataProvider>
  );
}
