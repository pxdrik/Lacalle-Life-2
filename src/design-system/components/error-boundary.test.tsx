import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "./error-boundary";

/** Throws on render, on purpose, to exercise the boundary. */
function Bomb(): never {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("renders children normally when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>tudo bem</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("tudo bem")).toBeInTheDocument();
  });

  it("catches a render error in its children and shows the fallback instead of crashing", () => {
    // React logs the error to the console on its own regardless of the
    // boundary; silenced here so the test output stays about the assertion.
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(
      screen.getByText("Não foi possível exibir isto."),
    ).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it("shows a custom message when one is given", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <ErrorBoundary message="Não foi possível exibir seus dados de peso e medidas.">
        <Bomb />
      </ErrorBoundary>,
    );

    expect(
      screen.getByText(
        "Não foi possível exibir seus dados de peso e medidas.",
      ),
    ).toBeInTheDocument();

    vi.restoreAllMocks();
  });

  /**
   * The point of wrapping one section rather than the page: a sibling that
   * has nothing wrong with it must keep rendering.
   */
  it("does not affect a sibling boundary or content outside it", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <>
        <ErrorBoundary>
          <Bomb />
        </ErrorBoundary>
        <p>ainda aqui</p>
      </>,
    );

    expect(screen.getByText("ainda aqui")).toBeInTheDocument();
    expect(
      screen.getByText("Não foi possível exibir isto."),
    ).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
