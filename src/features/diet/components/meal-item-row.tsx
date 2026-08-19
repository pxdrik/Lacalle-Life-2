"use client";

import { GripVertical, X } from "lucide-react";
import { useState } from "react";

import { formatDecimal, parseDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";
import { MACRO_CODING } from "@/design-system/macros";
import { Select } from "@/design-system/components/select";

import { itemMacros } from "../services/diet-macros";
import type { MealItem } from "../types/diet";

interface Props {
  readonly item: MealItem;
  readonly dragHandle: {
    readonly attributes: React.HTMLAttributes<HTMLElement>;
    readonly listeners: Record<string, unknown> | undefined;
    readonly isDragging: boolean;
  };
  readonly otherMeals: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  readonly onGramsChange: (grams: number) => void;
  readonly onUnitChange: (unit: MealItem["unit"]) => void;
  readonly onRemove: () => void;
  readonly onSend: (targetMealId: string, mode: "copy" | "move") => void;
}

/**
 * One food inside a meal.
 *
 * Grams are a live input rather than something behind an edit affordance —
 * adjusting a portion is the single most repeated action in building a diet,
 * and the macros beside it move as you type.
 */
export function MealItemRow({
  item,
  dragHandle,
  otherMeals,
  onGramsChange,
  onUnitChange,
  onRemove,
  onSend,
}: Props) {
  const macros = itemMacros(item);

  return (
    <li
      className={cn(
        // Wraps on a phone: seven controls in one line need ~290px and a
        // 360px screen leaves the row about 250, so it used to run off the
        // card. Below `sm` the portion stays with the name and the numbers
        // take a second line.
        "group flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 sm:flex-nowrap sm:gap-2",
        dragHandle.isDragging && "rounded-sm bg-muted",
      )}
    >
      {/* Only within a meal, and only by dragging: the order of foods inside a
          meal is cosmetic, and two arrow buttons per row would cost more than
          the reordering is worth. The keyboard sensor still covers it. */}
      <button
        type="button"
        aria-label={`Reordenar ${item.name}`}
        {...dragHandle.attributes}
        {...dragHandle.listeners}
        className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center touch-44 rounded-md text-ink-subtle/60 transition-colors duration-150 ease-out hover:text-ink active:cursor-grabbing"
      >
        <GripVertical aria-hidden className="size-3.5" />
      </button>

      <span className="min-w-0 flex-1 truncate text-sm text-ink">
        {item.name}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <GramsField
          grams={item.grams}
          label={`Quantidade de ${item.name}`}
          onChange={onGramsChange}
        />
        {/* g e ml só trocam o rótulo — 1 ml ≈ 1 g é a aproximação, não uma
            segunda grandeza. Não existe "1 unidade" aqui porque nenhuma
            fonte deste app (catálogo, TACO) carrega peso por unidade; um
            valor inventado seria pior que a pergunta ficar sem resposta. */}
        <Select
          variant="compact"
          value={item.unit}
          aria-label={`Unidade de ${item.name}`}
          onChange={(event) => {
            onUnitChange(event.target.value === "ml" ? "ml" : "g");
          }}
        >
          <option value="g">g</option>
          <option value="ml">ml</option>
        </Select>
      </div>

      {/* Forces the wrap here and nowhere else. A zero-height item with a
          full-width basis cannot share a line, so everything after it lands on
          the second row together — the alternative is letting flex choose, and
          flex breaks wherever the longest name happens to leave off. */}
      <div aria-hidden className="basis-full sm:hidden" />

      {/* `ms-auto` pins the numbers to the right edge of the wrapped line, so
          they stay in a column across items instead of drifting with the
          width of each name. */}
      <div className="ms-auto flex w-40 shrink-0 items-baseline justify-end gap-3 text-xs tabular-nums sm:w-48 sm:gap-4">
        <span className="text-ink-muted">{formatDecimal(macros.kcal)}</span>
        {MACRO_CODING.map(({ key, text }) => (
          <span key={key} className={text}>
            {formatDecimal(macros[key])}
          </span>
        ))}
      </div>

      {/* A native select rather than a custom menu: it is keyboard operable,
          it opens the OS picker on a phone, and it costs one control instead
          of two buttons on an already dense row. Hidden when there is nowhere
          to send the food. */}
      {otherMeals.length > 0 && (
        <Select
          variant="compact"
          value=""
          aria-label={`Mover ou copiar ${item.name} para outra refeição`}
          onChange={(event) => {
            const [mode, mealId] = event.target.value.split(":");
            if (mode === undefined || mealId === undefined) return;
            onSend(mealId, mode === "copy" ? "copy" : "move");
          }}
          className="shrink-0"
        >
          <option value="">⋯</option>
          <optgroup label="Mover para">
            {otherMeals.map((meal) => (
              <option key={`move:${meal.id}`} value={`move:${meal.id}`}>
                {meal.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Copiar para">
            {otherMeals.map((meal) => (
              <option key={`copy:${meal.id}`} value={`copy:${meal.id}`}>
                {meal.name}
              </option>
            ))}
          </optgroup>
        </Select>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover ${item.name}`}
        className="flex size-7 shrink-0 items-center justify-center touch-44 rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-danger/10 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </li>
  );
}

/** Guards against a pasted number so long it stops being a number. */
const MAX_GRAMS = 100_000;

/**
 * A portion you can actually type.
 *
 * The field used to strip every non-digit — `input.replace(/\D/g, "")` — which
 * kept it non-negative and, in the same stroke, deleted the decimal separator.
 * **"12,5" was stored as 125**: ten times the portion, on the most repeated
 * action the app has, propagated to the meal total, the day total, the ring
 * and the comparison against the target. Nothing looked wrong, because 125 is
 * a perfectly ordinary number of grams.
 *
 * Parsing alone does not fix it. With the value coming straight back from the
 * stored number, typing "12," parses to 12, re-renders as "12", and the
 * separator is gone before the next digit lands — which is the same failure
 * again by a different route. So the text being typed is held apart from the
 * number it means.
 *
 * **This is the second copy of that technique.** `WeightField` in the workout
 * feature exists for the identical bug — tapping 6·2·,·5 recorded 625 kg — and
 * sharing the two means lifting a workouts component into the design system,
 * which is a refactor this change is not allowed to make. Recorded here rather
 * than left to be discovered.
 */
function GramsField({
  grams,
  label,
  onChange,
}: {
  readonly grams: number;
  readonly label: string;
  readonly onChange: (grams: number) => void;
}) {
  const [draft, setDraft] = useState(() => text(grams));
  const [seen, setSeen] = useState(grams);

  // Adjusting state during render — React's documented alternative to an
  // effect. The guard is what lets a comma survive: after typing "12,5" the
  // value comes back as 12.5, which the draft already means, so the text is
  // left exactly as typed. A change from elsewhere replaces it.
  if (seen !== grams) {
    setSeen(grams);
    if (parseDecimal(draft) !== grams) setDraft(text(grams));
  }

  return (
    <input
      type="text"
      // `decimal` and not `numeric`: on a phone this is the difference between
      // a keypad that offers a comma and one that does not.
      inputMode="decimal"
      value={draft}
      aria-label={label}
      placeholder="0"
      onChange={(event) => {
        const next = readGrams(event.target.value);
        setDraft(next.text);
        onChange(next.grams);
      }}
      className="w-14 rounded-md border border-line bg-surface px-2 py-1 text-right text-sm tabular-nums transition-colors duration-150 ease-out hover:border-line-strong"
    />
  );
}

/**
 * What may be typed into a portion: digits and one separator, nothing else.
 *
 * **Refusing at entry is the old behaviour and it was right** — a portion is a
 * physical quantity and a minus sign has no meaning in it. What was wrong was
 * the separator being thrown out with the sign.
 *
 * Returns the text as well as the number, because the two must not disagree:
 * clamping the value while leaving the field showing what was typed is the
 * screen saying one thing and the store holding another.
 */
function readGrams(input: string): {
  readonly text: string;
  readonly grams: number;
} {
  const kept = input.replace(/[^\d,.]/g, "");
  const [whole = "", ...rest] = kept.split(/[.,]/);
  const text = rest.length === 0 ? whole : `${whole},${rest.join("")}`;

  const value = parseDecimal(text);
  // A lone separator, or nothing: no number yet, and the draft keeps what was
  // typed so the next keystroke has something to land on.
  if (value === null) return { text, grams: 0 };

  if (value > MAX_GRAMS) return { text: String(MAX_GRAMS), grams: MAX_GRAMS };

  return { text, grams: value };
}

/**
 * A comma, like everywhere else in the app — and written by hand rather than
 * with `formatDecimal`, which also groups thousands: "1.000" would come back
 * through `parseDecimal` as 1.
 *
 * Zero shows the placeholder instead of a digit, which is what the field did
 * before and is right: a portion nobody has set yet is blank, not `0 g`.
 */
function text(grams: number): string {
  return grams === 0 ? "" : String(grams).replace(".", ",");
}
