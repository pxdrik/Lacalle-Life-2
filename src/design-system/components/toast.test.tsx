import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider, useToast } from "./toast";

/**
 * The receipt for writes that leave no trace.
 *
 * Most of this app needs none: change a portion and the calories move in front
 * of you. Saving a profile only ever confirmed itself by navigating away,
 * which looks the same as a navigation that happened for any other reason.
 */

function Trigger({ message = "Salvo." }: { readonly message?: string }) {
  const toast = useToast();

  return (
    <button
      type="button"
      onClick={() => {
        toast(message);
      }}
    >
      agir
    </button>
  );
}

function TriggerWithAction({ onAction }: { readonly onAction: () => void }) {
  const toast = useToast();

  return (
    <button
      type="button"
      onClick={() => {
        toast("Refeição transformada.", { label: "Desfazer", onAction });
      }}
    >
      agir
    </button>
  );
}

function mount(ui: React.ReactNode = <Trigger />) {
  render(<ToastProvider>{ui}</ToastProvider>);
}

const act_ = () =>
  userEvent.click(screen.getByRole("button", { name: "agir" }));

describe("showing a confirmation", () => {
  it("says what happened", async () => {
    mount();

    await act_();

    expect(screen.getByText("Salvo.")).toBeInTheDocument();
  });

  it("announces politely, never interrupting", () => {
    // This confirms something that already went right. Cutting into whatever
    // a screen reader was saying to report success is rude.
    mount();

    const region = screen.getByRole("status");

    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("keeps the live region mounted before there is anything to say", () => {
    // A region created at the same moment it fills is not announced: the
    // reader has nothing to have been watching.
    mount();

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});

/**
 * Pedro, 23/09/2026: "faltou um botão para desfazer" — a segunda ação que
 * uma confirmação simples nunca precisou carregar.
 */
describe("um toast com ação (desfazer)", () => {
  it("mostra o botão da ação, ao lado da mensagem", async () => {
    mount(<TriggerWithAction onAction={vi.fn()} />);

    await act_();

    expect(screen.getByText("Refeição transformada.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Desfazer" }),
    ).toBeInTheDocument();
  });

  it("chama onAction e fecha o toast ao tocar no botão", async () => {
    const onAction = vi.fn();
    mount(<TriggerWithAction onAction={onAction} />);
    await act_();

    await userEvent.click(screen.getByRole("button", { name: "Desfazer" }));

    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.queryByText("Refeição transformada.")).not.toBeInTheDocument();
  });

  it("uma mensagem sem ação não mostra nenhum botão", async () => {
    mount();

    await act_();

    expect(screen.queryByRole("button", { name: "Desfazer" })).not.toBeInTheDocument();
  });
});

describe("without a provider", () => {
  it("does nothing instead of throwing", async () => {
    // A confirmation is an enhancement. A screen rendered in isolation, or in
    // a test that does not care about toasts, must not crash for lack of one.
    render(<Trigger />);

    await expect(act_()).resolves.not.toThrow();
  });
});

describe("after a few seconds", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("takes itself away", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mount();

    await user.click(screen.getByRole("button", { name: "agir" }));
    expect(screen.getByText("Salvo.")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText("Salvo.")).not.toBeInTheDocument();
  });

  it("restarts the clock for a second message rather than inheriting the first", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mount();

    await user.click(screen.getByRole("button", { name: "agir" }));
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Fired with 200ms left on the first timer. Inheriting it would blink the
    // second message away almost immediately.
    await user.click(screen.getByRole("button", { name: "agir" }));
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("Salvo.")).toBeInTheDocument();
  });

  it("dá mais tempo pra um toast com ação — não some no mesmo prazo de uma confirmação simples", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mount(<TriggerWithAction onAction={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "agir" }));
    act(() => {
      // Prazo de uma confirmação simples já passou — a versão com ação
      // continua na tela.
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText("Refeição transformada.")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText("Refeição transformada.")).not.toBeInTheDocument();
  });
});
