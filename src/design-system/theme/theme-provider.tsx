"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

import { resolveTheme, THEME_ATTRIBUTE, type ResolvedTheme, type ThemePreference } from "./theme";
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
  /** What is actually painted. */
  readonly resolved: ResolvedTheme;
  readonly setPreference: (preference: ThemePreference) => void;
}

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
    <ThemeContext value={{ preference, resolved, setPreference }}>
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
