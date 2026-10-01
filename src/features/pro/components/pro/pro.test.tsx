import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CareRepositoryProvider } from "../../data/care-repository-context";
import { fakeCareRepository, patientLink } from "../../data/fake-care-repository.test-helper";
import { fakeProRepository } from "../../data/fake-pro-repository.test-helper";
import { ProRepositoryProvider } from "../../data/pro-repository-context";
import type { PatientLink, PendingInvite } from "../../types/care";
import type { MyAccess } from "../../types/professional";
import { ProPatients } from "./pro-patients";
import { ProShell } from "./pro-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/pro/pacientes" }));
vi.mock("@/design-system/theme/theme-toggle", () => ({ ThemeToggle: () => null }));

const APPROVED: MyAccess = {
  isAdmin: false,
  professional: { status: "approved", displayName: "Marina Faria", councilRegion: "CRN-3", councilNumber: "1", rejectionReason: null },
};

function mount(access: MyAccess, data: { links?: PatientLink[]; invites?: PendingInvite[] } = {}) {
  const care = fakeCareRepository(data);
  render(
    <ProRepositoryProvider repository={fakeProRepository({ access })}>
      <CareRepositoryProvider repository={care}>
        <ProShell>
          <ProPatients />
        </ProShell>
      </CareRepositoryProvider>
    </ProRepositoryProvider>,
  );
  return care;
}

describe("Life Pro", () => {
  it("só abre para profissional aprovado", async () => {
    mount({ isAdmin: false, professional: { ...APPROVED.professional!, status: "pending" } });
    expect(await screen.findByText("O Life Pro é para profissionais aprovados.")).toBeInTheDocument();
    expect(screen.queryByText("Pacientes", { selector: "h1" })).not.toBeInTheDocument();
  });

  it("sem pacientes: estado vazio que leva ao convite", async () => {
    mount(APPROVED);
    expect(await screen.findByText("Nenhum paciente ainda.")).toBeInTheDocument();
  });

  it("convidar gera o link com o código, e o convite aparece esperando", async () => {
    const care = mount(APPROVED);
    await userEvent.click((await screen.findAllByRole("button", { name: "Adicionar paciente" }))[0]!);
    await userEvent.type(screen.getByLabelText("Nome do paciente"), "Beatriz Nogueira");
    await userEvent.click(screen.getByRole("button", { name: "Gerar link" }));
    expect(care.calls).toEqual(["invite:Beatriz Nogueira"]);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(`${window.location.origin}/convite/abc123`)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Pronto" }));
    expect(await screen.findByText("Convites esperando")).toBeInTheDocument();
  });

  it("cancelar convite e encerrar vínculo (em dois toques)", async () => {
    const care = mount(APPROVED, {
      links: [patientLink({ id: "l1" })],
      invites: [{ id: "i1", label: "Letícia", createdAt: "2026-09-26T12:00:00.000Z", expiresAt: "2099-10-03T12:00:00.000Z" }],
    });
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await userEvent.click(screen.getByRole("button", { name: "Encerrar vínculo com Ana Luísa Prado" }));
    await userEvent.click(screen.getByRole("button", { name: /Encerrar/ }));
    expect(care.calls).toEqual(["cancel:i1", "end:l1"]);
  });
});
