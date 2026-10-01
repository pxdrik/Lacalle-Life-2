import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CareRepositoryProvider } from "../../data/care-repository-context";
import { fakeCareRepository } from "../../data/fake-care-repository.test-helper";
import { fakeProRepository, record } from "../../data/fake-pro-repository.test-helper";
import { ProRepositoryProvider } from "../../data/pro-repository-context";
import type { MyAccess, ProfessionalRecord } from "../../types/professional";
import { AdminApproved } from "./admin-approved";
import { AdminRequests } from "./admin-requests";
import { AdminShell } from "./admin-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));
// O seletor de tema da casca precisa de matchMedia e do ThemeProvider; nada
// aqui é sobre tema.
vi.mock("@/design-system/theme/theme-toggle", () => ({ ThemeToggle: () => null }));

function mount(
  page: React.ReactNode,
  professionals: readonly ProfessionalRecord[],
  access: MyAccess | null = { isAdmin: true, professional: null },
) {
  const repository = fakeProRepository({ access, professionals });
  render(
    <ProRepositoryProvider repository={repository}>
      <CareRepositoryProvider repository={fakeCareRepository({})}>
        <AdminShell>{page}</AdminShell>
      </CareRepositoryProvider>
    </ProRepositoryProvider>,
  );
  return repository;
}

describe("Administração", () => {
  it("quem não é administrador vê só o aviso", async () => {
    mount(<AdminRequests />, [record({ userId: "b" })], { isAdmin: false, professional: null });
    expect(await screen.findByText("Esta área é só da administração do LaCalle.")).toBeInTheDocument();
    expect(screen.queryByText("Beatriz Nogueira")).not.toBeInTheDocument();
  });

  it("aprovar só liga depois de confirmar a conferência", async () => {
    const repository = mount(<AdminRequests />, [record({ userId: "b" }), record({ userId: "c", displayName: "Carlos Mendes" })]);
    await userEvent.click(await screen.findByRole("button", { name: "Conferir o pedido de Beatriz Nogueira" }));
    const approve = screen.getByRole("button", { name: "Aprovar" });
    expect(approve).toBeDisabled();
    await userEvent.click(screen.getByLabelText(/O registro existe, está ativo/));
    await userEvent.click(approve);
    expect(repository.calls).toEqual(["approve:b"]);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Conferir o pedido de Beatriz Nogueira" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Conferir o pedido de Carlos Mendes" })).toBeInTheDocument();
  });

  it("recusar manda o motivo escolhido e mostra o texto que a pessoa vai ler", async () => {
    const repository = mount(<AdminRequests />, [record({ userId: "b" })]);
    await userEvent.click(await screen.findByRole("button", { name: "Conferir o pedido de Beatriz Nogueira" }));
    await userEvent.click(screen.getByRole("button", { name: "Recusar" }));
    await userEvent.click(screen.getByLabelText("Registro inativo"));
    expect(screen.getByText(/O registro aparece como inativo no conselho/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Recusar pedido" }));
    expect(repository.calls).toEqual(["reject:b:inactive"]);
  });

  it("o número de pedidos aparece na navegação", async () => {
    mount(<AdminRequests />, [record({ userId: "b" }), record({ userId: "c" }), record({ userId: "d", status: "approved" })]);
    const nav = (await screen.findAllByRole("navigation", { name: "Administração" }))[0]!;
    await waitFor(() => {
      expect(within(nav).getByRole("link", { name: /Pedidos/ })).toHaveTextContent("2");
    });
  });

  it("aprovados: detalhes e suspender em dois toques", async () => {
    const repository = mount(<AdminApproved />, [record({ userId: "m", displayName: "Marina Faria", status: "approved" })]);
    await userEvent.click(await screen.findByRole("button", { name: "Ver Marina Faria" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("CRN-3 · 12345")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Suspender Marina Faria" }));
    expect(repository.calls).toEqual([]);
    await userEvent.click(within(dialog).getByRole("button", { name: /Suspender/ }));
    expect(repository.calls).toEqual(["suspend:m"]);
  });
});
