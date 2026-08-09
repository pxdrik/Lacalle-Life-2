import {
  DEFAULT_THEME,
  parseThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "./theme";

/**
 * The theme preference and the OS colour scheme are external stores, not
 * React state — they live in `localStorage` and in `matchMedia`, they change
 * without React's involvement, and another tab can change one of them.
 *
 * Modelling them as such (rather than mirroring them into `useState` inside
 * an effect) keeps the provider free of cascading renders, and gives
 * cross-tab synchronisation for nothing: the `storage` event fires in every
 * *other* tab, and the local notification covers this one.
 */

const DARK_QUERY = "(prefers-color-scheme: dark)";

const listeners = new Set<() => void>();

/**
 * In-memory source of truth, hydrated from storage on first read.
 *
 * It is not just a cache. When a browser blocks storage the write below
 * throws, and without this the app would re-read the old value and the user's
 * choice would silently do nothing.
 */
let current: ThemePreference | undefined;

function notify(): void {
  for (const listener of listeners) listener();
}

function handleStorage(event: StorageEvent): void {
  // A null key means storage was cleared wholesale.
  if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;

  current = parseThemePreference(read());
  notify();
}

export function subscribeToPreference(onChange: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener("storage", handleStorage);
  }
  listeners.add(onChange);

  return () => {
    listeners.delete(onChange);

    if (listeners.size === 0) {
      window.removeEventListener("storage", handleStorage);
      // Nothing is observing the value any more, so holding it would only
      // risk serving something stale to whatever subscribes next.
      current = undefined;
    }
  };
}

/**
 * Returns a primitive, so React compares snapshots by value — returning a
 * fresh object here would re-render forever.
 */
export function getPreference(): ThemePreference {
  current ??= parseThemePreference(read());
  return current;
}

/**
 * The server cannot know a preference stored in the visitor's browser. It
 * renders the neutral default; `useSyncExternalStore` swaps in the real value
 * right after hydration, and the pre-hydration script has already made sure
 * the painted theme was correct the whole time.
 */
export function getServerPreference(): ThemePreference {
  return DEFAULT_THEME;
}

export function setPreference(preference: ThemePreference): void {
  current = preference;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage blocked. The choice still applies for this session — `current`
    // above is what the app reads — it just will not survive a reload.
  }

  notify();
}

export function subscribeToSystemScheme(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);

  return () => {
    media.removeEventListener("change", onChange);
  };
}

export function getSystemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

export function getServerSystemPrefersDark(): boolean {
  return false;
}

function read(): string | null {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null;
  }
}
