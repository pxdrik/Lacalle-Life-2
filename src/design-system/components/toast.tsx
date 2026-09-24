"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { cn } from "@/design-system/cn";

/** Long enough to read a short sentence, short enough not to linger. */
const VISIBLE_MS = 3200;

/**
 * A toast carrying an undo needs longer than one a person only reads —
 * noticing it, deciding, and reaching the button all take time a plain
 * confirmation never has to survive.
 */
const VISIBLE_WITH_ACTION_MS = 6000;

export interface ToastAction {
  /** The one thing the second tap does, e.g. "Desfazer". */
  readonly label: string;
  readonly onAction: () => void;
}

type ToastFn = (message: string, action?: ToastAction) => void;

const ToastContext = createContext<ToastFn | null>(null);

/**
 * Confirms the writes that leave no trace on screen.
 *
 * Most of this app needs nothing like it: change a portion and the calories
 * move in front of you — the number *is* the receipt. But saving a profile or
 * creating a food only ever confirmed itself by navigating away, which is
 * indistinguishable from a navigation that happened for some other reason.
 *
 * Deliberately not an error channel. Failures here are shown inline, next to
 * the thing that failed, where they can be acted on; a message that disappears
 * after three seconds is the wrong place to tell somebody their data did not
 * save.
 */
export function ToastProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const [toast, setToast] = useState<{
    readonly id: number;
    readonly message: string;
    readonly action?: ToastAction | undefined;
  } | null>(null);

  const id = toast?.id;
  const hasAction = toast?.action !== undefined;

  useEffect(() => {
    if (id === undefined) return;

    const timer = setTimeout(
      () => {
        setToast(null);
      },
      hasAction ? VISIBLE_WITH_ACTION_MS : VISIBLE_MS,
    );

    return () => {
      clearTimeout(timer);
    };
    // Keyed on the id (and `hasAction`, which only ever changes alongside
    // it): firing a second toast restarts the clock instead of inheriting
    // the remainder of the first one's.
  }, [id, hasAction]);

  return (
    <ToastContext
      value={(message, action) => {
        setToast({ id: Date.now(), message, action });
      }}
    >
      {children}

      {/*
        Always mounted, so a screen reader has a live region to announce into.
        Rendering it only while there is a message means the region is created
        at the same moment it fills, and the announcement is missed.

        `polite`, never `assertive`: this confirms something that already went
        right, and interrupting someone mid-sentence to say so is rude.
      */}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4",
          // Above the tab bar on a phone, using the same token the bar and the
          // rest timer read, so the three cannot disagree about the height.
          "bottom-[calc(var(--bottom-nav-h)+1rem)]",
        )}
      >
        {toast !== null && (
          <div
            // `key` on the id: a second message replaces the first outright
            // and plays the entrance again, rather than swapping the text
            // inside a box that is already sitting still.
            key={toast.id}
            className={cn(
              "animate-rise pointer-events-auto flex max-w-md items-center gap-3",
              "rounded-lg border border-line bg-elevated px-4 py-3 text-sm text-ink shadow-modal",
            )}
          >
            <p className="flex-1">{toast.message}</p>
            {toast.action !== undefined && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onAction();
                  setToast(null);
                }}
                className="shrink-0 font-medium text-accent-text underline underline-offset-2"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext>
  );
}

/**
 * Shows a short confirmation.
 *
 * Returns a no-op outside a provider rather than throwing: a confirmation is
 * an enhancement, and a screen rendered in a test or in isolation should not
 * crash for lack of one.
 */
export function useToast(): ToastFn {
  return useContext(ToastContext) ?? (() => undefined);
}
