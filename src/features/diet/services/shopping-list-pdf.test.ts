import { describe, expect, it } from "vitest";

import type { ShoppingGroup, ShoppingList } from "./shopping-list";
import { shoppingListPdf } from "./shopping-list-pdf";

const list = (items: ShoppingGroup["items"], title = "Carboidratos"): ShoppingList => ({
  sources: [{ name: "Treino", days: "Seg, Qua" }],
  groups: [{ category: "carb", title, items }],
});

/** O arquivo lido como Latin-1, um caractere por byte, igual ao que foi escrito. */
const read = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join("");

describe("shoppingListPdf", () => {
  it("writes a PDF whose cross-reference table points at every object", () => {
    const pdf = read(shoppingListPdf(list([{ name: "Arroz", unit: "g", amount: 600 }])));

    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf.endsWith("%%EOF\n")).toBe(true);

    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(pdf)![1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");

    const entries = [...pdf.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)];
    expect(entries.length).toBeGreaterThan(4);
    entries.forEach((entry, i) => {
      expect(pdf.slice(Number(entry[1]), Number(entry[1]) + `${i + 1} 0 obj`.length)).toBe(
        `${String(i + 1)} 0 obj`,
      );
    });
  });

  it("declares a stream length that matches the stream", () => {
    const pdf = read(shoppingListPdf(list([{ name: "Arroz", unit: "g", amount: 600 }])));
    const [, length, body] = /<< \/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/.exec(pdf)!;

    expect(body!.length).toBe(Number(length));
  });

  it("writes the title, the diets, the amounts and Portuguese accents as Latin-1 bytes", () => {
    const bytes = shoppingListPdf(
      list([{ name: "Feijão", unit: "g", amount: 2100 }, { name: "Leite", unit: "ml", amount: 300 }]),
    );
    const pdf = read(bytes);

    expect(pdf).toContain("(Lista de compras da semana)");
    expect(pdf).toContain("(Dietas: Treino \\(Seg, Qua\\))");
    expect(pdf).toContain("(2,1 kg)");
    expect(pdf).toContain("(300 ml)");
    expect(pdf).toContain("(Feij\xE3o)"); // ã = 0xE3
    expect(bytes.includes(0xe3)).toBe(true);
  });

  it("escapes parentheses and backslashes so a food name cannot break the file", () => {
    const pdf = read(shoppingListPdf(list([{ name: "Suco (natural) \\ caseiro", unit: "ml", amount: 200 }])));

    expect(pdf).toContain("(Suco \\(natural\\) \\\\ caseiro)");
  });

  it("swaps what Latin-1 cannot draw for something readable, one mark per character", () => {
    const pdf = read(shoppingListPdf(list([{ name: "Pão – integral 🙂", unit: "g", amount: 100 }])));

    expect(pdf).toContain("(P\xE3o - integral ?)");
  });

  it("breaks a long name over lines instead of running off the page", () => {
    const name = "Iogurte grego natural desnatado sem adição de açúcar com pedaços de frutas vermelhas e granola".repeat(2);
    const pdf = read(shoppingListPdf(list([{ name, unit: "g", amount: 500 }])));

    const drawn = [...pdf.matchAll(/\/F1 11 Tf [\d.]+ [\d.]+ Td \((.*?)\) Tj/g)].map((m) => m[1]!);
    expect(drawn.length).toBeGreaterThan(2);
    for (const line of drawn) expect(line.length).toBeLessThanOrEqual(56);
  });

  it("starts a new page when the list does not fit, and counts them right", () => {
    const many = Array.from({ length: 120 }, (_, i) => ({
      name: `Alimento ${String(i)}`,
      unit: "g" as const,
      amount: 100 + i,
    }));
    const pdf = read(shoppingListPdf(list(many)));

    const count = Number(/\/Count (\d+)/.exec(pdf)![1]);
    expect(count).toBeGreaterThan(1);
    expect([...pdf.matchAll(/\/Type \/Page /g)]).toHaveLength(count);
  });
});
