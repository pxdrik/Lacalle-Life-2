"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);

  return () => {
    media.removeEventListener("change", onChange);
  };
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Whether the person asked their system to reduce motion.
 *
 * `globals.css` already neutralises CSS animation for them. This hook is for
 * the motion CSS cannot see: anything a timer drives, where the movement is a
 * component swapping what it renders rather than the browser interpolating a
 * property.
 *
 * `useSyncExternalStore` because `matchMedia` is exactly that — state that
 * lives outside React and changes without asking.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
