import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ErrorScreen from "./error";

// Found 26/08/2026 by an external audit: with no error.tsx in the app,
// a render-time throw (a missing Supabase env var, in (auth)/layout.tsx)
// fell all the way through to the browser's own "page didn't load" screen —
// nothing the app could say, nothing the person could do. This is what
// should show up instead.
describe("Error", () => {
  it("says the screen failed, without technical detail, and offers a way out", () => {
    render(
      <ErrorScreen error={new Error("boom")} reset={() => undefined} />,
    );

    expect(screen.getByText("Essa tela não carregou.")).toBeInTheDocument();
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para Hoje" }),
    ).toHaveAttribute("href", "/");
  });

  it("logs the error for whoever is watching the console", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("boom");

    render(<ErrorScreen error={error} reset={() => undefined} />);

    expect(spy).toHaveBeenCalledWith(error);
    spy.mockRestore();
  });

  it("calls reset when 'Tentar de novo' is pressed", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();
    render(<ErrorScreen error={new Error("boom")} reset={reset} />);

    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(reset).toHaveBeenCalledOnce();
  });
});
