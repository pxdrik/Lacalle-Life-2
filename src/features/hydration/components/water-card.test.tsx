import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import { WaterCard } from "./water-card";

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

function mount() {
  const water = new LocalWaterRepository(
    new MemoryStore<WaterEntry>(WATER_ENTRIES_STORE),
  );
  const profiles = new LocalProfileRepository(
    new MemoryStore<Profile>(PROFILE_STORE),
  );
  const ready = profiles.save(PROFILE, null);

  render(
    <WaterRepositoryProvider repository={Promise.resolve(water)}>
      <ProfileRepositoryProvider repository={ready.then(() => profiles)}>
        <WaterCard day={DAY} />
      </ProfileRepositoryProvider>
    </WaterRepositoryProvider>,
  );

  return water;
}

describe("WaterCard", () => {
  it("adds a quick amount and persists it", async () => {
    const user = userEvent.setup();
    const repository = mount();
    await screen.findByText("0");

    await user.click(screen.getByText("+200 mL"));

    expect(await screen.findByText("200")).toBeInTheDocument();
    await waitFor(async () => {
      expect((await repository.getByDay(DAY))?.ml).toBe(200);
    });
  });

  it("adds two quick amounts cumulatively", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByText("0");

    await user.click(screen.getByText("+200 mL"));
    await screen.findByText("200");
    await user.click(screen.getByText("+500 mL"));

    expect(await screen.findByText("700")).toBeInTheDocument();
  });

  it("corrects the total by clicking it and typing a new value", async () => {
    const user = userEvent.setup();
    const repository = mount();
    await screen.findByText("0");

    await user.click(screen.getByText("+200 mL"));
    await screen.findByText("200");

    await user.click(screen.getByText("200"));
    const input = screen.getByRole("textbox");
    await user.clear(input);
    await user.type(input, "1500{Enter}");

    expect(await screen.findByText("1.500")).toBeInTheDocument();
    await waitFor(async () => {
      expect((await repository.getByDay(DAY))?.ml).toBe(1500);
    });
  });
});
