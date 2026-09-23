"use client";

import { useEffect, useState } from "react";

import { Mark } from "@/design-system/brand/signature";
import { cn } from "@/design-system/cn";

import { useReducedMotion } from "../hooks/use-reduced-motion";

type Phase = "start" | "in" | "out" | "done";

/** Matches the timing LaCalle Finance already validated for the same reveal. */
const EXPAND_MS = 1000;
const HOLD_MS = 250;
const COLLAPSE_MS = Math.round(EXPAND_MS * 0.7);

/**
 * Covers the white flash between the raw HTML paint and the interface being
 * ready — RM02.09 (roadmap 23/09/2026): "uma tela branca ofuscante aparece,
 * o que quebra a estética premium do sistema."
 *
 * **Not the rejected page-to-page LaCalle Reveal** documented in
 * `page-transition.tsx` — that one needed `<ViewTransition>` to cross-fade
 * between two already-rendered trees and was shelved because this React
 * build does not export it. This is a single one-shot overlay animating its
 * *own* `clip-path`, plain CSS, no dependency on that API at all — the same
 * mechanism LaCalle Finance already ships (`LaCalleReveal` in
 * `Finance/src/components/ui.jsx`), ported rather than reinvented.
 *
 * Mounted once, in the root layout, outside every route's own tree. Next.js
 * layouts do not remount on client-side navigation, so this naturally shows
 * exactly once per real page load (cold open or hard refresh) — the "no
 * mais de uma vez por sessão" rule Finance enforces with a `sessionStorage`
 * flag falls out for free here, nothing to track by hand.
 *
 * Circle expands to cover the screen, holds, then collapses to reveal the
 * app underneath — never gates rendering (the page behind it loads exactly
 * as it always did), it only sits on top for the ~2 s a cold boot already
 * takes to feel intentional instead of broken.
 */
export function BootSplash() {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("start");

  useEffect(() => {
    if (reducedMotion) {
      const outTimer = setTimeout(() => {
        setPhase("out");
      }, 10);
      const doneTimer = setTimeout(() => {
        setPhase("done");
      }, 130);

      return () => {
        clearTimeout(outTimer);
        clearTimeout(doneTimer);
      };
    }

    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setPhase("in");
      });
    });

    // The expansion finishes covering the screen fully before it starts
    // collapsing — cutting it short mid-grow (what an earlier version of
    // this same reveal did in Finance) reads as barely appearing on a
    // phone, where the same clip-path percentage covers more screen faster.
    const outTimer = setTimeout(() => {
      setPhase("out");
    }, EXPAND_MS + HOLD_MS);
    const doneTimer = setTimeout(() => {
      setPhase("done");
    }, EXPAND_MS + HOLD_MS + COLLAPSE_MS + 40);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(outTimer);
      clearTimeout(doneTimer);
    };
  }, [reducedMotion]);

  if (phase === "done") return null;

  if (reducedMotion) {
    return (
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-0 z-[60] bg-[#0a0a0a] transition-opacity duration-[120ms] ease-linear",
          phase === "out" ? "opacity-0" : "opacity-100",
        )}
      />
    );
  }

  // Covering from the very first frame ("start"), not only once "in" fires a
  // couple of rAFs later — the whole point is zero gap where the overlay
  // could be anything less than fully opaque. Matches Finance's own
  // `LaCalleReveal`: only "out" ever un-covers; "in" is purely what unlocks
  // the CSS transition below (`transition: none` while `phase === "start"`,
  // so this same clip value renders instantly, with nothing to animate from).
  const covering = phase !== "out";

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-[#0a0a0a]"
      style={{
        clipPath: covering ? "circle(75% at 50% 50%)" : "circle(0% at 50% 50%)",
        transition:
          phase === "start"
            ? "none"
            : `clip-path ${String(phase === "out" ? COLLAPSE_MS : EXPAND_MS)}ms var(--ease-out)`,
      }}
    >
      <div
        className={cn(
          "transition-[opacity,transform] duration-200 ease-out",
          phase === "out" ? "scale-90 opacity-0" : "scale-100 opacity-100",
        )}
      >
        <Mark className="h-16 w-auto text-white" title="LaCalle Life" />
      </div>
    </div>
  );
}
