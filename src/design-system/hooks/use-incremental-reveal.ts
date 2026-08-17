"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reveals a long list in pages, growing as a sentinel element scrolls into
 * view, instead of mounting every row up front.
 *
 * This is the fix for BUG-011: the exercise and food catalogues went from
 * capped (8 results in the food picker) or already-full (183 exercises, 216
 * foods) lists to catalogues that keep growing, and re-rendering all of them
 * on every keystroke of a live search is the actual cost someone pays for
 * that — not scrolling, typing. Capping how many rows exist in the DOM at
 * once caps that cost regardless of how large the catalogue gets.
 *
 * Deliberately not a windowed virtualiser that also unmounts rows scrolled
 * past: at these catalogue sizes (hundreds, not thousands) the list only
 * grows one page at a time and the browser handles a few hundred simple flex
 * rows without trouble once they exist — the expensive part was always
 * mounting them, not keeping them mounted. A windowed virtualiser earns its
 * complexity at an order of magnitude this app does not have.
 *
 * `resetKey` is a caller-computed string identifying the current query (text
 * plus filters). It exists because `total` and the underlying results array
 * are new every render regardless of whether the *query* changed — depending
 * on either directly would reset the revealed count on every keystroke's
 * re-render, defeating the point.
 */
/** No silent "stuck at page one forever" for a browser without the API. */
const SUPPORTS_INTERSECTION_OBSERVER = typeof IntersectionObserver !== "undefined";

export function useIncrementalReveal(
  resetKey: string,
  total: number,
  pageSize = 40,
): {
  readonly count: number;
  readonly hasMore: boolean;
  /** Attach to a sentinel element after the last rendered row. */
  readonly sentinelRef: React.RefCallback<Element>;
} {
  // A new query starts from the first page — growth earned by scrolling the
  // previous result set says nothing about how long the new one is. Reset
  // during render rather than in an effect: React's own pattern for
  // "adjusting state when a prop changes" without the extra render pass an
  // effect-based reset would otherwise cost.
  const [seenKey, setSeenKey] = useState(resetKey);
  const [count, setCount] = useState(pageSize);
  if (seenKey !== resetKey) {
    setSeenKey(resetKey);
    setCount(pageSize);
  }

  const sentinel = useRef<Element | null>(null);
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!SUPPORTS_INTERSECTION_OBSERVER) return;

    observer.current?.disconnect();
    if (sentinel.current === null) return;

    // `rootMargin` grows the page before the sentinel is actually on screen,
    // so scrolling never outruns the reveal and shows a visible gap.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting === true) {
          setCount((current) => Math.min(current + pageSize, total));
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(sentinel.current);
    observer.current = io;

    return () => {
      io.disconnect();
    };
  }, [count, total, pageSize]);

  const effectiveCount = SUPPORTS_INTERSECTION_OBSERVER
    ? Math.min(count, total)
    : total;

  return {
    count: effectiveCount,
    hasMore: effectiveCount < total,
    sentinelRef: (node) => {
      sentinel.current = node;
    },
  };
}
