"use client";

import { useEffect, useState } from "react";

import { useFollowUpRepository } from "../data/follow-up-repository-context";
import { useProRoutineRepository } from "../data/routine-repository-context";
import { weekStart } from "../services/follow-up";
import type { PatientLink } from "../types/care";
import type { OverviewRow } from "../types/follow-up";
import type { RoutineSummary } from "../types/routine";

export type OverviewState =
  | { readonly status: "loading" }
  | { readonly status: "error" }
  | {
      readonly status: "ready";
      readonly rows: readonly OverviewRow[];
      readonly routinesByLink: ReadonlyMap<string, readonly RoutineSummary[]>;
    };

/**
 * O que a Visão geral lê além dos vínculos (Etapa 6): uma linha por paciente
 * ativo, só com o que ele libera, e os treinos publicados de cada um (os
 * dias da semana). Os treinos vêm desde o mais antigo entre a segunda desta
 * semana e sete dias atrás.
 */
export function useOverview(links: readonly PatientLink[] | null, today: string, now: number): OverviewState {
  const followUp = useFollowUpRepository();
  const routines = useProRoutineRepository();
  const [result, setResult] = useState<{ readonly from: readonly PatientLink[]; readonly state: OverviewState } | null>(null);

  useEffect(() => {
    if (links === null) return;
    let alive = true;
    const active = links.filter((link) => link.status === "active");
    const since = Math.min(now - 7 * 86_400_000, new Date(`${weekStart(today)}T00:00:00`).getTime());
    Promise.all([
      followUp.overview(since),
      Promise.all(
        active.map((link) =>
          routines
            .listRoutines(link.id)
            .then((list): readonly [string, readonly RoutineSummary[]] => [link.id, list.filter((routine) => routine.versions.length > 0)])
            // Sem os treinos de um paciente, a Visão geral ainda mostra o resto.
            .catch((): readonly [string, readonly RoutineSummary[]] => [link.id, []]),
        ),
      ),
    ])
      .then(([rows, pairs]) => {
        if (alive) setResult({ from: links, state: { status: "ready", rows, routinesByLink: new Map(pairs) } });
      })
      .catch(() => {
        if (alive) setResult({ from: links, state: { status: "error" } });
      });
    return () => {
      alive = false;
    };
  }, [links, today, now, followUp, routines]);

  return result !== null && result.from === links ? result.state : { status: "loading" };
}
