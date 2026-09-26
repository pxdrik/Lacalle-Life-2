import "@testing-library/jest-dom/vitest";
/**
 * O CSS real do app, e é o ponto inteiro desta camada.
 *
 * Sem isto um teste de navegador mediria uma árvore sem estilo nenhum e
 * concordaria com qualquer coisa. Com isto ele mede o que o app mede: as
 * utilidades do Tailwind, os tokens do brandbook, e principalmente o
 * `html { zoom: var(--ui-scale) }` de `tokens.css` com o contra-zoom
 * `input, select, textarea { zoom: calc(1 / var(--ui-scale)) }` — os dois
 * juntos são a razão de `w-16` num `<span>` e `w-16` num `<input>` não terem
 * a mesma largura na tela, que é a origem de metade dos desalinhamentos que
 * a auditoria de 25/09/2026 mediu.
 */
import "./src/app/globals.css";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  // A densidade mora num atributo do `<html>`, fora da árvore que `cleanup`
  // desmonta. Um teste que mede "Confortável" e esquece de limpar entrega o
  // atributo para o próximo arquivo, e o próximo passa ou falha por um
  // motivo que não está escrito nele.
  document.documentElement.removeAttribute("data-density");
});
