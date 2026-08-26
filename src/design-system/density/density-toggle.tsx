"use client";

import { cn } from "@/design-system/cn";

import { useDensity } from "./density-provider";
import type { Density } from "./density";

const OPTIONS: readonly { value: Density; label: string }[] = [
  { value: "compact", label: "Compacto" },
  { value: "default", label: "Padrão" },
  { value: "comfortable", label: "Confortável" },
];

/**
 * Three named stops rather than a literal `<input type="range">`.
 *
 * A range slider has no good way to announce "Compacto" versus a bare
 * number to a screen reader without extra wiring, and three fixed positions
 * gain nothing from being draggable — the value people asked for was more
 * than two choices, not a continuous scale. Built on native radios, so
 * arrow-key navigation and roving focus come from the browser instead of
 * custom keyboard code that can be subtly wrong.
 *
 * `ThemeToggle` used to share this exact shape — three radios, Claro/
 * Escuro/Sistema — before it was cut down to a single two-state button.
 * This one stays a 3-way picker: unlike light/dark, "quanto maior" has no
 * natural opposite to collapse into a toggle.
 */
export function DensityToggle() {
  const { density, setDensity } = useDensity();

  return (
    <fieldset className="inline-flex rounded-md border border-line bg-surface p-0.5">
      <legend className="sr-only">Tamanho dos botões</legend>

      {OPTIONS.map(({ value, label }) => (
        <label key={value} className="cursor-pointer">
          <input
            type="radio"
            name="density"
            value={value}
            checked={density === value}
            onChange={() => {
              setDensity(value);
            }}
            className="peer sr-only"
          />
          <span
            className={cn(
              "flex h-(--control-h-sm) items-center justify-center rounded-md px-3 text-xs text-ink-subtle",
              "transition-[background-color,color] duration-150 ease-out",
              "hover:text-ink",
              "peer-checked:bg-muted peer-checked:text-ink peer-checked:font-medium",
              "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
              "peer-focus-visible:outline-focus",
            )}
          >
            {label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
