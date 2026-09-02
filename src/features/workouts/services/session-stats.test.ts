import { describe, expect, it } from "vitest";

import type { Session } from "../types/session";
import {
  formatDuration,
  isStaleSession,
  staleSessionDays,
} from "./session-stats";

const at = (day: string, hour: number, minute = 0) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!, hour, minute).getTime();
};

function session(overrides: Partial<Session> & { id: string }): Session {
  return {
    routineId: null,
    name: "Treino",
    startedAt: at("2026-09-02", 8),
    finishedAt: null,
    createdAt: 1,
    updatedAt: 1,
    exercises: [],
    ...overrides,
  };
}

describe("isStaleSession", () => {
  it("is not stale for a session started earlier today", () => {
    const now = at("2026-09-02", 20);
    expect(
      isStaleSession(session({ id: "a", startedAt: at("2026-09-02", 8) }), now),
    ).toBe(false);
  });

  it("is stale once the session crosses into the next calendar day, even by minutes", () => {
    const now = at("2026-09-03", 0, 10);
    expect(
      isStaleSession(
        session({ id: "b", startedAt: at("2026-09-02", 23, 50) }),
        now,
      ),
    ).toBe(true);
  });

  it("is never stale once the session has finished — a finished session is not 'in progress' at all", () => {
    const now = at("2026-09-10", 8);
    expect(
      isStaleSession(
        session({
          id: "c",
          startedAt: at("2026-08-01", 8),
          finishedAt: at("2026-08-01", 9),
        }),
        now,
      ),
    ).toBe(false);
  });
});

describe("staleSessionDays", () => {
  it("counts one day for a session that spilled past midnight by minutes", () => {
    const now = at("2026-09-03", 0, 10);
    expect(
      staleSessionDays(
        session({ id: "a", startedAt: at("2026-09-02", 23, 50) }),
        now,
      ),
    ).toBe(1);
  });

  it("counts the real day gap for a session left open for days — the exact case the audit found (a session reading '116:42:45')", () => {
    const now = at("2026-09-02", 12);
    expect(
      staleSessionDays(
        session({ id: "b", startedAt: at("2026-08-29", 8) }),
        now,
      ),
    ).toBe(4);
  });
});

describe("formatDuration", () => {
  it("still renders hours:minutes:seconds for same-day durations — unchanged for the common case", () => {
    expect(formatDuration(90 * 60 * 1000 + 5000)).toBe("1:30:05");
  });
});
