import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import type { NutritionProfile } from "@/core/nutrition";
import { Section } from "@/design-system/components/section";
import { DensityProvider } from "@/design-system/density/density-provider";
import { ThemeProvider } from "@/design-system/theme/theme-provider";
import { AccountStatus } from "@/features/auth/components/account-status";
import { AuthRepositoryProvider } from "@/features/auth/data/auth-repository-context";
import type { AuthRepository } from "@/features/auth/data/auth-repository";
import { BodyRepositoryProvider } from "@/features/body/data/body-repository-context";
import { BODY_ENTRIES_STORE } from "@/features/body/data/body-repository";
import { LocalBodyRepository } from "@/features/body/data/local-body-repository";
import type { BodyEntry } from "@/features/body/types/body-entry";
import {
  DENSITIES,
  DESKTOP_WIDTH,
  PHONE_WIDTHS,
  hitTargetsAcross,
  setDensity,
  setViewport,
} from "@/test/geometry";

import { BackupRepositoryProvider } from "../data/backup-repository-context";
import type { BackupRepository } from "../data/backup-repository";
import { LocalProfileRepository } from "../data/local-profile-repository";
import { ProfileRepositoryProvider } from "../data/profile-repository-context";
import { PROFILE_STORE } from "../data/profile-repository";
import { PROFILE_ID, type Profile } from "../types/profile";
import { ProfileScreen } from "./profile-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));

/**
 * Roadmap 9.1 (30/09/2026): a aba Perfil reorganizada, medida. O resumo
 * "Seus dados" é uma linha por dado, com rótulo, etiqueta "opcional" e
 * valor; a linha mais comprida ("Gordura corporal · opcional · Não
 * informado") é o pior caso de 320px Confortável. O cartão sem conta traz
 * dois botões lado a lado.
 */
const CUT: NutritionProfile = {
  sex: "female",
  ageYears: 34,
  heightCm: 165,
  weightKg: 68.5,
  activityLevel: "moderate",
  goal: "cut",
  weeklyChangeKg: 0.5,
};

const noopBackup: BackupRepository = {
  exportAll: () => Promise.resolve({}),
  previewImport: () => Promise.resolve({ ok: true, recordCount: 0, sanitizedCount: 0, discardedCount: 0 }),
  importAll: () => Promise.resolve({ ok: true, recordCount: 0, sanitizedCount: 0, discardedCount: 0 }),
  forgetDevice: () => Promise.resolve({ ok: true }),
};

const anonymous: AuthRepository = {
  getUser: vi.fn().mockResolvedValue(null),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updatePassword: vi.fn(),
  onAuthStateChange: vi.fn().mockReturnValue(() => {}),
};

async function mount() {
  const repository = new LocalProfileRepository(new MemoryStore<Profile>(PROFILE_STORE));
  await repository.save({ id: PROFILE_ID, nutrition: CUT, createdAt: 1, updatedAt: 1 }, null);
  const body = new LocalBodyRepository(new MemoryStore<BodyEntry>(BODY_ENTRIES_STORE));

  render(
    <ThemeProvider>
      <DensityProvider>
        <main className="px-4">
          <ProfileRepositoryProvider repository={Promise.resolve(repository)}>
            <BodyRepositoryProvider repository={Promise.resolve(body)}>
              <BackupRepositoryProvider repository={Promise.resolve(noopBackup)}>
                <AuthRepositoryProvider repository={anonymous}>
                  <ProfileScreen
                    accountFirst
                    account={
                      <Section title="Conta e sincronização">
                        <AccountStatus />
                      </Section>
                    }
                  />
                </AuthRepositoryProvider>
              </BackupRepositoryProvider>
            </BodyRepositoryProvider>
          </ProfileRepositoryProvider>
        </main>
      </DensityProvider>
    </ThemeProvider>,
  );
}

/**
 * Quantas linhas de texto o elemento ocupa. Só nós de texto: a etiqueta
 * "opcional" tem borda e padding, e a caixa dela começa acima da letra. Topos
 * a menos de meia linha de distância são a mesma linha (a etiqueta tem letra
 * menor e assenta 1 ou 2px deslocada).
 */
function lines(element: Element): number {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const tops: number[] = [];
  const range = document.createRange();
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if ((node.textContent ?? "").trim() === "") continue;
    range.selectNodeContents(node);
    for (const rect of range.getClientRects()) tops.push(rect.top);
  }
  const half = parseFloat(getComputedStyle(element).lineHeight) / 2;
  return tops
    .sort((a, b) => a - b)
    .filter((top, index, all) => index === 0 || top - all[index - 1]! > half).length;
}

describe("9.1 — aba Perfil reorganizada", () => {
  for (const width of [...PHONE_WIDTHS, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 1600);
        setDensity(density);
        await mount();

        const summary = (await screen.findByRole("heading", { name: "Seus dados" })).closest("section")!;
        await screen.findByText("Você está usando sem conta");

        expect(
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
          "a página rola de lado",
        ).toBeLessThanOrEqual(0);

        // Cada rótulo numa linha só (brandbook, "Texto curto não quebra linha").
        for (const term of summary.querySelectorAll("dt")) {
          expect(lines(term), term.textContent ?? "").toBe(1);
          const row = term.parentElement!.getBoundingClientRect();
          const value = term.nextElementSibling!.getBoundingClientRect();
          expect(value.right, `${term.textContent ?? ""} passa da linha`).toBeLessThanOrEqual(row.right + 0.5);
        }

        for (const name of ["Editar dados", "Entrar", "Criar conta"]) {
          const control = screen.getByRole(name === "Editar dados" ? "button" : "link", { name });
          control.scrollIntoView({ block: "center" });
          for (const hit of hitTargetsAcross(control)) {
            expect(control.contains(hit), `toque em ${name}`).toBe(true);
          }
        }
        cleanup();
      });
    }
  }
});
