import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "./button";

/**
 * Roadmap 8.10 (30/09/2026): no claro, só o botão principal usa o Verdant
 * mais claro (#31AA73). Logo, anel de foco, meio círculo e bordas seguem no
 * acento (#2A9162). No escuro, o botão segue o acento. A régua é a cor
 * resolvida no navegador, não o nome da classe.
 */
function colorOf(className: string): string {
  const probe = document.createElement("span");
  probe.className = className;
  document.body.append(probe);
  const value = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return value;
}

describe("8.10 — o botão principal clareia, o resto do acento não", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("claro: botão em #31AA73, acento em #2A9162", () => {
    document.documentElement.setAttribute("data-theme", "light");
    render(<Button>Retomar</Button>);

    expect(getComputedStyle(screen.getByRole("button")).backgroundColor).toBe("rgb(49, 170, 115)");
    expect(colorOf("bg-accent")).toBe("rgb(42, 145, 98)");
  });

  it("escuro: botão segue o acento", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    render(<Button>Retomar</Button>);

    expect(getComputedStyle(screen.getByRole("button")).backgroundColor).toBe(colorOf("bg-accent"));
  });
});
