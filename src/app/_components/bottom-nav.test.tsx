import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BottomNav } from "./bottom-nav";

const pathname = vi.hoisted(() => ({ current: "/hoje" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

afterEach(() => {
  pathname.current = "/hoje";
});

function at(route: string) {
  pathname.current = route;
  render(<BottomNav />);
}

const current = () =>
  screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent);

describe("which tab reads as current", () => {
  it("marks Hoje on the home route", () => {
    at("/hoje");
    expect(current()).toEqual(["Hoje"]);
  });

  it("does not mark Hoje everywhere else, though `/` prefixes every route", () => {
    // The trap: `"/diario".startsWith("/")` is true, so a prefix test would
    // light up Hoje on every screen in the app.
    at("/diario");
    expect(current()).toEqual(["Diário"]);
  });

  it("stays on the tab through a nested route", () => {
    at("/treinos/abc123");
    expect(current()).toEqual(["Treinos"]);
  });

  it("marks nothing when the screen lives behind Mais", () => {
    at("/alimentos");
    expect(current()).toEqual([]);
  });
});

describe("the Mais sheet", () => {
  it("keeps the setup screens one tap away rather than dropping them", async () => {
    at("/hoje");

    await userEvent.click(screen.getByRole("button", { name: /Mais/ }));

    for (const label of ["Dietas", "Exercícios", "Alimentos", "Perfil"]) {
      expect(
        screen.getByRole("link", { name: new RegExp(label) }),
      ).toBeInTheDocument();
    }
  });

  it("reports the section it is in, since no tab can", async () => {
    // Without this the bar looks entirely inactive on four of the app's
    // screens, which reads as "you are nowhere".
    at("/perfil");

    expect(screen.getByRole("button", { name: /Mais/ })).toHaveClass(
      "text-accent-text",
    );
  });
});
