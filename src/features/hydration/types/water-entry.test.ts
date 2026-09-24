import { describe, expect, it } from "vitest";

import { isEmptyEntry, type WaterEntry } from "./water-entry";

function entry(ml: number): WaterEntry {
  return { id: "2026-09-24", day: "2026-09-24", ml, createdAt: 1, updatedAt: 1 };
}

describe("isEmptyEntry", () => {
  it("is empty at 0 mL", () => {
    expect(isEmptyEntry(entry(0))).toBe(true);
  });

  it("is not empty once something was logged", () => {
    expect(isEmptyEntry(entry(200))).toBe(false);
  });
});
