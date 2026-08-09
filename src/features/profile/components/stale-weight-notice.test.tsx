import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { NutritionProfile } from "@/core/nutrition";
import { MemoryStore } from "@/core/storage/memory-store";
import { BODY_ENTRIES_STORE } from "@/features/body/data/body-repository";
import { BodyRepositoryProvider } from "@/features/body/data/body-repository-context";
import { LocalBodyRepository } from "@/features/body/data/local-body-repository";
import { createBodyEntry } from "@/features/body/services/body-log";
import type { BodyEntry } from "@/features/body/types/body-entry";

import { StaleWeightNotice } from "./stale-weight-notice";

/**
 * The silent failure this exists to stop: a profile left at 84 kg while the
 * scale has been saying 80 for a month is not a wrong number on a screen, it
 * is a calorie target that has been wrong every day since.
 */

const PROFILE: NutritionProfile = {
  sex: "male",
  ageYears: 32,
  heightCm: 178,
  weightKg: 84,
  activityLevel: "moderate",
  goal: "cut",
};

/**
 * Built through the real factory rather than by hand: `measurements` carries a
 * slot for each of the nine sites, and a fixture that invented a shorter shape
 * would be testing a record the app never writes.
 */
function entry(day: string, weightKg: number | null): BodyEntry {
  return { ...createBodyEntry(day), weightKg };
}

function mount(entries: readonly BodyEntry[], onApply = vi.fn()) {
  const repository = new LocalBodyRepository(
    new MemoryStore<BodyEntry>(BODY_ENTRIES_STORE),
  );
  const ready = Promise.all(entries.map((e) => repository.save(e)));

  render(
    <BodyRepositoryProvider repository={ready.then(() => repository)}>
      <StaleWeightNotice profile={PROFILE} onApply={onApply} pending={false} />
    </BodyRepositoryProvider>,
  );

  return onApply;
}

const offer = () => screen.queryByRole("button", { name: /^Usar/ });

/**
 * Lets the hook's read of the body log settle.
 *
 * The quiet cases assert an absence, and an absence is true before the data
 * arrives too — without this they would pass against a component that always
 * rendered the offer, one tick later.
 */
async function afterLoad() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("when the profile has drifted", () => {
  it("names both numbers and the date of the weigh-in", async () => {
    mount([entry("2026-08-07", 80.4)]);

    // The weight appears twice on purpose — in the sentence and on the button
    // — so this asserts the sentence, which is the part that explains.
    const sentence = await screen.findByText(/Sua meta usa/);

    expect(sentence).toHaveTextContent("84 kg");
    expect(sentence).toHaveTextContent("80,4 kg");
    expect(sentence).toHaveTextContent("07/08/2026");
  });

  it("offers the newer weight rather than applying it", async () => {
    // The log is history and the profile is an input. Syncing them would let
    // one bad morning on the scale move somebody's calories unasked.
    const onApply = mount([entry("2026-08-07", 80.4)]);

    await userEvent.click(await screen.findByRole("button", { name: "Usar 80,4 kg" }));

    expect(onApply).toHaveBeenCalledWith(80.4);
  });

  it("reads the most recent weigh-in, not the last one stored", async () => {
    mount([entry("2026-08-07", 80.4), entry("2026-07-01", 90)]);

    expect(await screen.findByRole("button", { name: "Usar 80,4 kg" })).toBeInTheDocument();
  });

  it("works upwards too", async () => {
    mount([entry("2026-08-07", 88)]);

    expect(await screen.findByText(/Você ganhou/)).toBeInTheDocument();
  });
});

describe("when it should stay quiet", () => {
  it("says nothing under a kilo, which is the scale and the hour of day", async () => {
    // A prompt that fires on noise gets dismissed unread, and that is how the
    // real one gets missed later.
    mount([entry("2026-08-07", 84.6)]);

    await afterLoad();
    expect(offer()).not.toBeInTheDocument();
  });

  it("says nothing when nobody has ever weighed in", async () => {
    mount([]);

    await afterLoad();
    expect(offer()).not.toBeInTheDocument();
  });

  it("ignores a day recorded without a weight", async () => {
    // Measurements and a note are a record of the day, not a weigh-in.
    mount([entry("2026-08-07", null)]);

    await afterLoad();
    expect(offer()).not.toBeInTheDocument();
  });
});
