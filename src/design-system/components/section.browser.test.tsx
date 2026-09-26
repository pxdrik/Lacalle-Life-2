import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DENSITIES, PHONE_WIDTHS, setDensity, setViewport } from "@/test/geometry";

import { Section } from "./section";

/**
 * FINAL-UI-01 — a hierarquia dos três registros de `Section`.
 *
 * Até a Sprint 5 o app tinha nove cabeçalhos escritos à mão com as mesmas
 * classes de `sub`, e nenhum lugar onde a relação entre os três registros
 * estivesse afirmada. Este é esse lugar: `default` > `sub` > `compact` em
 * presença, medido depois do layout, não deduzido das strings.
 */
describe("FINAL-UI-01 — hierarquia dos tamanhos", () => {
  function titleOf(size: "default" | "sub" | "compact") {
    const { unmount } = render(
      <Section size={size} title="Título">
        <p>conteúdo</p>
      </Section>,
    );
    const heading = screen.getByRole("heading", { name: "Título" });
    const style = getComputedStyle(heading);

    return {
      size: Number.parseFloat(style.fontSize),
      weight: Number(style.fontWeight),
      color: style.color,
      unmount,
    };
  }

  it("desce de tamanho de default para sub para compact", async () => {
    await setViewport(390, 800);

    const big = titleOf("default");
    const bigSize = big.size;
    big.unmount();

    const mid = titleOf("sub");
    const midSize = mid.size;
    const midColor = mid.color;
    mid.unmount();

    const small = titleOf("compact");
    const smallSize = small.size;
    const smallColor = small.color;
    small.unmount();

    expect(bigSize).toBeGreaterThan(midSize);
    expect(midSize).toBeGreaterThan(smallSize);

    // `sub` é tinta cheia; `compact` é rótulo, e rótulo é `ink-subtle`.
    expect(midColor).not.toBe(smallColor);
  });

  it("dá ao subtítulo o tom de caption, não o de leitura secundária", async () => {
    await setViewport(390, 800);
    render(
      <Section size="sub" title="Título" subtitle="Legenda">
        <p>conteúdo</p>
      </Section>,
    );

    const caption = screen.getByText("Legenda");
    const probe = document.createElement("span");
    probe.className = "text-ink-subtle";
    document.body.append(probe);

    expect(getComputedStyle(caption).color).toBe(
      getComputedStyle(probe).color,
    );
    probe.remove();
  });

  /** FINAL-UI-02 — título longo não empurra a seção para fora da tela. */
  for (const width of PHONE_WIDTHS) {
    for (const density of DENSITIES) {
      it(`cabe com título longo em ${String(width)}px/${density}`, async () => {
        await setViewport(width, 800);
        setDensity(density);
        render(
          <Section
            size="sub"
            title="Série mais pesada e melhor estimativa de 1RM"
            subtitle="Últimas 12 semanas, refeições marcadas contra o planejado"
            action={<a href="/x">Ver mais</a>}
          >
            <p>conteúdo</p>
          </Section>,
        );

        const section = document.querySelector("section")!;

        expect(section.scrollWidth - section.clientWidth).toBeLessThanOrEqual(0);
        expect(
          document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ).toBeLessThanOrEqual(0);
      });
    }
  }
});
