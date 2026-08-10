"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";

import { resolveTheme, THEME_ATTRIBUTE, type ThemePreference } from "./theme";
import {
  getPreference,
  getServerPreference,
  getServerSystemPrefersDark,
  getSystemPrefersDark,
  setPreference,
  subscribeToPreference,
  subscribeToSystemScheme,
} from "./theme-store";

interface ThemeContextValue {
  /** What the user chose, which may be `system`. */
  readonly preference: ThemePreference;
  readonly setPreference: (preference: ThemePreference) => void;
}

/**
 * The resolved theme is computed here but deliberately not exposed. Nothing
 * needs to branch on it yet — the tokens do that work in CSS — and an unused
 * context field is API surface that has to be kept correct for no one.
 */

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const preference = useSyncExternalStore(
    subscribeToPreference,
    getPreference,
    getServerPreference,
  );

  const systemPrefersDark = useSyncExternalStore(
    subscribeToSystemScheme,
    getSystemPrefersDark,
    getServerSystemPrefersDark,
  );

  const resolved = resolveTheme(preference, systemPrefersDark);

  /**
   * The one legitimate effect here: pushing React's state out to the document,
   * which is an external system. Nothing sets React state in response.
   *
   * `<html>` already carries the right value from the pre-hydration script, so
   * on first mount this writes what is already there.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute(THEME_ATTRIBUTE, resolved);
    root.style.colorScheme = resolved;
  }, [resolved]);

  return (
    <ThemeContext value={{ preference, setPreference }}>
      {children}
    </ThemeContext>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error("useTheme must be used within a ThemeProvider.");
  }
  return value;
}
