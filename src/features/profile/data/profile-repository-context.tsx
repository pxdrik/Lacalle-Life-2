"use client";

import { createContext, useContext } from "react";

import type { ProfileRepository } from "./profile-repository";

const ProfileRepositoryContext =
  createContext<Promise<ProfileRepository> | null>(null);

export function ProfileRepositoryProvider({
  repository,
  children,
}: {
  readonly repository: Promise<ProfileRepository>;
  readonly children: React.ReactNode;
}) {
  return (
    <ProfileRepositoryContext value={repository}>
      {children}
    </ProfileRepositoryContext>
  );
}

/** For screens that exist to edit the profile, where absence is a wiring bug. */
export function useProfileRepository(): Promise<ProfileRepository> {
  const repository = useContext(ProfileRepositoryContext);

  if (repository === null) {
    throw new Error(
      "useProfileRepository must be used within a ProfileRepositoryProvider.",
    );
  }

  return repository;
}

/**
 * For screens that merely *offer* something extra when a profile exists.
 *
 * Returns `null` instead of throwing, because "no provider mounted" is a
 * legitimate answer to "are there targets?" — the same answer as "no profile
 * filled in". Building a diet must not depend on the profile feature being
 * present at all, and a hook that throws would make it depend on exactly that.
 */
export function useOptionalProfileRepository(): Promise<ProfileRepository> | null {
  return useContext(ProfileRepositoryContext);
}
