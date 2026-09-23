"use client";

import { GripVertical } from "lucide-react";

import { cn } from "../cn";
import { Dialog } from "./dialog";
import { SortableItem, SortableList } from "./sortable-list";

export interface ReorderSheetItem {
  readonly id: string;
  readonly label: string;
  /** Small, secondary text under the label — a portion, a set count. */
  readonly detail?: string | undefined;
}

interface Props {
  readonly open: boolean;
  readonly title: string;
  readonly items: readonly ReorderSheetItem[];
  readonly onReorder: (activeId: string, overId: string) => void;
  readonly onClose: () => void;
}

/**
 * The focused list a long press opens — RM01/RM03 (roadmap 23/09/2026):
 * name and a grip, nothing else, so dragging reads as the one thing this
 * screen is for. Reused by the Diário (refeições do dia, alimentos de uma
 * refeição) and pelos Treinos (exercícios de uma rotina) instead of three
 * near-identical sheets — `SortableList` already carries the keyboard
 * sensor and the accessible drag announcements, so this is the whole cost
 * of a third reorderable list, not a fourth implementation of one.
 *
 * Never the only way to reorder in the screens that open this: the normal
 * card still has its own "Mover para cima/baixo" (Diário, atrás do ⋮) or
 * visible arrows (Treinos) — this sheet is the *fast* way to move several
 * things at once, not a replacement for either.
 */
export function ReorderSheet({ open, title, items, onReorder, onClose }: Props) {
  return (
    <Dialog open={open} title={title} onClose={onClose} placement="sheet-bottom">
      {items.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-ink-subtle">
          Nada para reordenar.
        </p>
      ) : (
        <SortableList
          ids={items.map((item) => item.id)}
          describe={(id) => items.find((item) => item.id === id)?.label ?? ""}
          onReorder={onReorder}
        >
          <ul className="-my-1 divide-y divide-line">
            {items.map((item) => (
              <SortableItem key={item.id} id={item.id}>
                {(handle) => (
                  <li
                    className={cn(
                      "flex items-center gap-2 py-1",
                      handle.isDragging && "rounded-sm bg-muted",
                    )}
                  >
                    <button
                      type="button"
                      aria-label={`Reordenar ${item.label}`}
                      {...handle.attributes}
                      {...handle.listeners}
                      className="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center touch-44 rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:text-ink active:cursor-grabbing"
                    >
                      <GripVertical aria-hidden className="size-4" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{item.label}</p>
                      {item.detail !== undefined && (
                        <p className="truncate text-xs text-ink-subtle">
                          {item.detail}
                        </p>
                      )}
                    </div>
                  </li>
                )}
              </SortableItem>
            ))}
          </ul>
        </SortableList>
      )}
    </Dialog>
  );
}
