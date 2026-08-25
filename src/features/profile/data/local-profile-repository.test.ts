import { beforeEach, describe, expect, it } from "vitest";

import { openDatabase } from "@/core/storage/indexeddb/database";
import { IndexedDbStore } from "@/core/storage/indexeddb/indexeddb-store";
import { MemoryStore } from "@/core/storage/memory-store";
import type { Migration } from "@/core/storage/schema";
import type { Store } from "@/core/storage/store";

import { PROFILE_ID, type Profile } from "../types/profile";
import { LocalProfileRepository } from "./local-profile-repository";
import { PROFILE_STORE } from "./profile-repository";
import type { ProfileRepository } from "./profile-repository";

const MIGRATIONS: readonly Migration[] = [
  { version: 1, description: "profile", createStores: [PROFILE_STORE] },
];

let counter = 0;

const ADAPTERS: readonly {
  name: string;
  create: () => Promise<Store<Profile>>;
}[] = [
  {
    name: "memory",
    create: () => Promise.resolve(new MemoryStore<Profile>(PROFILE_STORE)),
  },
  {
    name: "indexeddb",
    create: async () => {
      counter += 1;
      const db = await openDatabase(`profile-repo-${counter}`, MIGRATIONS);
      return new IndexedDbStore<Profile>(db, PROFILE_STORE.name);
    },
  },
];

function profile(over: Partial<Profile["nutrition"]> = {}, updatedAt = 1): Profile {
  return {
    id: PROFILE_ID,
    nutrition: {
      sex: "female",
      ageYears: 30,
      heightCm: 165,
      weightKg: 60,
      activityLevel: "moderate",
      goal: "maintain",
      ...over,
    },
    createdAt: 1,
    updatedAt,
  };
}

describe.each(ADAPTERS)("LocalProfileRepository — $name", ({ create }) => {
  let repository: ProfileRepository;

  beforeEach(async () => {
    repository = new LocalProfileRepository(await create());
  });

  it("is undefined until something is saved", async () => {
    await expect(repository.get()).resolves.toBeUndefined();
  });

  it("round-trips the profile", async () => {
    const saved = profile();
    await repository.save(saved, null);

    await expect(repository.get()).resolves.toEqual(saved);
  });

  it("clear removes it", async () => {
    await repository.save(profile(), null);
    await repository.clear();

    await expect(repository.get()).resolves.toBeUndefined();
  });

  /**
   * `save` wrote unconditionally until the 2026-08-24 adversarial audit
   * against production reproduced the consequence with two real tabs: tab B
   * saved over tab A without any error, and tab A — still showing its own
   * stale form — then saved again and silently reverted tab B's edit right
   * back, with `createdAt` reset each time because there was no merge, only
   * a blind `put()`. `save` now goes through `Store.putIfVersionMatches`.
   */
  describe("concurrent writers — F-01", () => {
    it("rejects a stale writer instead of silently overwriting the winner", async () => {
      const original = profile({ weightKg: 70 }, 1);
      await repository.save(original, null);

      // Tab A and tab B both loaded the profile at `updatedAt: 1` and each
      // edited a different field, carrying the rest of what they read
      // forward unchanged — exactly what a real edit does.
      const fromTabA = profile({ weightKg: 70, ageYears: 45 }, 2);
      const fromTabB = profile({ weightKg: 90 }, 3);

      await repository.save(fromTabA, 1);

      await expect(repository.save(fromTabB, 1)).rejects.toMatchObject({
        code: "CONFLICT",
      });

      // Tab A's edit survives; tab B's is rejected, not silently applied,
      // and nothing about the record — including `createdAt` — is reset.
      await expect(repository.get()).resolves.toMatchObject({
        nutrition: { ageYears: 45, weightKg: 70 },
        createdAt: 1,
      });
    });

    it("rejects a second create at the same id", async () => {
      const saved = profile();

      await repository.save(saved, null);
      await expect(repository.save(saved, null)).rejects.toMatchObject({
        code: "CONFLICT",
      });
    });
  });
});
