/**
 * Theme resolution, as pure functions.
 *
 * Deliberately free of React and of the DOM: the same rules run in three
 * places — the pre-hydration script, the provider, and the tests — and the
 * only way they cannot drift apart is if there is one implementation.
 */

export const THEME_STORAGE_KEY = "lacalle-life.theme";
export const THEME_ATTRIBUTE = "data-theme";

/** What the user chose. `system` defers to the OS. */
export type ThemePreference = "light" | "dark" | "system";

/** What is actually painted. Never `system`. */
export type ResolvedTheme = "light" | "dark";

export const THEME_PREFERENCES: readonly ThemePreference[] = [
  "light",
  "dark",
  "system",
];

/**
 * Storage is user-writable and survives across app versions, so anything read
 * from it is untrusted input. An unrecognised value falls back to `system`
 * rather than throwing — a corrupt preference must never cost someone their
 * app.
 */
export function parseThemePreference(value: unknown): ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference)
    ? (value as ThemePreference)
    : "system";
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}
