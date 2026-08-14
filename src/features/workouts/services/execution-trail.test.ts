import { describe, expect, it } from "vitest";

import { executionTrail, TRAIL_WEEKS } from "./history";
import type { Session } from "../types/session";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 7, 13, 12, 0, 0);

function session(
  routineId: string | null,
  finishedDaysAgo: number | null,
): Session {
  const finishedAt = finishedDaysAgo === null ? null : NOW - finishedDaysAgo * DAY;

  return {
    id: `s-${String(finishedDaysAgo)}-${String(routineId)}`,
    routineId,
    name: "Treino A",
    startedAt: (finishedAt ?? NOW) - 3600_000,
    finishedAt,
    exercises: [],
    createdAt: NOW,
    updatedAt: NOW,
  } as unknown as Session;
}

/**
 * The trail's whole job is to make a gap visible, so these assert *position*
 * rather than count. A version that returned the right number of marks evenly
 * spaced would pass a count test and fail the only thing the feature exists for.
 */
describe("executionTrail", () => {
  it("draws nothing for a routine never executed", () => {
    const trail = executionTrail([session("outra", 3)], "minha", NOW);

    expect(trail.marks).toEqual([]);
    expect(trail.lastAt).toBeNull();
    expect(trail.countInWindow).toBe(0);
  });

  it("draws a single mark at its real position, not at an edge", () => {
    // 28 days back in a 56-day window is the middle, and it must land there —
    // a lone execution pinned to one end would read as "just now" or "ages ago".
    const trail = executionTrail([session("minha", 28)], "minha", NOW);

    expect(trail.marks).toHaveLength(1);
    expect(trail.marks[0]).toBeCloseTo(0.5, 2);
  });

  it("spaces marks by the real interval between sessions", () => {
    const trail = executionTrail(
      [session("minha", 56), session("minha", 28), session("minha", 0)],
      "minha",
      NOW,
    );

    expect(trail.marks.map((m) => Number(m.toFixed(2)))).toEqual([0, 0.5, 1]);
  });

  it("keeps a cluster clustered", () => {
    // Three sessions in one week must not spread across the track.
    const trail = executionTrail(
      [session("minha", 2), session("minha", 4), session("minha", 6)],
      "minha",
      NOW,
    );

    const spread = Math.max(...trail.marks) - Math.min(...trail.marks);
    expect(spread).toBeLessThan(0.1);
  });

  it("drops sessions older than the window but still reports the last one", () => {
    const trail = executionTrail(
      [session("minha", TRAIL_WEEKS * 7 + 10)],
      "minha",
      NOW,
    );

    expect(trail.marks).toEqual([]);
    expect(trail.countInWindow).toBe(0);
    // The card still says when it last happened, which is the fact that keeps
    // an abandoned routine honest instead of looking brand new.
    expect(trail.lastAt).not.toBeNull();
  });

  it("ignores a workout still in progress", () => {
    const trail = executionTrail([session("minha", null)], "minha", NOW);

    expect(trail.marks).toEqual([]);
    expect(trail.lastAt).toBeNull();
  });

  it("gives a session with no routine to no trail", () => {
    const trail = executionTrail([session(null, 5)], "minha", NOW);

    expect(trail.marks).toEqual([]);
  });
});
