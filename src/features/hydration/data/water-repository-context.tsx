"use client";

import { createContext, useContext } from "react";

import type { WaterRepository } from "./water-repository";

const WaterRepositoryContext =
  createContext<Promise<WaterRepository> | null>(null);

export function WaterRepositoryProvider({
  repository,
  children,
}: {
  readonly repository: Promise<WaterRepository>;
  readonly children: React.ReactNode;
}) {
  return (
    <WaterRepositoryContext value={repository}>
      {children}
    </WaterRepositoryContext>
  );
}

export function useWaterRepository(): Promise<WaterRepository> {
  const repository = useContext(WaterRepositoryContext);

  if (repository === null) {
    throw new Error(
      "useWaterRepository must be used within a WaterRepositoryProvider.",
    );
  }

  return repository;
}
