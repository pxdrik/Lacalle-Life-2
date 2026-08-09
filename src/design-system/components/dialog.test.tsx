import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Dialog } from "./dialog";

/**
 * jsdom implements `<dialog>` but not the modal parts of it, so `showModal()`
 * and `close()` are stubbed in `vitest.setup.ts` — a gap in the environment
 * rather than a fact about this component, and one that any test rendering a
 * dialog runs into. Everything asserted below is our own logic: when we open,
 * when we close, what we clean up.
 */

function open() {
  return document.querySelector("dialog")?.open === true;
}

describe("Dialog", () => {
  it("opens and closes with the prop", () => {
    const { rerender } = render(
      <Dialog open={false} title="Detalhe" onClose={() => undefined}>
        conteúdo
      </Dialog>,
    );
    expect(open()).toBe(false);

    rerender(
      <Dialog open title="Detalhe" onClose={() => undefined}>
        conteúdo
      </Dialog>,
    );
    expect(open()).toBe(true);
  });

  it("reports a close the browser performed, not only one we asked for", () => {
    // The regression that motivated this test: React's `onClose` prop never
    // fires, because the `close` event does not bubble and so never reaches
    // the delegated listener at the root. The component then believed it was
    // still open — the page stayed locked and reopening did nothing.
    const onClose = vi.fn();
    render(
      <Dialog open title="Detalhe" onClose={onClose}>
        conteúdo
      </Dialog>,
    );

    document.querySelector("dialog")?.close();

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("releases the page scroll it locked", () => {
    const { rerender } = render(
      <Dialog open title="Detalhe" onClose={() => undefined}>
        conteúdo
      </Dialog>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Dialog open={false} title="Detalhe" onClose={() => undefined}>
        conteúdo
      </Dialog>,
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("names itself by its title, and offers a close button", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog open title="Supino Reto com Barra" onClose={onClose}>
        conteúdo
      </Dialog>,
    );

    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "Supino Reto com Barra",
    );

    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalled();
  });
});
