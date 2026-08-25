import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import type { NutritionProfile } from "@/core/nutrition";
import { DensityProvider } from "@/design-system/density/density-provider";
import { ThemeProvider } from "@/design-system/theme/theme-provider";
import { BodyRepositoryProvider } from "@/features/body/data/body-repository-context";
import { BODY_ENTRIES_STORE } from "@/features/body/data/body-repository";
import { LocalBodyRepository } from "@/features/body/data/local-body-repository";
import type { BodyEntry } from "@/features/body/types/body-entry";

import { BackupRepositoryProvider } from "../data/backup-repository-context";
import type { BackupRepository } from "../data/backup-repository";
import { LocalProfileRepository } from "../data/local-profile-repository";
import { ProfileRepositoryProvider } from "../data/profile-repository-context";
import { PROFILE_STORE } from "../data/profile-repository";
import { PROFILE_ID, type Profile } from "../types/profile";
import { ProfileScreen } from "./profile-screen";

/**
 * Reproduces the exact sequence the 2026-08-24 pre-deploy review found
 * broken: a conflict, a click on "Recarregar dados", and then — the part
 * the earlier fix missed — whether the form actually shows what was
 * reloaded, or silently keeps re-rendering the edit that just got rejected.
 *
 * `ProfileForm` seeds its draft from `initial` through a lazy `useState`
 * initializer, which only ever runs once per mount. Before `key={updatedAt}`
 * existed on the call site in `ProfileScreen`, `reload()` refreshed
 * `useProfile`'s state correctly but the form kept showing the stale draft
 * — meaning a second "Salvar" would silently succeed (the version is fresh
 * now) and overwrite whatever the other tab had just saved, with no visual
 * sign anything was wrong. This test fails on that regression and passes
 * only once the reload genuinely reaches the screen.
 */

const INITIAL: NutritionProfile = {
  sex: "male",
  ageYears: 30,
  heightCm: 175,
  weightKg: 70,
  activityLevel: "moderate",
  goal: "maintain",
};

const noopBackup: BackupRepository = {
  exportAll: () => Promise.resolve({}),
  previewImport: () => Promise.resolve({ ok: true, recordCount: 0 }),
  importAll: () => Promise.resolve({ ok: true, recordCount: 0 }),
  forgetDevice: () => Promise.resolve({ ok: true }),
};

function profile(nutrition: NutritionProfile, updatedAt: number): Profile {
  return { id: PROFILE_ID, nutrition, createdAt: 1, updatedAt };
}

/** jsdom has no `matchMedia`; `ThemeProvider` needs one to mount at all. */
beforeEach(() => {
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

function mount(repository: LocalProfileRepository) {
  const bodyRepository = new LocalBodyRepository(
    new MemoryStore<BodyEntry>(BODY_ENTRIES_STORE),
  );

  render(
    <ThemeProvider>
      <DensityProvider>
        <ProfileRepositoryProvider repository={Promise.resolve(repository)}>
          <BodyRepositoryProvider repository={Promise.resolve(bodyRepository)}>
            <BackupRepositoryProvider repository={Promise.resolve(noopBackup)}>
              <ProfileScreen />
            </BackupRepositoryProvider>
          </BodyRepositoryProvider>
        </ProfileRepositoryProvider>
      </DensityProvider>
    </ThemeProvider>,
  );
}

describe("ProfileScreen — conflict recovery", () => {
  it("shows the freshly reloaded weight, not the stale draft, after Recarregar dados", async () => {
    const user = userEvent.setup();
    const store = new MemoryStore<Profile>(PROFILE_STORE);
    const repository = new LocalProfileRepository(store);
    await repository.save(profile(INITIAL, 1), null);

    mount(repository);

    await user.click(await screen.findByRole("button", { name: "Editar dados" }));
    const weightField = await screen.findByLabelText("Peso (kg)");
    expect(weightField).toHaveValue("70");

    // Tab A starts typing a new weight — the edit that will be stale.
    await user.clear(weightField);
    await user.type(weightField, "72");

    // Tab B, meanwhile, saves a different weight directly through the same
    // store — exactly what a second tab does, bypassing this screen's hook
    // entirely, the same way the production audit reproduced it.
    await repository.save(profile({ ...INITIAL, weightKg: 90 }, 2), 1);

    // Tab A submits its stale draft — rejected as a conflict, since it still
    // expects version 1 and the store is now at version 2.
    await user.click(screen.getByRole("button", { name: "Calcular metas" }));

    const reloadButton = await screen.findByRole("button", {
      name: "Recarregar dados",
    });

    // The regression under test: without the fix, the field below still
    // reads "72" (Tab A's stale draft) even after the reload button appears.
    await user.click(reloadButton);

    await waitFor(async () => {
      expect(await screen.findByLabelText("Peso (kg)")).toHaveValue("90");
    });

    // And the stale "72" is gone — not just "90 also appeared somewhere".
    expect(screen.queryByDisplayValue("72")).not.toBeInTheDocument();
  });

  it("does not silently overwrite the other tab's save after a reload", async () => {
    const user = userEvent.setup();
    const store = new MemoryStore<Profile>(PROFILE_STORE);
    const repository = new LocalProfileRepository(store);
    await repository.save(profile(INITIAL, 1), null);

    mount(repository);

    await user.click(await screen.findByRole("button", { name: "Editar dados" }));
    const weightField = await screen.findByLabelText("Peso (kg)");
    await user.clear(weightField);
    await user.type(weightField, "72");

    await repository.save(profile({ ...INITIAL, weightKg: 90 }, 2), 1);
    await user.click(screen.getByRole("button", { name: "Calcular metas" }));

    const reloadButton = await screen.findByRole("button", {
      name: "Recarregar dados",
    });
    await user.click(reloadButton);
    await waitFor(async () => {
      expect(await screen.findByLabelText("Peso (kg)")).toHaveValue("90");
    });

    // Submitting again now saves the reloaded value (90), which the person
    // can see on screen — never the "72" that was silently discarded.
    await user.click(screen.getByRole("button", { name: "Calcular metas" }));

    await waitFor(async () => {
      const stored = await repository.get();
      expect(stored?.nutrition.weightKg).toBe(90);
    });
  });
});
