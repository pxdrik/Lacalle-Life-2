import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import type { NutritionProfile } from "@/core/nutrition";
import { DensityProvider } from "@/design-system/density/density-provider";
import { ThemeProvider } from "@/design-system/theme/theme-provider";
import { BodyRepositoryProvider } from "@/features/body/data/body-repository-context";
import { BODY_ENTRIES_STORE } from "@/features/body/data/body-repository";
import { LocalBodyRepository } from "@/features/body/data/local-body-repository";
import type { BodyEntry } from "@/features/body/types/body-entry";

import { BackupRepositoryProvider } from "../data/backup-repository-context";
import type { BackupRepository } from "../data/backup-repository";
import { LocalProfileRepository } from "../data/local-profile-repository";
import { ProfileRepositoryProvider } from "../data/profile-repository-context";
import { PROFILE_STORE } from "../data/profile-repository";
import { PROFILE_ID, type Profile } from "../types/profile";
import { ProfileScreen } from "./profile-screen";

/**
 * Reproduces the exact sequence the 2026-08-24 pre-deploy review found
 * broken: a conflict, a click on "Recarregar dados", and then — the part
 * the earlier fix missed — whether the form actually shows what was
 * reloaded, or silently keeps re-rendering the edit that just got rejected.
 *
 * `ProfileForm` seeds its draft from `initial` through a lazy `useState`
 * initializer, which only ever runs once per mount. Before `key={updatedAt}`
 * existed on the call site in `ProfileScreen`, `reload()` refreshed
 * `useProfile`'s state correctly but the form kept showing the stale draft
 * — meaning a second "Salvar" would silently succeed (the version is fresh
 * now) and overwrite whatever the other tab had just saved, with no visual
 * sign anything was wrong. This test fails on that regression and passes
 * only once the reload genuinely reaches the screen.
 */

const INITIAL: NutritionProfile = {
  sex: "male",
  ageYears: 30,
  heightCm: 175,
  weightKg: 70,
  activityLevel: "moderate",
  goal: "maintain",
};

const noopBackup: BackupRepository = {
  exportAll: () => Promise.resolve({}),
  previewImport: () =>
    Promise.resolve({
      ok: true,
      recordCount: 0,
      sanitizedCount: 0,
      discardedCount: 0,
    }),
  importAll: () =>
    Promise.resolve({
      ok: true,
      recordCount: 0,
      sanitizedCount: 0,
      discardedCount: 0,
    }),
  forgetDevice: () => Promise.resolve({ ok: true }),
};

function profile(nutrition: NutritionProfile, updatedAt: number): Profile {
  return { id: PROFILE_ID, nutrition, createdAt: 1, updatedAt };
}

/** jsdom has no `matchMedia`; `ThemeProvider` needs one to mount at all. */
beforeEach(() => {
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

function mount(
  repository: LocalProfileRepository,
  props: { readonly account?: React.ReactNode; readonly accountFirst?: boolean } = {},
) {
  const bodyRepository = new LocalBodyRepository(
    new MemoryStore<BodyEntry>(BODY_ENTRIES_STORE),
  );

  render(
    <ThemeProvider>
      <DensityProvider>
        <ProfileRepositoryProvider repository={Promise.resolve(repository)}>
          <BodyRepositoryProvider repository={Promise.resolve(bodyRepository)}>
            <BackupRepositoryProvider repository={Promise.resolve(noopBackup)}>
              <ProfileScreen {...props} />
            </BackupRepositoryProvider>
          </BodyRepositoryProvider>
        </ProfileRepositoryProvider>
      </DensityProvider>
    </ThemeProvider>,
  );
}

describe("ProfileScreen — conflict recovery", () => {
  it("shows the freshly reloaded weight, not the stale draft, after Recarregar dados", async () => {
    const user = userEvent.setup();
    const store = new MemoryStore<Profile>(PROFILE_STORE);
    const repository = new LocalProfileRepository(store);
    await repository.save(profile(INITIAL, 1), null);

    mount(repository);

    await user.click(await screen.findByRole("button", { name: "Editar dados" }));
    const weightField = await screen.findByLabelText("Peso (kg)");
    expect(weightField).toHaveValue("70");

    // Tab A starts typing a new weight — the edit that will be stale.
    await user.clear(weightField);
    await user.type(weightField, "72");

    // Tab B, meanwhile, saves a different weight directly through the same
    // store — exactly what a second tab does, bypassing this screen's hook
    // entirely, the same way the production audit reproduced it.
    await repository.save(profile({ ...INITIAL, weightKg: 90 }, 2), 1);

    // Tab A submits its stale draft — rejected as a conflict, since it still
    // expects version 1 and the store is now at version 2.
    await user.click(screen.getByRole("button", { name: "Calcular metas" }));

    const reloadButton = await screen.findByRole("button", {
      name: "Recarregar dados",
    });

    // The regression under test: without the fix, the field below still
    // reads "72" (Tab A's stale draft) even after the reload button appears.
    await user.click(reloadButton);

    await waitFor(async () => {
      expect(await screen.findByLabelText("Peso (kg)")).toHaveValue("90");
    });

    // And the stale "72" is gone — not just "90 also appeared somewhere".
    expect(screen.queryByDisplayValue("72")).not.toBeInTheDocument();
  });

  it("does not silently overwrite the other tab's save after a reload", async () => {
    const user = userEvent.setup();
    const store = new MemoryStore<Profile>(PROFILE_STORE);
    const repository = new LocalProfileRepository(store);
    await repository.save(profile(INITIAL, 1), null);

    mount(repository);

    await user.click(await screen.findByRole("button", { name: "Editar dados" }));
    const weightField = await screen.findByLabelText("Peso (kg)");
    await user.clear(weightField);
    await user.type(weightField, "72");

    await repository.save(profile({ ...INITIAL, weightKg: 90 }, 2), 1);
    await user.click(screen.getByRole("button", { name: "Calcular metas" }));

    const reloadButton = await screen.findByRole("button", {
      name: "Recarregar dados",
    });
    await user.click(reloadButton);
    await waitFor(async () => {
      expect(await screen.findByLabelText("Peso (kg)")).toHaveValue("90");
    });

    // Submitting again now saves the reloaded value (90), which the person
    // can see on screen — never the "72" that was silently discarded.
    await user.click(screen.getByRole("button", { name: "Calcular metas" }));

    await waitFor(async () => {
      const stored = await repository.get();
      expect(stored?.nutrition.weightKg).toBe(90);
    });
  });
});

/**
 * External audit (27/08/2026): "Dados e segurança" closed itself partway
 * through choosing a backup file to import — right when the preview,
 * confirmation and any error that follows are what someone most needs to
 * see. Since 9.1 (30/09/2026) the section is "Dados e privacidade" and is
 * never collapsed, so there is nothing left to close; what these tests keep
 * guaranteeing is that the import preview is on screen and stays there
 * through the re-renders choosing a file causes.
 */
describe("ProfileScreen — Dados e privacidade", () => {
  function chooseFile(contents: string, name = "backup.json") {
    const input = document.querySelector('input[type="file"]');
    if (input === null) throw new Error("file input not found");

    const file = new File([contents], name, { type: "application/json" });
    Object.defineProperty(input, "files", { value: [file] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  it("is always open, with nothing to collapse, and keeps the import preview on screen", async () => {
    const store = new MemoryStore<Profile>(PROFILE_STORE);
    const repository = new LocalProfileRepository(store);
    await repository.save(profile(INITIAL, 1), null);

    mount(repository);

    const heading = await screen.findByRole("heading", { name: "Dados e privacidade" });
    expect(heading.closest("details")).toBeNull();

    chooseFile('{"schemaVersion":1}');
    expect(await screen.findByText("Este arquivo contém 0 registros.")).toBeVisible();
  });

  it("holds the profile's own delete, away from Editar dados", async () => {
    const store = new MemoryStore<Profile>(PROFILE_STORE);
    const repository = new LocalProfileRepository(store);
    await repository.save(profile(INITIAL, 1), null);

    mount(repository);

    const section = (await screen.findByRole("heading", { name: "Dados e privacidade" })).closest("section")!;
    const remove = await screen.findByRole("button", { name: "Apagar dados do perfil" });
    expect(section.contains(remove)).toBe(true);

    const edit = screen.getByRole("button", { name: "Editar dados" });
    expect(section.contains(edit)).toBe(false);
  });
});

/** Roadmap 9.1 (30/09/2026): a aba reorganizada, como no protótipo aprovado. */
describe("ProfileScreen — reorganização (9.1)", () => {
  const ACCOUNT = <section><h2>Conta e sincronização</h2></section>;

  async function headings() {
    await screen.findByRole("heading", { name: "Seus dados" });
    return screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
  }

  async function filled(nutrition: NutritionProfile = INITIAL) {
    const repository = new LocalProfileRepository(new MemoryStore<Profile>(PROFILE_STORE));
    await repository.save(profile(nutrition, 1), null);
    return repository;
  }

  it("com conta: plano, dados, aparência, conta, dados e privacidade", async () => {
    mount(await filled(), { account: ACCOUNT });

    await screen.findByRole("heading", { name: "Seu plano" });
    // Na ordem; o painel de backup traz o próprio título ("Backup") dentro
    // de "Dados e privacidade", depois dele.
    const order = ["Seu plano", "Seus dados", "Aparência", "Conta e sincronização", "Dados e privacidade"];
    const found = await headings();
    expect(order.map((name) => found.indexOf(name))).toEqual([0, 1, 2, 3, 4]);
  });

  it("sem conta: a conta vem antes de tudo", async () => {
    mount(await filled(), { account: ACCOUNT, accountFirst: true });

    await screen.findByRole("heading", { name: "Seu plano" });
    expect((await headings())[0]).toBe("Conta e sincronização");
  });

  it("sem perfil: não há plano, e Seus dados é o formulário em três grupos", async () => {
    mount(new LocalProfileRepository(new MemoryStore<Profile>(PROFILE_STORE)));

    expect(await headings()).not.toContain("Seu plano");
    expect(screen.getByText(/Preencha para ver suas metas/)).toBeInTheDocument();
    for (const group of ["Sobre você", "Rotina e objetivo", "Opcional"]) {
      expect(screen.getByRole("heading", { name: group })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Calcular metas" })).toBeInTheDocument();
  });

  it("o resumo mostra o que foi informado; opcional em branco é Não informado, e Manter não tem ritmo", async () => {
    mount(await filled());

    const summary = (await screen.findByRole("heading", { name: "Seus dados" })).closest("section")!;
    const row = (label: RegExp) => [...summary.querySelectorAll("dl > div")].find((div) => label.test(div.querySelector("dt")?.textContent ?? ""))?.querySelector("dd")?.textContent;

    expect(row(/^Sexo/)).toBe("Masculino");
    expect(row(/^Idade/)).toBe("30 anos");
    expect(row(/^Altura/)).toBe("175 cm");
    expect(row(/^Peso/)).toBe("70 kg");
    expect(row(/^Atividade/)).toBe("Moderado");
    expect(row(/^Objetivo/)).toBe("Manter");
    expect(row(/^Gordura corporal/)).toBe("Não informado");
    expect(row(/^Ritmo/)).toBeUndefined();
  });

  it("com objetivo de perder gordura, o ritmo aparece", async () => {
    mount(await filled({ ...INITIAL, goal: "cut", weeklyChangeKg: 0.5, bodyFatPercent: 18 }));

    const summary = (await screen.findByRole("heading", { name: "Seus dados" })).closest("section")!;
    expect(summary.textContent).toContain("0,5 kg/semana");
    expect(summary.textContent).toContain("18%");
  });
});
