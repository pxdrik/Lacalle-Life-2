import { formatAmount, type ShoppingList } from "./shopping-list";

/**
 * A lista em PDF, escrita à mão: uma lista de compras é texto em linhas, e
 * isso cabe em ~100 linhas de PDF 1.4 com as fontes-padrão (Helvetica), sem
 * arrastar uma biblioteca de PDF para o pacote de um app que funciona offline.
 *
 * O que essas fontes não têm (fora do Latin-1, que cobre todo o português) vira
 * "?" em vez de quebrar o arquivo. Todos os nomes do catálogo cabem no Latin-1;
 * só um alimento criado pela pessoa, com emoji por exemplo, cairia nisso.
 */

const PAGE_W = 595.28; // A4, em pontos
const PAGE_H = 841.89;
const MARGIN = 56;
const TOP = PAGE_H - MARGIN;
const BOTTOM = MARGIN;
const LINE = 15;
const AMOUNT_X = MARGIN + 20;
const NAME_X = MARGIN + 112;
const NAME_CHARS = 56; // Helvetica 11 pt: ~5,5 pt por letra em média, cabe até a margem
const NOTE_CHARS = 92;

const TYPOGRAPHY_FALLBACK: Record<string, string> = {
  "–": "-",
  "—": "-",
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "…": "...",
  "•": "-",
};

/** Latin-1 (igual ao WinAnsi na faixa usada), escapado para uma string de PDF. */
function pdfString(text: string): string {
  const safe = text
    .normalize("NFC")
    .replace(/[^\x20-\x7E\xA0-\xFF]/gu, (ch) => TYPOGRAPHY_FALLBACK[ch] ?? "?")
    .replace(/[\\()]/g, "\\$&");
  return `(${safe})`;
}

/** Quebra em linhas de até `max` letras, sem partir palavra (exceto uma maior que a linha). */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let current = "";

  for (const word of text.split(/\s+/).filter(Boolean)) {
    for (let rest = word; rest !== ""; ) {
      const room = max - current.length - (current === "" ? 0 : 1);
      if (rest.length <= room) {
        current = current === "" ? rest : `${current} ${rest}`;
        break;
      }
      if (current !== "") {
        lines.push(current);
        current = "";
      } else {
        lines.push(rest.slice(0, max));
        rest = rest.slice(max);
      }
    }
  }
  if (current !== "") lines.push(current);

  return lines.length === 0 ? [""] : lines;
}

export function shoppingListPdf(list: ShoppingList): Uint8Array<ArrayBuffer> {
  const pages: string[][] = [[]];
  let y = TOP;

  const put = (op: string) => pages[pages.length - 1]!.push(op);
  const need = (height: number) => {
    if (y - height >= BOTTOM) return;
    pages.push([]);
    y = TOP;
  };
  const text = (font: "F1" | "F2", size: number, x: number, at: number, value: string, gray = 0) =>
    put(`${gray} g BT /${font} ${size} Tf ${x} ${at.toFixed(2)} Td ${pdfString(value)} Tj ET`);

  text("F2", 20, MARGIN, y - 20, "Lista de compras da semana");
  y -= 34;

  const notes = wrap(
    `Dietas: ${list.sources.map((s) => `${s.name} (${s.days})`).join(", ")}`,
    NOTE_CHARS,
  );
  for (const line of notes) {
    text("F1", 10, MARGIN, y - 10, line, 0.4);
    y -= 14;
  }
  y -= 8;

  for (const group of list.groups) {
    const first = wrap(group.items[0]!.name, NAME_CHARS).length;
    need(40 + first * LINE); // o título nunca fica sozinho no pé da página
    y -= 12;
    text("F2", 12, MARGIN, y - 12, group.title);
    put(`0.8 G 0.6 w ${MARGIN} ${(y - 18).toFixed(2)} m ${PAGE_W - MARGIN} ${(y - 18).toFixed(2)} l S`);
    y -= 26;

    for (const item of group.items) {
      const lines = wrap(item.name, NAME_CHARS);
      need(lines.length * LINE);
      put(`0.55 G 0.8 w ${MARGIN} ${(y - 10).toFixed(2)} 9 9 re S`);
      text("F2", 11, AMOUNT_X, y - 10, formatAmount(item.amount, item.unit));
      lines.forEach((line, i) => text("F1", 11, NAME_X, y - 10 - i * LINE, line));
      y -= lines.length * LINE + 3;
    }
  }

  // Objetos: 1 catálogo, 2 páginas, 3 Helvetica, 4 Helvetica-Bold, depois (página, conteúdo) por página.
  const bodies = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${5 + 2 * i} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    ...pages.flatMap((ops, i) => {
      const stream = ops.join("\n");
      return [
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + 2 * i} 0 R >>`,
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      ];
    }),
  ];

  let out = "%PDF-1.4\n";
  const offsets = bodies.map((body, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });

  const xref = out.length;
  out += `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((at) => `${String(at).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  // Tudo aqui é Latin-1: um caractere, um byte, e os deslocamentos acima valem.
  return Uint8Array.from(out, (ch) => ch.charCodeAt(0));
}
