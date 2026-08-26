"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/design-system/cn";

import { useTheme } from "./theme-provider";
import type { ThemePreference } from "./theme";

const OPTIONS = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Escuro", Icon: Moon },
  { value: "system", label: "Sistema", Icon: Monitor },
] as const satisfies readonly {
  value: ThemePreference;
  label: string;
  Icon: typeof Sun;
}[];

/**
 * Built on native radio inputs rather than buttons with `aria-checked`.
 *
 * These are three mutually exclusive choices, which is exactly what a radio
 * group is. Using the real element means arrow-key navigation, roving focus
 * and screen-reader announcements all come from the browser — none of it is
 * custom keyboard code that can be subtly wrong.
 */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <fieldset className="inline-flex rounded-md border border-line bg-surface p-0.5">
      <legend className="sr-only">Tema</legend>

      {OPTIONS.map(({ value, label, Icon }) => (
        <label key={value} className="cursor-pointer">
          <input
            type="radio"
            name="theme"
            value={value}
            checked={preference === value}
            onChange={() => setPreference(value)}
            className="peer sr-only"
          />
          <span
            className={cn(
              "flex size-(--control-h-sm) items-center justify-center rounded-md text-ink-subtle",
              "transition-[background-color,color] duration-150 ease-out",
              "hover:text-ink",
              "peer-checked:bg-muted peer-checked:text-ink",
              "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
              "peer-focus-visible:outline-focus",
            )}
          >
            <Icon aria-hidden className="size-4" />
            <span className="sr-only">{label}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
