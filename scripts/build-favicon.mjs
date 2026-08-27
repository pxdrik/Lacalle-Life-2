// One-off: rasteriza src/app/icon.svg (a mesma arte, sem repeti-la) em PNGs
// de 16 e 32px e embrulha os dois num único favicon.ico multi-tamanho — o
// formato PNG-in-ICO que todo navegador atual aceita, sem precisar de uma
// dependência de conversão dedicada (sharp já está instalado por outra
// razão; isto só usa o que já existe).
//
// `favicon.ico` só é reconhecido pelo Next.js como arquivo estático — ao
// contrário de `icon`/`apple-icon`, não existe a variante `.tsx` gerada em
// runtime para este nome exato (ver `is-metadata-route.js` do próprio
// Next.js). Daí o binário no repositório em vez de um componente.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const svgPath = path.resolve("src/app/icon.svg");
const svg = readFileSync(svgPath);

const sizes = [16, 32];
const pngs = await Promise.all(
  sizes.map((size) => sharp(svg).resize(size, size).png().toBuffer()),
);

const headerSize = 6 + 16 * pngs.length;
let offset = headerSize;

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);

const entries = pngs.map((png, index) => {
  const size = sizes[index];
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += png.length;
  return entry;
});

const ico = Buffer.concat([header, ...entries, ...pngs]);
writeFileSync(path.resolve("src/app/favicon.ico"), ico);
console.log(`favicon.ico escrito (${String(ico.length)} bytes, tamanhos: ${sizes.join(", ")})`);
