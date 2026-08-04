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

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ThemeProvider", () => {
  it("follows the OS when no preference was ever chosen", () => {
    installMatchMedia(true);
    renderToggle();

    expect(theme()).toBe("dark");
    expect(screen.getByRole("radio", { name: "Sistema" })).toBeChecked();
  });

  it("applies a stored preference over the OS setting", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    installMatchMedia(true);
    renderToggle();

    expect(theme()).toBe("light");
  });

  it("keeps tracking the OS while the preference is system", () => {
    const media = installMatchMedia(false);
    renderToggle();
    expect(theme()).toBe("light");

    media.setPrefersDark(true);

    expect(theme()).toBe("dark");
  });

  it("stops tracking the OS once a theme is chosen explicitly", async () => {
    const media = installMatchMedia(false);
    renderToggle();

    await userEvent.click(screen.getByRole("radio", { name: "Escuro" }));
    expect(theme()).toBe("dark");

    // The OS flips to light; the explicit choice must survive it.
    media.setPrefersDark(false);

    expect(theme()).toBe("dark");
  });

  it("persists the choice so it survives a reload", async () => {
    installMatchMedia(false);
    renderToggle();

    await userEvent.click(screen.getByRole("radio", { name: "Escuro" }));

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("sets color-scheme alongside the attribute", async () => {
    installMatchMedia(false);
    renderToggle();

    await userEvent.click(screen.getByRole("radio", { name: "Escuro" }));

    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("recovers when storage is blocked entirely", async () => {
    installMatchMedia(false);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    renderToggle();
    await userEvent.click(screen.getByRole("radio", { name: "Escuro" }));

    // The choice cannot be persisted, but it must still take effect.
    expect(theme()).toBe("dark");
    vi.restoreAllMocks();
  });
});

describe("ThemeToggle", () => {
  it("exposes the three options as a labelled radio group", () => {
    installMatchMedia(false);
    renderToggle();

    expect(screen.getByRole("group", { name: "Tema" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  it("is operable by keyboard alone", async () => {
    installMatchMedia(false);
    renderToggle();

    // Tab enters a radio group at the selected option, and arrows move
    // between them. All of it is native behaviour — which is the reason this
    // is built on real radios instead of buttons with aria-checked.
    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "Sistema" })).toHaveFocus();

    await userEvent.keyboard("{ArrowLeft}");

    expect(screen.getByRole("radio", { name: "Escuro" })).toBeChecked();
    expect(theme()).toBe("dark");
  });
});
