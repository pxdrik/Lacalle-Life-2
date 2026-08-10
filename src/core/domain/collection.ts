/**
 * Pure array helpers for ordered collections.
 *
 * Reordering shows up in three features and would otherwise be reimplemented
 * three times, each with its own off-by-one.
 */

/** Moves the item at `from` to `to`, without mutating the input. */
export function moveItem<T>(
  items: readonly T[],
  from: number,
  to: number,
): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);

  if (moved === undefined) return next;
  next.splice(to, 0, moved);

  return next;
}

/**
 * Reorders so that `activeId` lands where `overId` is — the shape a drag
 * reports, since a pointer knows what it was dropped onto and not which index
 * that is.
 *
 * Returns the same reference when nothing moves, so callers can skip a write.
 */
export function reorderById<T extends { readonly id: string }>(
  items: readonly T[],
  activeId: string,
  overId: string,
): readonly T[] {
  if (activeId === overId) return items;

  const from = items.findIndex((item) => item.id === activeId);
  const to = items.findIndex((item) => item.id === overId);
  if (from === -1 || to === -1) return items;

  return moveItem(items, from, to);
}

/**
 * Shifts an item by `offset`, clamped to the ends — the shape a button
 * reports. Returns the same reference at the edges.
 */
export function shiftById<T extends { readonly id: string }>(
  items: readonly T[],
  id: string,
  offset: number,
): readonly T[] {
  const from = items.findIndex((item) => item.id === id);
  if (from === -1) return items;

  const to = Math.min(Math.max(from + offset, 0), items.length - 1);
  if (to === from) return items;

  return moveItem(items, from, to);
}
