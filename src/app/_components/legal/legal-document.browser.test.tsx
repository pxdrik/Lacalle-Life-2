import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AuthRepositoryProvider } from "@/features/auth/data/auth-repository-context";
import type { AuthRepository } from "@/features/auth/data/auth-repository";
import { SignupForm } from "@/features/auth/components/signup-form";
import { ThemeProvider } from "@/design-system/theme/theme-provider";
import {
  DENSITIES,
  DESKTOP_WIDTH,
  PHONE_WIDTHS,
  hitTargetsAcross,
  overflowX,
  setDensity,
  setViewport,
} from "@/test/geometry";

import HealthNoticePage from "../../aviso-de-saude/page";
import PrivacyPage from "../../politica-de-privacidade/page";
import TermsPage from "../../termos-de-uso/page";
import { HealthNotice } from "../landing/health-notice";
import { LandingFooter } from "../landing/landing-footer";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

/**
 * Roadmap 8.4 (30/09/2026): os três documentos legais, o aviso de saúde na
 * landing e o aceite no cadastro, medidos nas larguras e densidades de
 * sempre. Texto longo em página estreita é onde transbordo aparece, e um
 * link que o dedo não acerta não é acessível de verdade.
 */
const PAGES = [
  ["Termos de Uso", TermsPage],
  ["Política de Privacidade", PrivacyPage],
  ["Aviso de Saúde", HealthNoticePage],
] as const;

function pageOverflow(): number {
  return document.documentElement.scrollWidth - document.documentElement.clientWidth;
}

/**
 * O documento em si, sem o cabeçalho da landing: o cabeçalho já estourava a
 * tela antes desta tarefa (até 172px em 320px Confortável, 17px em 390px
 * Padrão), e isso é o roadmap 8.19, com teste próprio quando for corrigido.
 */
function articleOverflow(): number {
  const main = document.querySelector("main")!;
  return Math.max(
    overflowX(main),
    main.getBoundingClientRect().right - document.documentElement.clientWidth,
    ...[...main.querySelectorAll("*")].map(
      (element) => element.getBoundingClientRect().right - main.getBoundingClientRect().right,
    ),
  );
}

describe("8.4 — documentos legais", () => {
  for (const width of [...PHONE_WIDTHS, DESKTOP_WIDTH]) {
    for (const density of DENSITIES) {
      it(`${String(width)}px, ${density}`, async () => {
        await setViewport(width, 900);
        setDensity(density);

        for (const [title, Page] of PAGES) {
          render(<Page />);
          expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
          if (title !== "Aviso de Saúde") {
            // O canal de contato da LGPD, clicável.
            expect(screen.getByRole("link", { name: "lacallepm@gmail.com" })).toHaveAttribute(
              "href",
              "mailto:lacallepm@gmail.com",
            );
          }
          expect(articleOverflow(), `${title} passa da página`).toBeLessThanOrEqual(0.5);
          for (const link of screen.getByRole("navigation", { name: "Outros documentos" }).querySelectorAll("a")) {
            // No fim de uma página longa: fora da tela, `elementFromPoint` não vê nada.
            link.scrollIntoView({ block: "center" });
            for (const hit of hitTargetsAcross(link)) expect(link.contains(hit), link.textContent ?? "").toBe(true);
          }
          cleanup();
        }

        render(
          <>
            <HealthNotice />
            <LandingFooter />
          </>,
        );
        expect(screen.getByRole("link", { name: "Leia o aviso completo" })).toHaveAttribute("href", "/aviso-de-saude");
        const footer = screen.getByRole("navigation", { name: "Documentos legais" });
        expect(footer.querySelectorAll("a")).toHaveLength(3);
        expect(overflowX(footer)).toBeLessThanOrEqual(0);
        expect(pageOverflow()).toBeLessThanOrEqual(0);
        cleanup();
      });
    }
  }
});

describe("8.4 — aceite no cadastro", () => {
  it("tocar no texto marca a caixa; os links não", async () => {
    await setViewport(320, 900);
    setDensity("comfortable");
    const repository: AuthRepository = {
      getUser: vi.fn().mockResolvedValue(null),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updatePassword: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue(() => {}),
    };
    render(
      <ThemeProvider>
        <AuthRepositoryProvider repository={repository}>
          <main className="px-4">
            <SignupForm />
          </main>
        </AuthRepositoryProvider>
      </ThemeProvider>,
    );

    const box = screen.getByRole("checkbox", { name: /Li e aceito/ });
    expect(pageOverflow()).toBeLessThanOrEqual(0);

    // O texto que não é link pertence à caixa: "Li e aceito os".
    const label = box.closest("label")!;
    const range = document.createRange();
    range.selectNodeContents(label.querySelector("span")!.firstChild!);
    const words = range.getBoundingClientRect();
    const target = document.elementFromPoint(
      words.left + words.width / 2,
      words.top + words.height / 2,
    );
    // Quem está desenhado ali é o texto do rótulo, não um link.
    expect(target?.closest("a")).toBeNull();
    expect(label.contains(target)).toBe(true);

    await userEvent.click(target!);
    expect(box).toBeChecked();
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeEnabled();

    for (const link of label.querySelectorAll("a")) {
      expect(link).toHaveAttribute("target", "_blank");
    }
  });
});
