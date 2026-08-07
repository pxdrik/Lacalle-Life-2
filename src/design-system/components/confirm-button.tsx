"use client";

import { useEffect, useState } from "react";

import { cn } from "@/design-system/cn";

interface Props {
  readonly onConfirm: () => void;
  /** Announced on the idle button, e.g. "Excluir Treino A". */
  readonly label: string;
  readonly confirmLabel?: string;
  readonly className?: string;
  readonly children: React.ReactNode;
}

/** How long the armed state waits before giving up on its own. */
const DISARM_AFTER_MS = 4000;

/**
 * A destructive action that takes two taps.
 *
 * Not a dialog: a modal for "are you sure" steals focus, traps the keyboard
 * and needs an escape route, all to ask a question the button can ask itself.
 * The first tap arms it and changes what it says; the second does the thing.
 *
 * It disarms on its own after a few seconds and on blur, so an armed button
 * left behind by a mis-tap cannot fire later by accident.
 */
export function ConfirmButton({
  onConfirm,
  label,
  confirmLabel = "Confirmar",
  className,
  children,
}: Props) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;

    const id = setTimeout(() => {
      setArmed(false);
    }, DISARM_AFTER_MS);

    return () => {
      clearTimeout(id);
    };
  }, [armed]);

  return (
    <button
      type="button"
      aria-label={armed ? `${confirmLabel}: ${label}` : label}
      onBlur={() => {
        setArmed(false);
      }}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
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
