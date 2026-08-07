import { describe, expect, it } from "vitest";

import { moveItem, reorderById, shiftById } from "./collection";

const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
const ids = (list: readonly { id: string }[]) => list.map((item) => item.id);

describe("moveItem", () => {
  it("moves forwards", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("moves backwards", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("is a no-op onto itself", () => {
    expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input", () => {
    const original = ["a", "b", "c"];
    moveItem(original, 0, 2);

    expect(original).toEqual(["a", "b", "c"]);
  });
});

describe("reorderById", () => {
  it("puts the dragged item where the target was", () => {
    expect(ids(reorderById(items, "a", "c"))).toEqual(["b", "c", "a", "d"]);
  });

  it("works dragging upwards", () => {
    expect(ids(reorderById(items, "d", "b"))).toEqual(["a", "d", "b", "c"]);
  });

  it("returns the same reference when dropped on itself", () => {
    // Lets the caller skip a pointless write, which a future sync would
    // otherwise see as an edit.
    expect(reorderById(items, "b", "b")).toBe(items);
  });

  it("returns the same reference for an id that is not there", () => {
    expect(reorderById(items, "gone", "c")).toBe(items);
    expect(reorderById(items, "a", "gone")).toBe(items);
  });
});

describe("shiftById", () => {
  it("moves down", () => {
    expect(ids(shiftById(items, "a", 1))).toEqual(["b", "a", "c", "d"]);
  });

  it("moves up", () => {
    expect(ids(shiftById(items, "c", -1))).toEqual(["a", "c", "b", "d"]);
  });

  it("clamps at the ends instead of wrapping", () => {
    expect(shiftById(items, "a", -1)).toBe(items);
    expect(shiftById(items, "d", 1)).toBe(items);
  });

  it("accepts a jump larger than the list", () => {
    expect(ids(shiftById(items, "a", 99))).toEqual(["b", "c", "d", "a"]);
  });

  it("returns the same reference for an unknown id", () => {
    expect(shiftById(items, "gone", 1)).toBe(items);
  });
});
