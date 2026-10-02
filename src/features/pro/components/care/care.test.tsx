import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CareRepositoryProvider } from "../../data/care-repository-context";
import { fakeCareRepository, myLink } from "../../data/fake-care-repository.test-helper";
import { fakeProRepository } from "../../data/fake-pro-repository.test-helper";
import { ProRepositoryProvider } from "../../data/pro-repository-context";
import type { InviteInfo } from "../../types/care";
import type { MyAccess } from "../../types/professional";
import { CareSection } from "./care-section";
import { InviteScreen } from "./invite-screen";

const VALID: InviteInfo = { state: "valid", professionalName: "Marina Faria", council: "CRN-3 12345", isOwn: false };
const SIGNED_IN: MyAccess = { isAdmin: false, professional: null };

function invite(info: InviteInfo, access: MyAccess | null = SIGNED_IN) {
  const care = fakeCareRepository({ invite: info });
  render(
    <ProRepositoryProvider repository={fakeProRepository({ access })}>
      <CareRepositoryProvider repository={care}>
        <InviteScreen token="tok123" />
      </CareRepositoryProvider>
    </ProRepositoryProvider>,
  );
  return care;
}

describe("página do convite", () => {
  it("com conta: as opções já vêm marcadas, Treinos também, e o aceite manda o que ficou marcado", async () => {
    const care = invite(VALID);
    expect(await screen.findByText("Marina Faria")).toBeInTheDocument();
    expect(screen.getByLabelText(/Diário alimentar/)).toBeChecked();
    expect(screen.getByLabelText(/Evolução física/)).toBeChecked();
    expect(screen.getByLabelText(/^Treinos/)).toBeChecked();
    await userEvent.click(screen.getByLabelText(/Dados do perfil/));
    await userEvent.click(screen.getByRole("button", { name: "Aceitar" }));
    expect(care.calls).toEqual(["accept:tok123:DTE-"]);
    expect(await screen.findByText("Marina Faria agora acompanha você.")).toBeInTheDocument();
  });

  it("sem conta: entrar e criar conta voltam para o convite", async () => {
    invite(VALID, null);
    const login = await screen.findByRole("link", { name: "Entrar" });
    expect(login).toHaveAttribute("href", "/entrar?next=%2Fconvite%2Ftok123");
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/cadastro?next=%2Fconvite%2Ftok123");
    expect(screen.queryByRole("button", { name: "Aceitar" })).not.toBeInTheDocument();
  });

  it("usado, vencido e inválido dizem o que fazer, sem aceitar", async () => {
    invite({ ...VALID, state: "expired" });
    expect(await screen.findByText(/Este convite venceu/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aceitar" })).not.toBeInTheDocument();
  });

  it("a própria profissional não aceita o próprio convite", async () => {
    invite({ ...VALID, isOwn: true });
    expect(await screen.findByText(/Este é o seu convite/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aceitar" })).not.toBeInTheDocument();
  });
});

describe("Acompanhamento no Perfil", () => {
  function section(links = [myLink({ linkId: "l1" })]) {
    const care = fakeCareRepository({ myLinks: links });
    render(
      <CareRepositoryProvider repository={care}>
        <CareSection />
      </CareRepositoryProvider>,
    );
    return care;
  }

  it("sem vínculo não aparece", async () => {
    const { container } = render(
      <CareRepositoryProvider repository={fakeCareRepository({})}>
        <CareSection />
      </CareRepositoryProvider>,
    );
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("mostra quem acompanha e o que vê; muda o que vê", async () => {
    const care = section();
    expect(await screen.findByText("Diário alimentar, evolução física e dados do perfil")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Mudar o que ela vê" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.click(within(dialog).getByLabelText(/Evolução física/));
    // Vínculo de antes da Etapa 6: Treinos vem desligado, e o paciente liga aqui.
    expect(within(dialog).getByLabelText(/^Treinos/)).not.toBeChecked();
    await userEvent.click(within(dialog).getByLabelText(/^Treinos/));
    await userEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(care.calls).toEqual(["share:l1:DT-P"]);
  });

  it("encerrar pede um segundo toque e não some com o cartão", async () => {
    const care = section();
    const end = await screen.findByRole("button", { name: "Encerrar acompanhamento com Marina Faria" });
    await userEvent.click(end);
    expect(care.calls).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: /Encerrar/ }));
    expect(care.calls).toEqual(["end:l1"]);
    expect(await screen.findByText(/Ela não vê mais seu diário/)).toBeInTheDocument();
  });
});
