import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";

import { LocalWaterRepository } from "../data/local-water-repository";
import { WaterRepositoryProvider } from "../data/water-repository-context";
import { WATER_ENTRIES_STORE } from "../data/water-repository";
import type { WaterEntry } from "../types/water-entry";
import { useWaterDay } from "./use-water-day";

const DAY = "2026-09-24";

function Probe() {
  const { state, addMl } = useWaterDay(DAY);

  if (state.status !== "ready") return <span data-testid="ml">loading</span>;

  return (
    <>
      <span data-testid="ml">{state.entry.ml}</span>
      <button
        type="button"
        onClick={() => {
          addMl(200);
        }}
      >
        +200
      </button>
      <button
        type="button"
        onClick={() => {
          addMl(-200);
        }}
      >
        -200
      </button>
    </>
  );
}

async function mount() {
  const store = new MemoryStore<WaterEntry>(WATER_ENTRIES_STORE);
  const repository = new LocalWaterRepository(store);

  render(
    <WaterRepositoryProvider repository={Promise.resolve(repository)}>
      <Probe />
    </WaterRepositoryProvider>,
  );

  await waitFor(() => {
    expect(screen.getByTestId("ml").textContent).toBe("0");
  });

  return repository;
}

describe("useWaterDay", () => {
  it("adds to the running total and persists it", async () => {
    const repository = await mount();

    screen.getByText("+200").click();
    screen.getByText("+200").click();

    await waitFor(() => {
      expect(screen.getByTestId("ml").textContent).toBe("400");
    });
    await waitFor(async () => {
      expect((await repository.getByDay(DAY))?.ml).toBe(400);
    });
  });

  it("never goes below 0", async () => {
    await mount();

    screen.getByText("-200").click();

    await waitFor(() => {
      expect(screen.getByTestId("ml").textContent).toBe("0");
    });
  });

  it("removes the day's record once corrected back down to 0, rather than storing an empty day", async () => {
    const repository = await mount();

    screen.getByText("+200").click();
    await waitFor(() => {
      expect(screen.getByTestId("ml").textContent).toBe("200");
    });

    screen.getByText("-200").click();
    await waitFor(() => {
      expect(screen.getByTestId("ml").textContent).toBe("0");
    });
    await waitFor(async () => {
      expect(await repository.getByDay(DAY)).toBeUndefined();
    });
  });
});
