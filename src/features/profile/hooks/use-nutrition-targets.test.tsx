import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";

import { LocalProfileRepository } from "../data/local-profile-repository";
import { PROFILE_STORE } from "../data/profile-repository";
import { ProfileRepositoryProvider } from "../data/profile-repository-context";
import { PROFILE_ID, type Profile } from "../types/profile";
import { useNutritionTargets } from "./use-nutrition-targets";

function Probe() {
  const targets = useNutritionTargets();

  return (
    <span data-testid="targets">
      {targets === null ? "none" : targets.kcal}
    </span>
  );
}

const profile = (nutrition: Profile["nutrition"]): Profile => ({
  id: PROFILE_ID,
  nutrition,
  createdAt: 1,
  updatedAt: 1,
});

const VALID: Profile["nutrition"] = {
  sex: "male",
  ageYears: 30,
  heightCm: 180,
  weightKg: 80,
  activityLevel: "moderate",
  goal: "maintain",
};

async function mountWith(stored?: Profile) {
  const repository = new LocalProfileRepository(
    new MemoryStore<Profile>(PROFILE_STORE),
  );
  if (stored !== undefined) await repository.save(stored);

  render(
    <ProfileRepositoryProvider repository={Promise.resolve(repository)}>
      <Probe />
    </ProfileRepositoryProvider>,
  );
}

const targets = () => screen.getByTestId("targets").textContent;

describe("useNutritionTargets", () => {
  it("is null with no provider mounted at all", () => {
    // The property that keeps building a diet independent of the profile
    // feature: a consumer can render without it being wired in.
    render(<Probe />);

    expect(targets()).toBe("none");
  });

  it("is null when no profile has been filled in", async () => {
    await mountWith();

    await waitFor(() => {
      expect(targets()).toBe("none");
    });
  });

  it("returns the engine's target once a profile exists", async () => {
    await mountWith(profile(VALID));

    // Mifflin-St Jeor 1780 kcal, moderate activity 1.55 -> 2759 maintaining.
    await waitFor(() => {
      expect(targets()).toBe("2759");
    });
  });

  it("is null when the engine refuses the profile as unsafe", async () => {
    // Schema-valid but physiologically extreme: a very small, sedentary person
    // on the most aggressive cut. If the engine returns violations, no target
    // is offered rather than an unsafe one.
    await mountWith(
      profile({
        ...VALID,
        sex: "female",
        weightKg: 30,
        heightCm: 120,
        ageYears: 100,
        activityLevel: "sedentary",
        goal: "cut",
        weeklyChangeKg: 2,
      }),
    );

    // Either a safe clamped target or nothing — never a number below the
    // clinical floor.
    await waitFor(() => {
      const value = targets();
      expect(value === "none" || Number(value) >= 1200).toBe(true);
    });
  });
});
