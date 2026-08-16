import { DataError } from "@/core/domain/data-error";
import type { EntityId } from "@/core/domain/entity";
import type { Store } from "@/core/storage/store";

import { EMPTY_MEASUREMENTS } from "../services/body-log";
import type { BodyEntry } from "../types/body-entry";
import type { BodyRepository } from "./body-repository";

export class LocalBodyRepository implements BodyRepository {
  readonly #store: Store<BodyEntry>;

  constructor(store: Store<BodyEntry>) {
    this.#store = store;
  }

  async listAll(): Promise<readonly BodyEntry[]> {
    const entries = await this.#store.getAll();
    return entries.map(normalize).sort(byDay);
  }

  async listBetween(from: string, to: string): Promise<readonly BodyEntry[]> {
    const entries = await this.#store.getAllByIndex("byDay", { from, to });
    return entries.map(normalize).sort(byDay);
  }

  async getByDay(day: string): Promise<BodyEntry | undefined> {
    // The day is the id, so this needs no index lookup.
    const entry = await this.#store.get(day);
    return entry === undefined ? undefined : normalize(entry);
  }

  async save(
    entry: BodyEntry,
    expectedUpdatedAt: number | null,
  ): Promise<void> {
    const result = await this.#store.putIfVersionMatches(
      entry,
      expectedUpdatedAt,
    );
    if (!result.ok) {
      throw new DataError(
        "CONFLICT",
        `Este registro foi alterado em outro lugar desde a última leitura.`,
      );
    }
  }

  remove(id: EntityId): Promise<void> {
    return this.#store.remove(id);
  }
}

/**
 * Fills in sites added after an entry was written.
 *
 * Adding a measurement site is a change to a list in code, and every entry
 * stored before it must still answer for that site — with `null`, meaning "not
 * measured", which is the truth. Without this the form would read `undefined`
 * and render an uncontrolled input.
 */
function normalize(entry: BodyEntry): BodyEntry {
  return {
    ...entry,
    notes: entry.notes ?? "",
    weightKg: entry.weightKg ?? null,
    bodyFatPercent: entry.bodyFatPercent ?? null,
    measurements: { ...EMPTY_MEASUREMENTS, ...entry.measurements },
  };
}

/** `YYYY-MM-DD` sorts correctly as a string, oldest first. */
function byDay(a: BodyEntry, b: BodyEntry): number {
  return a.day.localeCompare(b.day);
}
