import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { SYNC_TRACKER_STORE, type SyncTracker } from "@/core/sync/sync-tracker";

import { PROFILE_ID, type Profile } from "../types/profile";
import { LocalProfileRepository } from "./local-profile-repository";
import { PROFILE_STORE } from "./profile-repository";
import { SyncingProfileRepository } from "./syncing-profile-repository";

/**
 * `onPending` é a ponte para `composition/sync` tentar um push logo depois
 * de salvar — achado ao vivo: sem isto, o push só acontecia na próxima vez
 * que a tela de sincronização montasse. Estes testes provam só o chamado do
 * gancho, não o push em si (isso já é coberto por `profile-sync.test.ts`).
 */

function profile(weightKg = 80): Profile {
  return {
    id: PROFILE_ID,
    nutrition: {
      sex: "male",
      ageYears: 30,
      heightCm: 175,
      weightKg,
      activityLevel: "moderate",
      goal: "maintain",
    },
    createdAt: 1000,
    updatedAt: 1000,
  };
}

function mount(onPending?: () => void) {
  const local = new LocalProfileRepository(new MemoryStore<Profile>(PROFILE_STORE));
  const tracker = new MemoryStore<SyncTracker>(SYNC_TRACKER_STORE);
  return new SyncingProfileRepository(local, tracker, onPending);
}

describe("SyncingProfileRepository — gancho onPending", () => {
  it("chama onPending depois de save", async () => {
    const onPending = vi.fn();
    const repository = mount(onPending);

    await repository.save(profile(), null);

    expect(onPending).toHaveBeenCalledTimes(1);
  });

  it("chama onPending depois de clear", async () => {
    const onPending = vi.fn();
    const repository = mount(onPending);
    await repository.save(profile(), null);
    onPending.mockClear();

    await repository.clear();

    expect(onPending).toHaveBeenCalledTimes(1);
  });

  it("nunca lança e o registro local é gravado normalmente sem onPending", async () => {
    const repository = mount();

    await expect(repository.save(profile(), null)).resolves.toBeUndefined();
    await expect(repository.get()).resolves.toMatchObject({ nutrition: { weightKg: 80 } });
  });
});
