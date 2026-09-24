import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { LocalProfileRepository } from "@/features/profile/data/local-profile-repository";
import { PROFILE_STORE } from "@/features/profile/data/profile-repository";
import { ProfileRepositoryProvider } from "@/features/profile/data/profile-repository-context";
import { PROFILE_ID, type Profile } from "@/features/profile/types/profile";

import { LocalWaterRepository } from "../data/local-water-repository";
import { WaterRepositoryProvider } from "../data/water-repository-context";
import { WATER_ENTRIES_STORE } from "../data/water-repository";
import type { WaterEntry } from "../types/water-entry";
import { TodayHydration } from "./today-hydration";

const DAY = "2026-09-24";

const PROFILE: Profile = {
  id: PROFILE_ID,
  createdAt: 1,
  updatedAt: 1,
  nutrition: {
    sex: "male",
    ageYears: 32,
    heightCm: 178,
    weightKg: 80,
    activityLevel: "moderate",
    goal: "maintain",
  },
};

function mount(ml: number | null, profile: Profile | null) {
  const water = new LocalWaterRepository(
    new MemoryStore<WaterEntry>(WATER_ENTRIES_STORE),
  );
  const profiles = new LocalProfileRepository(
    new MemoryStore<Profile>(PROFILE_STORE),
  );

  const ready = Promise.all([
    ml === null
      ? Promise.resolve()
      : water.save(
          { id: DAY, day: DAY, ml, createdAt: 1, updatedAt: 1 },
          null,
        ),
    profile === null ? Promise.resolve() : profiles.save(profile, null),
  ]);

  render(
    <WaterRepositoryProvider repository={ready.then(() => water)}>
      <ProfileRepositoryProvider repository={ready.then(() => profiles)}>
        <TodayHydration day={DAY} />
      </ProfileRepositoryProvider>
    </WaterRepositoryProvider>,
  );
}

describe("TodayHydration", () => {
  it("shows the logged total against the profile-derived target", async () => {
    mount(1200, PROFILE);

    expect(await screen.findByText("1.200")).toBeInTheDocument();
    // 80 kg × 35 mL/kg = 2.800 mL.
    expect(screen.getByText(/2\.800/)).toBeInTheDocument();
  });

  it("shows just the logged total without a profile, no invented target", async () => {
    mount(500, null);

    expect(await screen.findByText("500")).toBeInTheDocument();
    expect(screen.queryByText("/")).not.toBeInTheDocument();
  });

  it("shows 0 mL for a day nothing was logged, not a blank row", async () => {
    mount(null, PROFILE);

    expect(await screen.findByText("0")).toBeInTheDocument();
  });

  it("links to the diary, where water is actually logged", async () => {
    mount(200, PROFILE);
    await screen.findByText("200");

    expect(screen.getByRole("link")).toHaveAttribute("href", "/diario");
  });
});
