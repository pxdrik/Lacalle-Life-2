"use client";

import { cn } from "@/design-system/cn";
import { useArmed } from "@/design-system/hooks/use-armed";

interface Props {
  readonly onConfirm: () => void;
  /** Announced on the idle button, e.g. "Excluir Treino A". */
  readonly label: string;
  /**
   * What the second tap does, in one or two words. **Required**, and that is
   * the point: it used to default to "Confirmar", and one screen quietly took
   * the default — asking "Confirmar?" over a weigh-in, which answers nothing.
   * A type error is a better reminder than a convention nobody reads.
   *
   * The app uses two verbs, and the difference is real rather than stylistic:
   *
   * - **"Excluir?"** — the record goes away. A diet, a meal, a food, a
   *   routine, a session, a weigh-in.
   * - **"Remover?"** — it leaves this list and still exists somewhere else.
   *   Taking an exercise out of a routine does not delete the exercise.
   *
   * The profile's "Apagar tudo?" is neither: it clears a whole dataset rather
   * than one record, and saying so plainly beats forcing it into the pair.
   */
  readonly confirmLabel: string;
  readonly className?: string;
  readonly children: React.ReactNode;
}

/**
 * A destructive action that takes two taps.
 *
 * The two-tap behaviour lives in `useArmed`; this is the small icon button
 * that wears it.
 */
export function ConfirmButton({
  onConfirm,
  label,
  confirmLabel,
  className,
  children,
}: Props) {
  const { armed, confirm, disarm } = useArmed();

  return (
    <button
      type="button"
      aria-label={armed ? `${confirmLabel}: ${label}` : label}
      onBlur={disarm}
      onClick={() => {
        confirm(onConfirm);
      }}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md transition-colors duration-150 ease-out",
        armed
          ? "bg-danger px-2.5 text-xs font-medium text-danger-ink"
          : "text-ink-subtle hover:bg-danger/10 hover:text-danger",
        className,
      )}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
