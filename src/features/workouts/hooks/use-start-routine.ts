"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { describeDataError } from "@/core/domain/describe-data-error";

import { useWorkoutRepositories } from "../data/workout-repository-context";
import { startSession } from "../services/start-session";
import type { Routine } from "../types/routine";

/**
 * Iniciar um treino de fora do editor (o do treinador, Life Pro): o mesmo
 * `startSession` do editor, e a sessão é da pessoa como qualquer outra.
 */
export function useStartRoutine() {
  const repositories = useWorkoutRepositories();
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const start = useCallback(
    async (routine: Routine) => {
      setStartError(null);
      setStarting(true);
      try {
        const session = startSession(routine);
        await (await repositories).sessions.save(session, null);
        router.push(`/sessao/${session.id}`);
      } catch (cause) {
        setStartError(describeDataError(cause));
        setStarting(false);
      }
    },
    [repositories, router],
  );

  return { start, starting, startError };
}
