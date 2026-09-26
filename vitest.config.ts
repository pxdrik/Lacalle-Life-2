import { fileURLToPath } from "node:url";

import tailwind from "@tailwindcss/postcss";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

/**
 * O mesmo Tailwind de `postcss.config.mjs`, declarado como função.
 *
 * `postcss.config.mjs` lista o plugin como **string**, que é o formato que o
 * Next resolve sozinho e que o PostCSS puro recusa ("Invalid PostCSS Plugin
 * found at: plugins[0]"). Em vez de reescrever aquele arquivo e arriscar o
 * build do Next, o Vite dos testes recebe aqui a sua própria declaração.
 * É o mesmo plugin, então o CSS que o teste mede é o CSS que o app publica.
 */
const css = { postcss: { plugins: [tailwind()] } };

/**
 * Duas camadas, e a divisão entre elas é a lição mais cara desta auditoria.
 *
 * **jsdom não tem motor de layout.** Ele não calcula largura, não resolve
 * `flex`, não aplica `zoom`, e todo `getBoundingClientRect` devolve zero. Em
 * 25/09/2026 o projeto tinha 1936 testes verdes enquanto a aba Treino
 * mostrava um rótulo transbordando por cima da coluna vizinha, uma linha de
 * série estourando o card em 360px, e cinco botões cujas áreas de toque se
 * sobrepunham 12px. Nenhum dos 1936 podia ver nada disso: não é falta de
 * teste, é falta de instrumento.
 *
 * Então: lógica, estado, persistência e transformação continuam em `unit`,
 * que é rápido e roda em qualquer lugar. Geometria, transbordo, alinhamento e
 * hitbox vão para `browser`, que abre um Chromium de verdade e mede.
 *
 * A regra para escolher: se a asserção é sobre um **número que só existe
 * depois do layout** (posição, largura, quem o ponteiro atinge), é `browser`.
 * Se é sobre o que uma função devolve ou o que foi renderizado, é `unit`.
 * Falsificar `getBoundingClientRect` num teste de `unit` é o sinal de que ele
 * está no projeto errado: a partir daí ele mede o próprio fixture.
 */
export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["src/**/*.test.{ts,tsx}"],
          // `*.browser.test.tsx` também casa com o `include` acima, e um
          // teste de navegador rodando em jsdom não falha por medir errado:
          // ele falha na importação, porque `vitest/browser` só existe
          // dentro do Browser Mode. Sem esta linha, `npm run test` fica
          // vermelho por um arquivo que não é dele.
          exclude: [...configDefaults.exclude, "src/**/*.browser.test.{ts,tsx}"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        css,
        // `next/image` lê `process.env.__NEXT_IMAGE_OPTS` no topo do módulo,
        // e no navegador não existe `process`. O webpack do Next substitui
        // essa expressão no build; aqui o Vite faz o mesmo, por um objeto
        // vazio — nada nestes testes depende da configuração de imagem, mas
        // sem isto o módulo nem carrega e o arquivo inteiro falha na importação.
        define: { "process.env": "{}" },
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.{ts,tsx}"],
          setupFiles: ["./vitest.setup.browser.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            // Um navegador só. O que estes testes medem (transbordo,
            // alinhamento de coluna, área de toque) é aritmética de caixa,
            // não diferença de engine, e um segundo navegador dobraria o
            // tempo para confirmar a mesma conta. Se um dia aparecer um bug
            // específico de WebKit, ele entra aqui com o bug junto.
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
