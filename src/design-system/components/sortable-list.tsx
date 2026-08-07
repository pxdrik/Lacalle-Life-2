"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props {
  readonly ids: readonly string[];
  readonly onReorder: (activeId: string, overId: string) => void;
  /** How each item names itself when announced. */
  readonly describe: (id: string) => string;
  readonly children: React.ReactNode;
}

/**
 * Drag to reorder, as an accelerator.
 *
 * Never the only way. Where order matters — meals in a diet, exercises in a
 * routine — buttons stay alongside, because dragging a card with one thumb on
 * a phone at the gym is a worse interaction than tapping an arrow, and because
 * a pointer-only affordance strands anyone who is not using a pointer.
 *
 * The keyboard sensor makes the drag itself operable: tab to the handle, space
 * to lift, arrows to move, space to drop. `PointerSensor` waits for 8 px of
 * movement so a tap on a handle inside a card full of inputs is still a tap.
 */
export function SortableList({ ids, onReorder, describe, children }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over === null || active.id === over.id) return;

    onReorder(String(active.id), String(over.id));
  }

  const position = (id: string) => ids.indexOf(id) + 1;

  /**
   * dnd-kit announces in English by default. A screen reader reading "Draggable
   * item was moved" in the middle of a Portuguese app is worse than silence.
   */
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Pegou ${describe(String(active.id))}. Posição ${String(position(String(active.id)))} de ${String(ids.length)}.`,
    onDragOver: ({ active, over }) =>
      over === null
        ? undefined
        : `${describe(String(active.id))} sobre a posição ${String(position(String(over.id)))} de ${String(ids.length)}.`,
    onDragEnd: ({ active, over }) =>
      over === null
        ? `Soltou ${describe(String(active.id))}. Nada mudou.`
        : `Soltou ${describe(String(active.id))} na posição ${String(position(String(over.id)))} de ${String(ids.length)}.`,
    onDragCancel: ({ active }) =>
      `Movimento cancelado. ${describe(String(active.id))} voltou ao lugar.`,
  };

  const instructions: ScreenReaderInstructions = {
    draggable:
      "Pressione espaço para pegar. Use as setas para mover, espaço para soltar e escape para cancelar.",
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      accessibility={{ announcements, screenReaderInstructions: instructions }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={[...ids]} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/**
 * Wraps one item and hands its child the props for a drag handle.
 *
 * A handle rather than the whole card: these cards are full of inputs, and
 * making the card itself draggable would turn every attempt to select text in
 * a weight field into a drag.
 */
export function SortableItem({
  id,
  children,
}: {
  readonly id: string;
  readonly children: (handle: {
    readonly attributes: React.HTMLAttributes<HTMLElement>;
    readonly listeners: Record<string, unknown> | undefined;
    readonly isDragging: boolean;
  }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // Lifted above its neighbours while moving, so the shadow of the card
        // being dragged is not clipped by the one after it.
        zIndex: isDragging ? 10 : undefined,
        position: isDragging ? "relative" : undefined,
      }}
    >
      {children({ attributes, listeners, isDragging })}
    </div>
  );
}
