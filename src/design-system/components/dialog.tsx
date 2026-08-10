"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { cn } from "../cn";

interface Props {
  readonly open: boolean;
  /** Names the dialog for assistive technology, and is shown as its heading. */
  readonly title: string;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
  readonly className?: string | undefined;
}

/**
 * A modal built on the native `<dialog>`.
 *
 * `showModal()` rather than a div with a high z-index: it puts the element in
 * the top layer, traps focus, restores focus to whatever opened it, handles
 * Escape, and gives us a real `::backdrop`. Every one of those is a bug we
 * would otherwise write ourselves and get subtly wrong.
 *
 * ---
 *
 * **When this, and when an inline panel.** The app uses both, and a design
 * audit reasonably called the split undocumented — the distinction was real
 * and lived nowhere. It is one question:
 *
 * > Does the content behind need to stay visible while you work?
 *
 * **Inline** when the answer is yes, because the point is watching it react.
 * Adding a food to a meal must show the food land and the totals move; editing
 * a set must show the set. Covering that with a modal would hide the feedback
 * the interaction exists to produce.
 *
 * **This** when the answer is no: reading an exercise's detail, choosing where
 * to navigate, narrowing a list. Nothing behind is changing, so covering it
 * costs nothing and returning focus where it started is worth having.
 *
 * The awkward case is worth naming, because it is the one that will come up
 * again: **a modal that hides its own result has to report it.** The exercise
 * filter sits here — it covers the very list it is narrowing — so it carries a
 * live count of the matches. Without that it would be a control whose effect
 * you can only see by dismissing it.
 */
export function Dialog({ open, title, onClose, children, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;

    // Guarded both ways: calling `showModal()` on an open dialog throws.
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;

    // A native listener rather than React's `onClose`. The `close` event does
    // not bubble, so it never reaches the delegated listener React attaches at
    // the root, and the prop silently never fires. Without this the component
    // believes it is still open after Escape: the scroll lock stays on and
    // reopening does nothing, because `open` never went back to false.
    dialog.addEventListener("close", onClose);
    return () => {
      dialog.removeEventListener("close", onClose);
    };
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    // `showModal()` blocks interaction with the page but not scrolling of it,
    // so the background still slides around under the modal.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    // `closedby="any"` handles click-outside natively where it is supported.
    if (dialog === null || "closedBy" in HTMLDialogElement.prototype) return;

    function handleClick(event: MouseEvent) {
      if (dialog === null || event.target !== dialog) return;

      // The event target is the dialog itself both for backdrop clicks and for
      // clicks on the dialog's own padding, so compare against its box.
      const box = dialog.getBoundingClientRect();
      const inside =
        event.clientX >= box.left &&
        event.clientX <= box.right &&
        event.clientY >= box.top &&
        event.clientY <= box.bottom;

      if (!inside) dialog.close();
    }

    dialog.addEventListener("click", handleClick);
    return () => {
      dialog.removeEventListener("click", handleClick);
    };
  }, []);

  return (
    <dialog
      ref={ref}
      // Native light-dismiss: clicking the backdrop closes. The effect above
      // covers browsers that do not support it yet.
      closedby="any"
      aria-labelledby={titleId}
      className={cn(
        "m-auto w-[min(48rem,calc(100vw-2rem))] rounded-2xl border border-line",
        "bg-surface p-0 text-ink shadow-xl backdrop:backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="-m-1 flex size-8 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto overscroll-contain px-5 py-5">
        {children}
      </div>
    </dialog>
  );
}
