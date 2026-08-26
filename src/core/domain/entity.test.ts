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

  // `crypto.randomUUID` does not exist at all outside a secure context — a
  // plain `http://` origin, not just an older browser. Found 26/08/2026: a
  // phone reached over the LAN by IP hit exactly this, and every "Criar" /
  // "Adicionar refeição" silently did nothing, every time.
  it("still produces collision-free ids when randomUUID is unavailable", () => {
    // `delete crypto.randomUUID` does not actually remove it in this test
    // environment (it survives on the object either way), so the property
    // has to be overridden explicitly to reproduce an insecure context,
    // where the browser does not define this method at all.
    const original = Object.getOwnPropertyDescriptor(crypto, "randomUUID");
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });

    try {
      const ids = Array.from({ length: 500 }, createEntityId);

      expect(new Set(ids).size).toBe(500);
      for (const id of ids) {
        expect(id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        );
      }
    } finally {
      if (original !== undefined) Object.defineProperty(crypto, "randomUUID", original);
    }
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
