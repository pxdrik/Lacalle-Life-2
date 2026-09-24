import { entityTimestamp } from "@/core/domain/entity";

import type { WaterEntry } from "../types/water-entry";

export function createWaterEntry(day: string): WaterEntry {
  const now = entityTimestamp();

  return { id: day, day, ml: 0, createdAt: now, updatedAt: now };
}
