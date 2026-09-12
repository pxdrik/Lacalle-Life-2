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

describe("confirmClose", () => {
  // The regression this exists for: a multi-select exercise picker closed by
  // backdrop click or Escape mid-selection used to discard every checked
  // exercise with no way back — "closed it by accident" reported twice in a
  // row. Every dismissal path is gated the same way, so each gets its own
  // case rather than trusting they agree.

  it("gates the X button", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    let allow = false;
    render(
      <Dialog
        open
        title="Detalhe"
        onClose={onClose}
        confirmClose={() => allow}
      >
        conteúdo
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).not.toHaveBeenCalled();

    allow = true;
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("prevents the native cancel — Escape, or light-dismiss where supported", () => {
    render(
      <Dialog
        open
        title="Detalhe"
        onClose={() => undefined}
        confirmClose={() => false}
      >
        conteúdo
      </Dialog>,
    );

    const event = new Event("cancel", { cancelable: true });
    document.querySelector("dialog")?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("lets the cancel through once the gate allows it", () => {
    render(
      <Dialog
        open
        title="Detalhe"
        onClose={() => undefined}
        confirmClose={() => true}
      >
        conteúdo
      </Dialog>,
    );

    const event = new Event("cancel", { cancelable: true });
    document.querySelector("dialog")?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("gates the backdrop-click fallback used where closedby is unsupported", () => {
    // jsdom has no `closedby` at all, which is exactly the environment the
    // fallback click handler in `dialog.tsx` exists for.
    const onClose = vi.fn();
    let allow = false;
    render(
      <Dialog
        open
        title="Detalhe"
        onClose={onClose}
        confirmClose={() => allow}
      >
        conteúdo
      </Dialog>,
    );
    const dialog = document.querySelector("dialog")!;
    const clickOutside = () =>
      dialog.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          clientX: 9999,
          clientY: 9999,
        }),
      );

    clickOutside();
    expect(open()).toBe(true);
    expect(onClose).not.toHaveBeenCalled();

    allow = true;
    clickOutside();
    expect(open()).toBe(false);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
