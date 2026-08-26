import {
  DEFAULT_DENSITY,
  defaultDensityForWidth,
  DENSITIES,
  DENSITY_STORAGE_KEY,
  type Density,
} from "./density";

/**
 * Same shape as `theme-store.ts`, on purpose — an external store rather than
 * `useState` in an effect, so the provider stays free of cascading renders
 * and a change in one tab reaches every other one through the `storage`
 * event, for nothing extra.
 */

const listeners = new Set<() => void>();

let current: Density | undefined;

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * What "no explicit choice" resolves to right now — `defaultDensityForWidth`
 * when nothing valid is in storage, not the fixed `DEFAULT_DENSITY`. Keeps
 * this in step with `DensityScript`, which already applied that same
 * resolution to the DOM before hydration; falling back to the fixed
 * constant here would make `DensityProvider`'s own effect immediately
 * overwrite the script's attribute on a desktop screen, right after load.
 */
function resolveDensity(stored: string | null): Density {
  if (stored !== null && DENSITIES.includes(stored as Density)) {
    return stored as Density;
  }
  return typeof window === "undefined"
    ? DEFAULT_DENSITY
    : defaultDensityForWidth(window.innerWidth);
}

function handleStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== DENSITY_STORAGE_KEY) return;

  current = resolveDensity(read());
  notify();
}

export function subscribeToDensity(onChange: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener("storage", handleStorage);
  }
  listeners.add(onChange);

  return () => {
    listeners.delete(onChange);

    if (listeners.size === 0) {
      window.removeEventListener("storage", handleStorage);
      current = undefined;
    }
  };
}

export function getDensity(): Density {
  current ??= resolveDensity(read());
  return current;
}

/** The server cannot know a preference stored in the visitor's browser. */
export function getServerDensity(): Density {
  return DEFAULT_DENSITY;
}

export function setDensity(density: Density): void {
  current = density;

  try {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, density);
  } catch {
    // Storage blocked. The choice still applies for this session — `current`
    // above is what the app reads — it just will not survive a reload.
  }

  notify();
}

function read(): string | null {
  try {
    return window.localStorage.getItem(DENSITY_STORAGE_KEY);
  } catch {
    return null;
  }
}
