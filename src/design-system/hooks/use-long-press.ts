"use client";

import { useRef, useState } from "react";

/** ~2 s, per RM01/RM03 (roadmap 23/09/2026) — long enough that a normal tap, or a scroll that starts on the card, never fires it by accident. */
const DEFAULT_DURATION_MS = 2000;

/** A scroll or a drag disguised as a hold cancels it — the same 8 px `SortableList` already waits before it starts a drag. */
const MOVE_THRESHOLD_PX = 8;

export interface LongPressProps {
  readonly onPointerDown: (event: React.PointerEvent) => void;
  readonly onPointerMove: (event: React.PointerEvent) => void;
  readonly onPointerUp: (event: React.PointerEvent) => void;
  readonly onPointerCancel: (event: React.PointerEvent) => void;
  readonly onPointerLeave: (event: React.PointerEvent) => void;
  readonly onContextMenu: (event: React.MouseEvent) => void;
}

/**
 * Holding a card open a secondary interaction — RM01/RM03's "long press",
 * the one primitive neither roadmap item found anywhere in the app already
 * (checked: no `onLongPress`/`longPress` anywhere in `src/` before this).
 *
 * Pointer Events, not separate touch/mouse handlers: one code path for
 * finger, mouse and pen. `input`/`textarea`/`select` are excluded at the
 * source — holding a text field is how a phone lets someone position a
 * cursor or select text, and stealing that gesture would break the one
 * field most rows actually have (`GramsField`, the notes field).
 *
 * Cancels on movement past `MOVE_THRESHOLD_PX` so starting a page scroll on
 * top of a card, or a drag inside a *different* sortable context, never
 * also fires this — the same guard `SortableList`'s `PointerSensor` uses
 * for the same reason, applied here because this hook has no `DndContext`
 * to lean on.
 *
 * `isPressing` is exposed only for a subtle visual cue while holding
 * (`bg-muted`, the same tint `dragHandle.isDragging` already uses) — never
 * required, and no timer runs while `disabled` is true.
 */
export function useLongPress(
  onLongPress: () => void,
  options: {
    readonly duration?: number | undefined;
    readonly disabled?: boolean | undefined;
  } = {},
): LongPressProps & { readonly isPressing: boolean } {
  const duration = options.duration ?? DEFAULT_DURATION_MS;
  const disabled = options.disabled ?? false;

  const [isPressing, setIsPressing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originRef = useRef<{ readonly x: number; readonly y: number } | null>(
    null,
  );
  const firedRef = useRef(false);

  function clear() {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
    originRef.current = null;
    setIsPressing(false);
  }

  function onPointerDown(event: React.PointerEvent) {
    if (disabled) return;
    // Right-click/secondary button only, on a mouse — a real long press has
    // no "button" concept on touch or pen, where this is always 0.
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (
      (event.target as HTMLElement).closest("input, textarea, select") !==
      null
    ) {
      return;
    }

    firedRef.current = false;
    originRef.current = { x: event.clientX, y: event.clientY };
    setIsPressing(true);
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      clear();
      onLongPress();
    }, duration);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (originRef.current === null) return;
    const dx = event.clientX - originRef.current.x;
    const dy = event.clientY - originRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_THRESHOLD_PX) clear();
  }

  function onContextMenu(event: React.MouseEvent) {
    // Suppresses the native callout (text-select popup on iOS, right-click
    // menu on desktop) exactly when it would otherwise land on top of the
    // sheet this hold just opened.
    if (firedRef.current) event.preventDefault();
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onContextMenu,
    isPressing,
  };
}
