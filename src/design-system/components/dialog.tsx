"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { cn } from "../cn";

/**
 * Where the dialog is anchored, and it is the only thing that varies.
 *
 * `center` is the modal. `sheet-bottom` rises from the bottom edge — the "Mais"
 * navigation on a phone — and `sheet-left` is the drawer that page 31 turns the
 * sidebar into below 1024 px.
 *
 * These were className overrides passed in by callers, which is how the bottom
 * sheet came to hand-write `m-0 mt-auto w-full max-w-none rounded-t-lg
 * rounded-b-none border-x-0 border-b-0` at the call site. The second sheet was
 * about to copy it.
 */
type Placement = "center" | "sheet-bottom" | "sheet-left";

/**
 * The radii come from the nesting rule on page 23: a modal is a container, so
 * 20 px, and a sheet that meets an edge of the screen is a large surface, so 24
 * — and only on the corners that are not touching.
 */
const PLACEMENT: Record<Placement, string> = {
  center: "m-auto w-[min(48rem,calc(100vw-2rem))] rounded-xl border",
  "sheet-bottom":
    "m-0 mt-auto w-full max-w-none rounded-t-2xl border-t sm:mx-auto sm:w-[min(32rem,100vw)]",
  "sheet-left":
    "m-0 mr-auto h-full max-h-none w-(--sidebar-w) rounded-r-2xl border-r",
};

/** A drawer owns the height of the screen; a modal is capped so the page shows. */
const BODY: Record<Placement, string> = {
  center: "max-h-[70vh]",
  "sheet-bottom": "max-h-[70vh]",
  "sheet-left": "flex-1",
};

interface Props {
  readonly open: boolean;
  /** Names the dialog for assistive technology, and is shown as its heading. */
  readonly title: string;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
  readonly placement?: Placement;
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
export function Dialog({
  open,
  title,
  onClose,
  children,
  placement = "center",
  className,
}: Props) {
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
        // `flex-col` so a drawer's body can take the height the header leaves.
        "flex-col border-line bg-surface p-0 text-ink shadow-modal",
        // `open:flex` and not `flex`: a `<dialog>` that is not open is
        // `display: none`, and a flex display here would override that and
        // paint the panel over the page permanently.
        "open:flex",
        PLACEMENT[placement],
        className,
      )}
    >
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="-m-1 flex size-8 shrink-0 items-center justify-center touch-44 rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <div
        className={cn(
          "overflow-y-auto overscroll-contain px-5 py-5",
          BODY[placement],
        )}
      >
        {children}
      </div>
    </dialog>
  );
}
