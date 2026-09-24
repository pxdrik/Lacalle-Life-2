import { beforeEach, describe, expect, it } from "vitest";

import { DataError } from "@/core/domain/data-error";
import { revise } from "@/core/domain/entity";
import { MemoryStore } from "@/core/storage/memory-store";

import { createWaterEntry } from "../services/hydration-log";
import type { WaterEntry } from "../types/water-entry";
import { LocalWaterRepository } from "./local-water-repository";
import { WATER_ENTRIES_STORE } from "./water-repository";

let repository: LocalWaterRepository;
let store: MemoryStore<WaterEntry>;

function entry(day: string, ml = 0): WaterEntry {
  return { ...createWaterEntry(day), ml };
}

beforeEach(() => {
  store = new MemoryStore<WaterEntry>(WATER_ENTRIES_STORE);
  repository = new LocalWaterRepository(store);
});

describe("LocalWaterRepository", () => {
  it("returns entries oldest first, whatever order they were written in", async () => {
    await repository.save(entry("2026-08-10"), null);
    await repository.save(entry("2026-07-31"), null);
    await repository.save(entry("2026-08-02"), null);

    expect((await repository.listAll()).map((e) => e.day)).toEqual([
      "2026-07-31",
      "2026-08-02",
      "2026-08-10",
    ]);
  });

  it("replaces the day rather than adding a second entry for it", async () => {
    const first = entry("2026-08-07", 1200);
    await repository.save(first, null);
    await repository.save(entry("2026-08-07", 1500), first.updatedAt);

    const all = await repository.listAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.ml).toBe(1500);
  });

  it("finds a day by id without needing the index", async () => {
    await repository.save(entry("2026-08-07", 800), null);

    expect((await repository.getByDay("2026-08-07"))?.ml).toBe(800);
    expect(await repository.getByDay("2026-08-08")).toBeUndefined();
  });

  it("defaults ml to 0 for a record written before the field existed", async () => {
    const { ml: _ml, ...legacy } = entry("2026-08-07");
    await store.put(legacy as WaterEntry);

    expect((await repository.getByDay("2026-08-07"))?.ml).toBe(0);
  });

  it("removes a day", async () => {
    await repository.save(entry("2026-08-07"), null);
    await repository.remove("2026-08-07");

    expect(await repository.listAll()).toEqual([]);
  });

  it("rejects a stale writer instead of silently overwriting the winner", async () => {
    const original = entry("2026-08-16", 1000);
    await repository.save(original, null);

    const fromTabA = revise(original, { ml: 1200 });
    const fromTabB = revise(original, { ml: 1400 });

    await repository.save(fromTabA, original.updatedAt);

    await expect(
      repository.save(fromTabB, original.updatedAt),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect((await repository.getByDay("2026-08-16"))?.ml).toBe(1200);
  });

  it("rejects a second create at the same day", async () => {
    const first = entry("2026-08-16");

    await repository.save(first, null);
    await expect(repository.save(first, null)).rejects.toBeInstanceOf(
      DataError,
    );
  });
});
