import { playwright } from "@vitest/browser-playwright";
import { defineConfig, mergeConfig } from "vitest/config";

import base from "./vitest.config";

/**
 * A suíte de navegador no WebKit, o motor do Safari, com emulação de celular
 * (toque, `isMobile`, densidade 3). `npm run test:browser:webkit`.
 *
 * Opcional, fora do `verify` e da CI (roadmap 8.7, 30/09/2026): serve para
 * quando um bug aparece só no iPhone. Na investigação do 8.7, todas as falhas
 * que ele mostrava eram da régua (arredondamento de `scrollWidth` com `zoom`,
 * e a caixa de texto do SVG 0,4px mais alta), não do app — e a suíte passou
 * a medir o que importa nos dois motores. Não substitui o aparelho: o zoom
 * automático do iOS e o toque real do Safari não são emuláveis.
 *
 * Precisa do WebKit do Playwright instalado: `npx playwright install webkit`.
 */
interface BrowserProject {
  readonly test: { readonly name?: string; readonly browser: object };
}

const browserProject = (base.test?.projects as unknown as BrowserProject[]).find(
  (project) => project.test.name === "browser",
)!;

// `mergeConfig` concatena listas: sem zerar `instances` aqui, o Chromium do
// projeto original viria junto e este comando rodaria os dois motores.
const withoutInstances = {
  ...browserProject,
  test: {
    ...browserProject.test,
    browser: { ...browserProject.test.browser, instances: [] },
  },
};

export default defineConfig(
  mergeConfig(withoutInstances, {
    test: {
      name: "browser-webkit",
      browser: {
        provider: playwright({
          contextOptions: { isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
        }),
        instances: [{ browser: "webkit" }],
      },
    },
  }),
);
