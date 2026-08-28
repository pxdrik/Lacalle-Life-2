import { Check } from "lucide-react";

import { cardSurface } from "@/design-system/components/card";

const SETS = [
  { reps: 10, weight: "60 kg", rpe: "7", done: true },
  { reps: 8, weight: "62,5 kg", rpe: "8", done: true },
  { reps: 6, weight: "65 kg", rpe: null, done: false },
] as const;

/**
 * Uma série de treino em miniatura, com a mesma grade REPS/PESO/RPE e o mesmo
 * check de acento que uma série concluída de verdade usa em `/sessao/[id]`.
 */
export function VisualWorkout() {
  return (
    <div className={cardSurface("hero")}>
      <p className="font-semibold text-ink">Supino reto com barra</p>

      <div className="mt-3 grid grid-cols-[2rem_1fr_1fr_1fr] gap-2 text-xs text-ink-subtle">
        <span>#</span>
        <span>Reps</span>
        <span>Peso</span>
        <span>RPE</span>
      </div>

      <ul className="mt-1.5 divide-y divide-line">
        {SETS.map((set, index) => (
          <li
            key={index}
            className="grid grid-cols-[2rem_1fr_1fr_1fr] items-center gap-2 py-2 text-sm tabular-nums text-ink"
          >
            <span className="flex size-5 items-center justify-center">
              {set.done ? (
                <span
                  aria-hidden
                  className="flex size-5 items-center justify-center rounded-full bg-accent text-accent-ink"
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>
              ) : (
                <span className="text-ink-subtle">{index + 1}</span>
              )}
            </span>
            <span>{set.reps}</span>
            <span>{set.weight}</span>
            <span className="text-ink-subtle">{set.rpe ?? "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
