import Link from "next/link";

import {
  comparePlanned,
  formatDuration,
  sessionDurationMs,
  sessionProgress,
  sessionVolumeKg,
} from "../services/session-stats";
import type { Session } from "../types/session";

/**
 * What the workout was, once it is over.
 *
 * The plan-versus-reality column is the reason the session carries a frozen
 * `planned` on every set: "I planned 8 at RPE 8 and did 6 at RPE 9" is the
 * sentence that makes next week's plan better, and it is unrecoverable if the
 * routine is consulted instead.
 */
export function SessionSummary({ session }: { readonly session: Session }) {
  const progress = sessionProgress(session);
  const volume = sessionVolumeKg(session);

  return (
    <div>
      <p className="text-sm text-ink-muted">Treino concluído</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{session.name}</h1>

      <dl className="mt-6 grid grid-cols-3 gap-4 rounded-xl border border-line bg-surface p-5">
        <Figure
          label="Duração"
          value={formatDuration(sessionDurationMs(session) ?? 0)}
        />
        <Figure
          label="Séries"
          value={`${String(progress.completed)}/${String(progress.total)}`}
        />
        <Figure label="Volume" value={`${volume.toLocaleString("pt-BR")} kg`} />
      </dl>

      <div className="mt-4 space-y-3">
        {session.exercises.map((exercise) => (
          <section
            key={exercise.id}
            className="rounded-xl border border-line bg-surface p-4"
          >
            <h2 className="font-medium text-ink">{exercise.name}</h2>

            <ul className="mt-2 space-y-1">
              {exercise.sets.map((set, index) => {
                const { rpeDelta } = comparePlanned(set);

                return (
                  <li
                    key={set.id}
                    className="flex items-baseline gap-3 font-mono text-sm tabular-nums"
                  >
                    <span className="w-5 text-ink-subtle">{index + 1}</span>

                    {set.isCompleted ? (
                      <span className="text-ink">
                        {set.reps ?? "—"} × {set.weightKg ?? "—"} kg
                        {set.rpe !== null && (
                          <span className="text-ink-muted"> · RPE {set.rpe}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-ink-subtle">não realizada</span>
                    )}

                    {/* Only shown when it differs — a delta of zero is noise. */}
                    {rpeDelta !== null && rpeDelta !== 0 && (
                      <span
                        className={rpeDelta > 0 ? "text-danger" : "text-ink-subtle"}
                      >
                        {rpeDelta > 0 ? "+" : ""}
                        {rpeDelta} vs plano
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            {exercise.notes !== "" && (
              <p className="mt-2 text-sm text-ink-muted">{exercise.notes}</p>
            )}
          </section>
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          href="/treinos"
          className="inline-flex h-11 items-center rounded-lg bg-accent px-5 text-sm font-medium text-accent-ink transition-opacity duration-150 ease-out hover:opacity-90"
        >
          Voltar para os treinos
        </Link>
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <dd className="font-mono text-xl tabular-nums text-ink">{value}</dd>
      <dt className="mt-0.5 text-xs text-ink-subtle">{label}</dt>
    </div>
  );
}
