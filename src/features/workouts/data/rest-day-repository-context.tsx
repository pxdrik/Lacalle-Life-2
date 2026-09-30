"use client";

import { createContext, useContext } from "react";

import type { RestDayRepository } from "./rest-day-repository";

const RestDayRepositoryContext =
  createContext<Promise<RestDayRepository> | null>(null);

export function RestDayRepositoryProvider({
  repository,
  children,
}: {
  readonly repository: Promise<RestDayRepository>;
  readonly children: React.ReactNode;
}) {
  return (
    <RestDayRepositoryContext value={repository}>
      {children}
    </RestDayRepositoryContext>
  );
}

export function useRestDayRepository(): Promise<RestDayRepository> {
  const repository = useContext(RestDayRepositoryContext);

  if (repository === null) {
    throw new Error(
      "useRestDayRepository must be used within a RestDayRepositoryProvider.",
    );
  }

  return repository;
}
