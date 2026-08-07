import { beforeEach, describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";

import { createBodyEntry, EMPTY_MEASUREMENTS } from "../services/body-log";
import type { BodyEntry } from "../types/body-entry";
import { BODY_ENTRIES_STORE } from "./body-repository";
import { LocalBodyRepository } from "./local-body-repository";

let repository: LocalBodyRepository;
let store: MemoryStore<BodyEntry>;

function entry(day: string, over: Partial<BodyEntry> = {}): BodyEntry {
  return { ...createBodyEntry(day), ...over };
}

beforeEach(() => {
  store = new MemoryStore<BodyEntry>(BODY_ENTRIES_STORE);
  repository = new LocalBodyRepository(store);
});

describe("LocalBodyRepository", () => {
  it("returns entries oldest first, whatever order they were written in", async () => {
    await repository.save(entry("2026-08-10"));
    await repository.save(entry("2026-07-31"));
    await repository.save(entry("2026-08-02"));

    expect((await repository.listAll()).map((e) => e.day)).toEqual([
      "2026-07-31",
      "2026-08-02",
      "2026-08-10",
    ]);
  });

  it("replaces the day rather than adding a second entry for it", async () => {
    await repository.save(entry("2026-08-07", { weightKg: 82 }));
    await repository.save(entry("2026-08-07", { weightKg: 81 }));

    const all = await repository.listAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.weightKg).toBe(81);
  });

  it("reads a range inclusively at both ends", async () => {
    for (const day of ["2026-07-30", "2026-08-01", "2026-08-15", "2026-09-01"]) {
      await repository.save(entry(day));
    }

    const range = await repository.listBetween("2026-08-01", "2026-08-15");

    expect(range.map((e) => e.day)).toEqual(["2026-08-01", "2026-08-15"]);
  });

  it("finds a day by id without needing the index", async () => {
    await repository.save(entry("2026-08-07", { weightKg: 82 }));

    expect((await repository.getByDay("2026-08-07"))?.weightKg).toBe(82);
    expect(await repository.getByDay("2026-08-08")).toBeUndefined();
  });

  it("fills in a measurement site added after the entry was written", async () => {
    // The stored record predates the site, so it has no slot for it. Reading
    // it back must still answer for every site — with null, which is the
    // truth — or the form would render an uncontrolled input.
    const { calf: _calf, ...older } = EMPTY_MEASUREMENTS;
    await store.put({
      ...entry("2026-08-07"),
      measurements: older as typeof EMPTY_MEASUREMENTS,
    });

    const read = await repository.getByDay("2026-08-07");

    expect(read?.measurements.calf).toBeNull();
    expect(Object.keys(read?.measurements ?? {})).toHaveLength(
      Object.keys(EMPTY_MEASUREMENTS).length,
    );
  });

  it("removes a day", async () => {
    await repository.save(entry("2026-08-07"));
    await repository.remove("2026-08-07");

    expect(await repository.listAll()).toEqual([]);
  });
});
