"use client";

import { createContext, useContext } from "react";

import type { RoutineRepository } from "./routine-repository";
import type { SessionRepository } from "./session-repository";

/**
 * Routines and sessions travel together: every screen that builds a routine
 * can start one, and every screen that runs a session can name the routine it
 * came from. One provider rather than two saves the pages from wiring the
 * pair by hand each time.
 */
export interface WorkoutRepositories {
  readonly routines: RoutineRepository;
  readonly sessions: SessionRepository;
}

const WorkoutRepositoryContext =
  createContext<Promise<WorkoutRepositories> | null>(null);

export function WorkoutRepositoryProvider({
  repositories,
  children,
}: {
  readonly repositories: Promise<WorkoutRepositories>;
  readonly children: React.ReactNode;
}) {
  return (
    <WorkoutRepositoryContext value={repositories}>
      {children}
    </WorkoutRepositoryContext>
  );
}

export function useWorkoutRepositories(): Promise<WorkoutRepositories> {
  const repositories = useContext(WorkoutRepositoryContext);

  if (repositories === null) {
    throw new Error(
      "useWorkoutRepositories must be used within a WorkoutRepositoryProvider.",
    );
  }

  return repositories;
}
