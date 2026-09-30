import { afterEach, describe, expect, it } from "vitest";

import { mountHtml } from "@/test/geometry";

/**
 * Roadmap 8.2 (29/09/2026): sem zoom de toque duplo, com a pinça mantida.
 *
 * A régua é o `touch-action` resolvido pelo navegador, lido de `globals.css`
 * de verdade. O caso que importa é o de dentro de uma área com rolagem
 * própria: é ali que uma regra só no `html` deixaria o toque duplo voltar.
 */
describe("8.2 — toque duplo não dá zoom", () => {
  let remove = () => {};

  afterEach(() => {
    remove();
  });

  it("vale dentro de uma área com rolagem própria", () => {
    const mounted = mountHtml(
      '<div style="height:100px;overflow-y:auto"><div style="height:400px"><button id="alvo">Série</button></div></div>',
    );
    remove = mounted.remove;
    const target = mounted.root.querySelector("#alvo")!;

    expect(getComputedStyle(target).touchAction).toBe("manipulation");
  });

  it("não tira o touch-none das alças de arrastar", () => {
    const mounted = mountHtml('<button id="alca" class="touch-none">Arrastar</button>');
    remove = mounted.remove;
    const handle = mounted.root.querySelector("#alca")!;

    expect(getComputedStyle(handle).touchAction).toBe("none");
  });
});
