import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY } from "./theme";

/**
 * jsdom has no `matchMedia`, so this stands in for one — with a handle to
 * flip the OS setting mid-test, which is the only way to prove that `system`
 * tracks it and an explicit choice does not.
 */
function installMatchMedia(initialMatches: boolean) {
  const listeners = new Set<() => void>();
  let matches = initialMatches;

  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    get matches() {
      return matches;
    },
    addEventListener: (_event: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_event: string, listener: () => void) => {
      listeners.delete(listener);
    },
  }));

  return {
    setPrefersDark(next: boolean) {
      matches = next;
      act(() => {
        for (const listener of listeners) listener();
      });
    },
  };
}

const renderToggle = () =>
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );

const theme = () => document.documentElement.getAttribute(THEME_ATTRIBUTE);

/** The one button's accessible name changes with the resolved theme — see
 * `ThemeToggle`'s own doc comment for why the label names the action. */
const toggleButton = () => screen.getByRole("button", { name: /Mudar para tema/ });

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ThemeProvider", () => {
  it("starts dark when no preference was ever chosen, even on a light OS", () => {
    installMatchMedia(false);
    renderToggle();

    expect(theme()).toBe("dark");
    expect(toggleButton()).toHaveAccessibleName("Mudar para tema claro");
  });

  it("applies a stored preference over the OS setting", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    installMatchMedia(true);
    renderToggle();

    expect(theme()).toBe("light");
  });

  it("keeps tracking the OS while the preference is system", () => {
    // `system` is not reachable from the toggle any more, but a value
    // stored before that change still has to resolve correctly.
    window.localStorage.setItem(THEME_STORAGE_KEY, "system");
    const media = installMatchMedia(false);
    renderToggle();
    expect(theme()).toBe("light");

    media.setPrefersDark(true);

    expect(theme()).toBe("dark");
  });

  it("stops tracking the OS once a theme is chosen explicitly", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "system");
    const media = installMatchMedia(false);
    renderToggle();
    expect(theme()).toBe("light");

    await userEvent.click(toggleButton());
    expect(theme()).toBe("dark");

    // The OS flips back to light; the explicit choice must survive it.
    media.setPrefersDark(false);

    expect(theme()).toBe("dark");
  });

  it("persists the choice so it survives a reload", async () => {
    installMatchMedia(false);
    renderToggle();

    // Starts dark by default, so one tap picks light.
    await userEvent.click(toggleButton());

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("sets color-scheme alongside the attribute", async () => {
    installMatchMedia(false);
    renderToggle();

    await userEvent.click(toggleButton());

    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("recovers when storage is blocked entirely", async () => {
    installMatchMedia(false);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    renderToggle();
    await userEvent.click(toggleButton());

    // The choice cannot be persisted, but it must still take effect.
    expect(theme()).toBe("light");
    vi.restoreAllMocks();
  });
});

describe("ThemeToggle", () => {
  it("is a single button, not three options", () => {
    installMatchMedia(false);
    renderToggle();

    expect(screen.getAllByRole("button", { name: /Mudar para tema/ })).toHaveLength(1);
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("flips between light and dark on every click", async () => {
    installMatchMedia(false);
    renderToggle();

    expect(theme()).toBe("dark");

    await userEvent.click(toggleButton());
    expect(theme()).toBe("light");
    expect(toggleButton()).toHaveAccessibleName("Mudar para tema escuro");

    await userEvent.click(toggleButton());
    expect(theme()).toBe("dark");
    expect(toggleButton()).toHaveAccessibleName("Mudar para tema claro");
  });

  it("is operable by keyboard alone", async () => {
    installMatchMedia(false);
    renderToggle();

    await userEvent.tab();
    expect(toggleButton()).toHaveFocus();

    await userEvent.keyboard("{Enter}");

    expect(theme()).toBe("light");
  });
});
