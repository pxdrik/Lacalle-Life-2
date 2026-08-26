/**
 * Button density, as pure functions — the same shape as `theme.ts`, and for
 * the same reason: the pre-hydration script, the provider and the tests all
 * need the identical rule, and the only way they cannot drift apart is one
 * implementation shared by all three.
 *
 * Scoped to buttons on purpose. `--input-h` stays fixed at 44 px regardless —
 * the brandbook is explicit that inputs do not vary — and card padding is
 * already a breakpoint-driven density axis of its own. This is a second,
 * personal axis layered on top of the brand system's own control heights,
 * not a replacement for them.
 */

export const DENSITY_STORAGE_KEY = "lacalle-life.density";
export const DENSITY_ATTRIBUTE = "data-density";

export type Density = "compact" | "default" | "comfortable";

export const DENSITIES: readonly Density[] = [
  "compact",
  "default",
  "comfortable",
];

/**
 * `default` matches the brand system's own page-25 values untouched — this
 * preference only ever narrows or widens around that baseline, never
 * replaces it as the thing every other choice is measured against.
 */
export const DEFAULT_DENSITY: Density = "default";

/**
 * Storage is user-writable and survives across app versions, so anything read
 * from it is untrusted input. An unrecognised value falls back to the
 * default rather than throwing — the same reasoning `parseThemePreference`
 * documents.
 */
export function parseDensity(value: unknown): Density {
  return DENSITIES.includes(value as Density)
    ? (value as Density)
    : DEFAULT_DENSITY;
}

/**
 * The breakpoint above which a screen counts as "desktop" for the density
 * default — the same one the sidebar itself switches on
 * (`lg:pl-(--sidebar-w)` in the root layout), so "desktop" means the same
 * thing here as it does to the rest of the shell.
 */
export const DESKTOP_DENSITY_BREAKPOINT_PX = 1024;

/**
 * What density starts on, before anyone has chosen one — a function of
 * screen width rather than one fixed constant. A phone screen keeps
 * `default`; a desktop screen this wide already has the room `comfortable`
 * asks for, and starting cramped there was never the point of `default`
 * being the conservative choice (Pedro, 26/08/2026). Only the *default*
 * moves with the screen — an explicit choice, once made, is read from
 * storage and never overridden by this.
 */
export function defaultDensityForWidth(widthPx: number): Density {
  return widthPx >= DESKTOP_DENSITY_BREAKPOINT_PX ? "comfortable" : DEFAULT_DENSITY;
}
