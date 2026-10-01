import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CareRepositoryProvider } from "../data/care-repository-context";
import { fakeCareRepository } from "../data/fake-care-repository.test-helper";
import { fakeProRepository } from "../data/fake-pro-repository.test-helper";
import { ProRepositoryProvider } from "../data/pro-repository-context";
import type { MyAccess, OwnProfessional } from "../types/professional";
import { ProAccessSections } from "./pro-access-sections";

function mount(access: MyAccess | null) {
  const repository = fakeProRepository({ access });
  render(
    <ProRepositoryProvider repository={repository}>
      <CareRepositoryProvider repository={fakeCareRepository({})}>
        <ProAccessSections />
      </CareRepositoryProvider>
    </ProRepositoryProvider>,
  );
  return repository;
}

const own = (overrides: Partial<OwnProfessional>): OwnProfessional => ({
  status: "pending",
  displayName: "Marina Faria",
  councilRegion: "CRN-3",
  councilNumber: "12345",
  rejectionReason: null,
  ...overrides,
});

describe("Área profissional no Perfil", () => {
  it("sem conta não mostra nada", async () => {
    const { container } = render(
      <ProRepositoryProvider repository={fakeProRepository({ access: null })}>
        <CareRepositoryProvider repository={fakeCareRepository({})}>
          <ProAccessSections />
        </CareRepositoryProvider>
      </ProRepositoryProvider>,
    );
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("pede acesso: o envio só liga com a declaração, e manda só os números do CRN", async () => {
    const repository = mount({ isAdmin: false, professional: null });
    await userEvent.click(await screen.findByRole("button", { name: "Pedir acesso ao Life Pro" }));

    await userEvent.type(screen.getByLabelText("Nome profissional"), "Marina Faria");
    await userEvent.type(screen.getByLabelText("Número do CRN"), "12.345");
    await userEvent.selectOptions(screen.getByLabelText("Região"), "CRN-3");
    const send = screen.getByRole("button", { name: "Enviar pedido" });
    expect(send).toBeDisabled();

    await userEvent.click(screen.getByLabelText("Os dados acima são meus e estão corretos."));
    await userEvent.click(send);

    expect(repository.calls).toEqual(["request:Marina Faria|CRN-3|12345"]);
    expect(await screen.findByText("Em análise")).toBeInTheDocument();
  });

  it("não envia sem nome, região e número, e diz o que falta", async () => {
    const repository = mount({ isAdmin: false, professional: null });
    await userEvent.click(await screen.findByRole("button", { name: "Pedir acesso ao Life Pro" }));
    await userEvent.click(screen.getByLabelText("Os dados acima são meus e estão corretos."));
    await userEvent.click(screen.getByRole("button", { name: "Enviar pedido" }));
    expect(repository.calls).toEqual([]);
    expect(screen.getByText("Escolha a região do seu CRN.")).toBeInTheDocument();
    expect(screen.getByText("Use só os números do registro.")).toBeInTheDocument();
  });

  it("recusado mostra o motivo e reabre o formulário preenchido", async () => {
    mount({ isAdmin: false, professional: own({ status: "rejected", rejectionReason: "name_mismatch" }) });
    expect(await screen.findByText(/O nome do pedido não confere/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Corrigir e enviar de novo" }));
    expect(screen.getByLabelText("Nome profissional")).toHaveValue("Marina Faria");
    expect(screen.getByLabelText("Número do CRN")).toHaveValue("12345");
  });

  it("aprovado e suspenso", async () => {
    mount({ isAdmin: false, professional: own({ status: "suspended" }) });
    expect(await screen.findByText(/Seu acesso ao Life Pro está suspenso/)).toBeInTheDocument();
  });

  it("Administração só aparece para o administrador", async () => {
    mount({ isAdmin: false, professional: null });
    await screen.findByText("Área profissional");
    expect(screen.queryByText("Administração")).not.toBeInTheDocument();
  });

  it("o administrador vê a entrada para a administração", async () => {
    mount({ isAdmin: true, professional: null });
    expect(await screen.findByRole("link", { name: "Abrir administração" })).toHaveAttribute("href", "/admin");
  });
});
