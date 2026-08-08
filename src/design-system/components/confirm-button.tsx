"use client";

import { cn } from "@/design-system/cn";
import { useArmed } from "@/design-system/hooks/use-armed";

interface Props {
  readonly onConfirm: () => void;
  /** Announced on the idle button, e.g. "Excluir Treino A". */
  readonly label: string;
  readonly confirmLabel?: string;
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
  confirmLabel = "Confirmar",
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
