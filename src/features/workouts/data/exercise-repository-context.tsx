"use client";

import { createContext, useContext } from "react";

import type { ExerciseRepository } from "./exercise-repository";

const ExerciseRepositoryContext =
  createContext<Promise<ExerciseRepository> | null>(null);

export function ExerciseRepositoryProvider({
  repository,
  children,
}: {
  readonly repository: Promise<ExerciseRepository>;
  readonly children: React.ReactNode;
}) {
  return (
    <ExerciseRepositoryContext value={repository}>
      {children}
    </ExerciseRepositoryContext>
  );
}

export function useExerciseRepository(): Promise<ExerciseRepository> {
  const repository = useContext(ExerciseRepositoryContext);

  if (repository === null) {
    throw new Error(
      "useExerciseRepository must be used within an ExerciseRepositoryProvider.",
    );
  }

  return repository;
}
