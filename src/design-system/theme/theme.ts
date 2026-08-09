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
 * `dark`, not `system`: this is a product decision, not a technical default.
 * The emerald identity was designed on a dark ground and is what the app is
 * supposed to look like the first time you see it — following the OS instead
 * means half the visitors meet a version nobody chose for them.
 *
 * Three places have to agree on this value — here, `getServerPreference`, and
 * the pre-hydration script. If they diverge the page paints one theme and
 * then swaps to the other.
 */
export const DEFAULT_THEME: ThemePreference = "dark";

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
