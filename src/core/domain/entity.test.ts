import { describe, expect, it, vi } from "vitest";

import { createEntityId, revise, type Entity } from "./entity";

interface Note extends Entity {
  title: string;
  pinned: boolean;
}

const note = (): Note => ({
  id: "note-1",
  createdAt: 1_000,
  updatedAt: 1_000,
  title: "original",
  pinned: false,
});

describe("createEntityId", () => {
  it("does not collide across calls", () => {
    const ids = new Set(Array.from({ length: 500 }, createEntityId));

    expect(ids.size).toBe(500);
  });
});

describe("revise", () => {
  it("applies the changes", () => {
    const revised = revise(note(), { title: "updated", pinned: true });

    expect(revised).toMatchObject({ title: "updated", pinned: true });
  });

  it("bumps updatedAt", () => {
    vi.spyOn(Date, "now").mockReturnValue(5_000);

    expect(revise(note(), { title: "updated" }).updatedAt).toBe(5_000);

    vi.restoreAllMocks();
  });

  it("bumps updatedAt even when nothing else changes", () => {
    // A different mocked instant than the previous test's, deliberately: two
    // `revise()` calls that land on the same millisecond are exactly what the
    // internal monotonic clamp exists to handle (see BUG-008 in
    // `entityTimestamp`), and that clamp would otherwise advance past
    // this test's mocked value instead of returning it verbatim.
    vi.spyOn(Date, "now").mockReturnValue(6_000);

    // A no-op revision is still a write, and the sync layer's ordering
    // depends on the timestamp reflecting that.
    expect(revise(note(), {}).updatedAt).toBe(6_000);

    vi.restoreAllMocks();
  });

  it("leaves identity alone", () => {
    const revised = revise(note(), { title: "updated" });

    expect(revised.id).toBe("note-1");
    expect(revised.createdAt).toBe(1_000);
  });

  it("does not mutate the original", () => {
    const original = note();
    revise(original, { title: "updated" });

    expect(original.title).toBe("original");
    expect(original.updatedAt).toBe(1_000);
  });
});
