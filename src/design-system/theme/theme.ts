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
 * The theme somebody gets before they have chosen one.
 *
 * `light`, not `system`: this is a product decision, not a technical default.
 * It was `dark` until 29/09/2026, when Pedro made light the main theme and
 * dark the option: prototyping the professional area showed that near-black
 * with a single bright green is what read as "made by AI", and the same
 * screens on the light ground did not. Following the OS instead would still
 * mean half the visitors meet a version nobody chose for them.
 *
 * Three places have to agree on this value — here, `getServerPreference`, and
 * the pre-hydration script. If they diverge the page paints one theme and
 * then swaps to the other.
 */
export const DEFAULT_THEME: ThemePreference = "light";

/**
 * Storage is user-writable and survives across app versions, so anything read
 * from it is untrusted input. An unrecognised value falls back to the default
 * rather than throwing — a corrupt preference must never cost someone their
 * app.
 */
export function parseThemePreference(value: unknown): ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference)
    ? (value as ThemePreference)
    : DEFAULT_THEME;
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}
