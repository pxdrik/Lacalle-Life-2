import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Card } from "./card";

/**
 * The three things about this component that other files depend on, and that
 * nothing else would catch if they broke.
 *
 * Not asserted here: the exact utilities each tone spells out. A test that
 * repeats the recipe only proves the recipe was copied twice, and it fails
 * every time the design changes on purpose — which is the whole reason the
 * recipe was centralised.
 */
describe("Card", () => {
  it("renders the element it was asked for", () => {
    // `as="li"` exists so a routine in a list of routines is a list item and
    // not a div inside one. A silent fallback to `div` would produce a `ul`
    // whose children are not `li`, which is invalid and changes how a screen
    // reader counts the list.
    render(
      <ul>
        <Card as="li">Treino A</Card>
      </ul>,
    );

    expect(screen.getByRole("listitem")).toHaveTextContent("Treino A");
  });

  it("lets a caller's className win over the tone default", () => {
    // The stale-weight notice tints its border to mark itself as an offer
    // rather than a plain card, and the two list screens brighten theirs on
    // hover. All three are one `twMerge` away from silently doing nothing.
    render(
      <Card className="border-accent/40">Sua meta usa 84 kg</Card>,
    );

    const card = screen.getByText("Sua meta usa 84 kg");
    expect(card.className).toContain("border-accent/40");
    expect(card.className).not.toContain("border-line");
  });

  it("drops its padding when the content draws its own edges", () => {
    // Every list container relies on this: the padding belongs to the row, so
    // that a hover highlight reaches the full width of the card instead of
    // floating inside a border of dead space.
    render(
      <Card padded={false}>
        <ul />
      </Card>,
    );

    expect(screen.getByRole("list").parentElement?.className).not.toContain(
      "p-(--card-p)",
    );
  });
});
