import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useIncrementalReveal } from "./use-incremental-reveal";

/**
 * A controllable fake, scoped to this file — the global stub in
 * `vitest.setup.ts` is deliberately inert (never calls back), so growth has
 * to be simulated here by calling `triggerIntersection()` directly.
 */
let instances: FakeIntersectionObserver[] = [];

class FakeIntersectionObserver {
  readonly callback: IntersectionObserverCallback;
  observed: Element | null = null;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    instances.push(this);
  }

  observe(target: Element) {
    this.observed = target;
  }

  disconnect() {
    this.observed = null;
  }

  unobserve() {
    this.observed = null;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  triggerIntersection() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

function latestObserver(): FakeIntersectionObserver {
  const observer = instances.at(-1);
  if (observer === undefined) throw new Error("no observer was created");
  return observer;
}

function Probe({
  resetKey,
  total,
  pageSize,
}: {
  readonly resetKey: string;
  readonly total: number;
  readonly pageSize: number;
}) {
  const { count, hasMore, sentinelRef } = useIncrementalReveal(
    resetKey,
    total,
    pageSize,
  );

  return (
    <div>
      <p>count: {count}</p>
      <p>hasMore: {String(hasMore)}</p>
      {hasMore && <div ref={sentinelRef} data-testid="sentinel" />}
    </div>
  );
}

describe("useIncrementalReveal", () => {
  beforeEach(() => {
    instances = [];
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts revealing only the first page", () => {
    render(<Probe resetKey="q1" total={183} pageSize={40} />);

    expect(screen.getByText("count: 40")).toBeInTheDocument();
    expect(screen.getByText("hasMore: true")).toBeInTheDocument();
  });

  it("shows everything up front when the total is smaller than a page", () => {
    render(<Probe resetKey="q1" total={5} pageSize={40} />);

    expect(screen.getByText("count: 5")).toBeInTheDocument();
    expect(screen.getByText("hasMore: false")).toBeInTheDocument();
  });

  it("grows by one page when the sentinel intersects", async () => {
    render(<Probe resetKey="q1" total={183} pageSize={40} />);

    await act(async () => {
      latestObserver().triggerIntersection();
    });

    expect(screen.getByText("count: 80")).toBeInTheDocument();
  });

  it("never grows past the total", async () => {
    render(<Probe resetKey="q1" total={50} pageSize={40} />);

    await act(async () => {
      latestObserver().triggerIntersection();
    });

    expect(screen.getByText("count: 50")).toBeInTheDocument();
    expect(screen.getByText("hasMore: false")).toBeInTheDocument();
  });

  it("resets to the first page when the query changes, discarding earned growth", async () => {
    const { rerender } = render(
      <Probe resetKey="rosca" total={183} pageSize={40} />,
    );

    await act(async () => {
      latestObserver().triggerIntersection();
    });
    expect(screen.getByText("count: 80")).toBeInTheDocument();

    rerender(<Probe resetKey="supino" total={12} pageSize={40} />);

    expect(screen.getByText("count: 12")).toBeInTheDocument();
  });

  it("does not reset on an unrelated re-render with the same query", () => {
    const { rerender } = render(
      <Probe resetKey="rosca" total={183} pageSize={40} />,
    );

    rerender(<Probe resetKey="rosca" total={183} pageSize={40} />);

    // Still page one, but critically: still mounted without throwing, and the
    // count did not silently change underneath an unrelated render.
    expect(screen.getByText("count: 40")).toBeInTheDocument();
  });
});

/**
 * What BUG-011 was actually about: not scrolling, typing. Every keystroke of
 * a live search re-renders the result list, and the cost that mattered was
 * how many rows that render has to mount — not how many the catalogue holds.
 *
 * Ratio-based rather than a millisecond threshold, same reasoning as the
 * `scale` benchmark in `search-exercises.test.ts`: a wall-clock bound
 * measures the machine, and a ratio between two catalogue sizes cancels
 * machine speed out.
 */
describe("mount cost stays bounded as the catalogue grows", () => {
  function ExpensiveRow({ index }: { readonly index: number }) {
    // Cheap in isolation, expensive multiplied by hundreds — same shape as a
    // real row that formats currency-like numbers and reads several tokens.
    let acc = 0;
    for (let i = 0; i < 500; i += 1) acc += i * index;
    return <li>{acc}</li>;
  }

  function List({ total }: { readonly total: number }) {
    const { count, hasMore, sentinelRef } = useIncrementalReveal(
      "q",
      total,
      40,
    );

    return (
      <ul>
        {Array.from({ length: count }, (_, i) => (
          <ExpensiveRow key={i} index={i} />
        ))}
        {hasMore && <li ref={sentinelRef} />}
      </ul>
    );
  }

  function medianMountMs(total: number): number {
    const samples: number[] = [];

    for (let run = 0; run < 5; run += 1) {
      const started = performance.now();
      const { unmount } = render(<List total={total} />);
      samples.push(performance.now() - started);
      unmount();
    }

    return samples.sort((a, b) => a - b)[2]!;
  }

  it("costs roughly the same to mount whether the catalogue has 200 rows or 2000", () => {
    const small = medianMountMs(200);
    const large = medianMountMs(2000);

    // Both mount the same 40-row first page — a 10x larger catalogue should
    // not come close to a 10x slower first render. Generous bound to absorb
    // noise; the point is "does not scale with total", not a tight number.
    expect(large / Math.max(small, 0.01)).toBeLessThan(3);
  });
});
