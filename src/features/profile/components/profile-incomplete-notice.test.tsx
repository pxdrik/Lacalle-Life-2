import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ProfileRepository } from "../data/profile-repository";
import { ProfileRepositoryProvider } from "../data/profile-repository-context";
import type { Profile } from "../types/profile";
import { ProfileIncompleteNotice } from "./profile-incomplete-notice";

const PROFILE: Profile = {
  id: "profile",
  nutrition: {
    sex: "male",
    ageYears: 30,
    heightCm: 180,
    weightKg: 80,
    activityLevel: "moderate",
    goal: "maintain",
  },
  createdAt: 0,
  updatedAt: 0,
};

function mount(profile: Profile | undefined) {
  const repository: ProfileRepository = {
    get: vi.fn().mockResolvedValue(profile),
    save: vi.fn(),
    clear: vi.fn(),
  };

  render(
    <ProfileRepositoryProvider repository={Promise.resolve(repository)}>
      <ProfileIncompleteNotice />
    </ProfileRepositoryProvider>,
  );
}

describe("ProfileIncompleteNotice", () => {
  it("invites completing the profile when there is none", async () => {
    mount(undefined);

    expect(
      await screen.findByText(/Complete seu perfil/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Completar perfil" }),
    ).toHaveAttribute("href", "/perfil");
  });

  it("stays quiet once a profile exists", async () => {
    mount(PROFILE);

    // Waits for the load to settle before asserting the absence — otherwise
    // this would pass trivially against the loading state too.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByText(/Complete seu perfil/)).not.toBeInTheDocument();
  });
});
