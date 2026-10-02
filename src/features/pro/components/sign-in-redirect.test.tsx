import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { fakeProRepository } from "../data/fake-pro-repository.test-helper";
import { ProRepositoryProvider } from "../data/pro-repository-context";
import { AdminShell } from "./admin/admin-shell";
import { ProShell } from "./pro/pro-shell";

const replace = vi.fn();
let pathname = "/pro/pacientes";
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => ({ replace }) }));
vi.mock("@/design-system/theme/theme-toggle", () => ({ ThemeToggle: () => null }));

/**
 * Sem conta, Life Pro e administração não mostram nada da área: levam para
 * Entrar e voltam para a mesma página depois (pedido do Pedro antes de
 * publicar, 01/10/2026). Com conta e sem acesso, continua o aviso de sempre.
 */
describe("Life Pro e administração sem conta", () => {
  for (const [path, Shell] of [
    ["/pro/pacientes", ProShell],
    ["/admin", AdminShell],
  ] as const) {
    it(`${path}: vai para Entrar e volta para ${path}`, async () => {
      pathname = path;
      replace.mockClear();
      render(
        <ProRepositoryProvider repository={fakeProRepository({ access: null })}>
          <Shell>
            <p>conteúdo da área</p>
          </Shell>
        </ProRepositoryProvider>,
      );
      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith(`/entrar?next=${encodeURIComponent(path)}`);
      });
      expect(screen.queryByText("conteúdo da área")).not.toBeInTheDocument();
      expect(screen.queryByText(/profissionais aprovados|só da administração/)).not.toBeInTheDocument();
    });
  }

  it("com conta e sem aprovação, o aviso continua, sem redirecionar", async () => {
    pathname = "/pro";
    replace.mockClear();
    render(
      <ProRepositoryProvider repository={fakeProRepository({ access: { isAdmin: false, professional: null } })}>
        <ProShell>
          <p>conteúdo da área</p>
        </ProShell>
      </ProRepositoryProvider>,
    );
    expect(await screen.findByText("O Life Pro é para profissionais aprovados.")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
