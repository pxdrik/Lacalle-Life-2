"use client";

import { useState } from "react";

/**
 * "Delete/Collapse" — an item shrinks before it disappears, instead of the
 * list cutting straight to a shorter version of itself the instant a tap
 * lands. Found as a real gap by the Motion System audit of 12/09/2026,
 * repeated across every list that removes something (refeição, exercício,
 * série, alimento) — one hook instead of four copies of the same two-phase
 * dance.
 *
 * **Two phases, because the real removal has to wait for the shrink to
 * finish.** Call `requestRemove()` from the delete control instead of the
 * mutation directly; spread `collapseProps` onto the element that should
 * shrink. `onRemove` only fires once the CSS transition actually completes
 * — never a `setTimeout` guess, which would drift the moment a caller's
 * className changed the duration, or the moment `prefers-reduced-motion`
 * capped it to 120ms globally (`globals.css`) and a hand-timed guess kept
 * waiting for the original, longer number.
 *
 * **The CSS-grid collapse, not a measured height.** `collapseProps` sets
 * `grid-template-rows` to `1fr`/`0fr` — an element whose one child sits in
 * a track that animates shut, clipped by `overflow: hidden` on that child.
 * No `ref`, no `scrollHeight`, no layout read before the state that decides
 * it: any row's real height, whatever it is, collapses correctly.
 */
export function useCollapsibleRemove(onRemove: () => void): {
  readonly collapsed: boolean;
  /** Starts the shrink. The actual removal follows once it finishes. */
  readonly requestRemove: () => void;
  readonly collapseProps: {
    readonly style: { readonly gridTemplateRows: "1fr" | "0fr" };
    readonly onTransitionEnd: (event: {
      readonly propertyName: string;
    }) => void;
  };
} {
  const [collapsed, setCollapsed] = useState(false);

  return {
    collapsed,
    requestRemove: () => {
      setCollapsed(true);
    },
    collapseProps: {
      style: { gridTemplateRows: collapsed ? "0fr" : "1fr" },
      onTransitionEnd: (event) => {
        if (collapsed && event.propertyName === "grid-template-rows") {
          onRemove();
        }
      },
    },
  };
}
