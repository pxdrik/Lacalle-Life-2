import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLongPress } from "./use-long-press";

function Probe({
  onLongPress,
  disabled,
}: {
  readonly onLongPress: () => void;
  readonly disabled?: boolean;
}) {
  const { isPressing, ...handlers } = useLongPress(onLongPress, { disabled });

  return (
    <div>
      <div data-testid="row" {...handlers}>
        <p>pressing: {String(isPressing)}</p>
        <input aria-label="grams" defaultValue="" />
      </div>
    </div>
  );
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("useLongPress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires after holding for the full duration", () => {
    const onLongPress = vi.fn();
    render(<Probe onLongPress={onLongPress} />);

    fireEvent.pointerDown(screen.getByTestId("row"), {
      clientX: 0,
      clientY: 0,
      pointerType: "touch",
    });
    expect(screen.getByText("pressing: true")).toBeInTheDocument();

    advance(2000);

    expect(onLongPress).toHaveBeenCalledOnce();
    expect(screen.getByText("pressing: false")).toBeInTheDocument();
  });

  it("does not fire when released before the duration elapses", () => {
    const onLongPress = vi.fn();
    render(<Probe onLongPress={onLongPress} />);

    const row = screen.getByTestId("row");
    fireEvent.pointerDown(row, { clientX: 0, clientY: 0, pointerType: "touch" });
    advance(1500);
    fireEvent.pointerUp(row);
    advance(2000);

    expect(onLongPress).not.toHaveBeenCalled();
    expect(screen.getByText("pressing: false")).toBeInTheDocument();
  });

  it("cancels when the pointer moves past the threshold — a scroll, not a hold", () => {
    const onLongPress = vi.fn();
    render(<Probe onLongPress={onLongPress} />);

    const row = screen.getByTestId("row");
    fireEvent.pointerDown(row, { clientX: 0, clientY: 0, pointerType: "touch" });
    fireEvent.pointerMove(row, { clientX: 0, clientY: 40, pointerType: "touch" });
    advance(2000);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("tolerates small jitter under the threshold", () => {
    const onLongPress = vi.fn();
    render(<Probe onLongPress={onLongPress} />);

    const row = screen.getByTestId("row");
    fireEvent.pointerDown(row, { clientX: 0, clientY: 0, pointerType: "touch" });
    fireEvent.pointerMove(row, { clientX: 2, clientY: 1, pointerType: "touch" });
    advance(2000);

    expect(onLongPress).toHaveBeenCalledOnce();
  });

  it("never starts on a press that begins inside a text field", () => {
    const onLongPress = vi.fn();
    render(<Probe onLongPress={onLongPress} />);

    fireEvent.pointerDown(screen.getByLabelText("grams"), {
      clientX: 0,
      clientY: 0,
      pointerType: "touch",
    });
    advance(2000);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("ignores a right-click on a mouse", () => {
    const onLongPress = vi.fn();
    render(<Probe onLongPress={onLongPress} />);

    fireEvent.pointerDown(screen.getByTestId("row"), {
      clientX: 0,
      clientY: 0,
      pointerType: "mouse",
      button: 2,
    });
    advance(2000);

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("never starts a timer at all while disabled", () => {
    const onLongPress = vi.fn();
    render(<Probe onLongPress={onLongPress} disabled />);

    fireEvent.pointerDown(screen.getByTestId("row"), {
      clientX: 0,
      clientY: 0,
      pointerType: "touch",
    });
    advance(2000);

    expect(onLongPress).not.toHaveBeenCalled();
    expect(screen.getByText("pressing: false")).toBeInTheDocument();
  });
});
