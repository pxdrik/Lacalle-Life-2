// Gera o ícone do app Android (e a arte da tela de abertura) a partir de
// src/app/icon.svg, a mesma arte do favicon e do app instalável, sem repeti-la:
// o traço do símbolo e o gradiente são lidos de lá. Rodar de novo quando a
// marca mudar: `node scripts/build-android-icons.mjs`.
//
// - Ícone adaptativo (Android 8+): fundo com o gradiente, frente com o símbolo
//   branco, e a camada monocromática que o Android 13 pinta no tema do
//   aparelho. O símbolo ocupa 46% da área visível (72 de 108 dp), a proporção
//   da pág. 15 do Brand System, folgado dentro da zona segura de 66 dp.
// - Ícone antigo (Android 7): o quadrado arredondado do favicon e o redondo.
//
// sharp já está instalado (vem com o Next); nada de dependência nova.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const source = readFileSync(path.resolve("src/app/icon.svg"), "utf8");
const markPath = /<path d="([^"]+)"/.exec(source)?.[1];
const stops = [...source.matchAll(/stop-color="([^"]+)"/g)].map((match) => match[1]);
if (markPath === undefined || stops.length !== 2) throw new Error("icon.svg mudou de forma: ajuste o script.");

const RES = path.resolve("android/app/src/main/res");
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// O símbolo, em unidades do desenho original (100 de largura, ~103 de altura).
const MARK_W = 100;
const MARK_H = 103.4;
const gradient = `<linearGradient id="g" x1="0.317" y1="0.183" x2="0.683" y2="0.817"><stop offset="0" stop-color="${stops[0]}"/><stop offset="1" stop-color="${stops[1]}"/></linearGradient>`;

/** O símbolo branco centrado num canvas de `size`, com `width` de largura. */
function mark(size, width) {
  const scale = width / MARK_W;
  const x = (size - width) / 2;
  const y = (size - MARK_H * scale) / 2;
  return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="${markPath}" fill="#FFFFFF"/></g>`;
}

const svg = (size, body) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><defs>${gradient}</defs>${body}</svg>`);

const LAYER = 108; // dp do canvas de cada camada do ícone adaptativo
const VISIBLE = 72; // dp que o launcher mostra
const layers = {
  ic_launcher_background: svg(LAYER, `<rect width="${LAYER}" height="${LAYER}" fill="url(#g)"/>`),
  ic_launcher_foreground: svg(LAYER, mark(LAYER, VISIBLE * 0.46)),
  ic_launcher_monochrome: svg(LAYER, mark(LAYER, VISIBLE * 0.46)),
};
const LEGACY = 48;
const legacy = {
  ic_launcher: svg(LEGACY, `<rect width="${LEGACY}" height="${LEGACY}" rx="${LEGACY * 0.225}" fill="url(#g)"/>${mark(LEGACY, LEGACY * 0.46)}`),
  ic_launcher_round: svg(LEGACY, `<circle cx="${LEGACY / 2}" cy="${LEGACY / 2}" r="${LEGACY / 2}" fill="url(#g)"/>${mark(LEGACY, LEGACY * 0.46)}`),
};

for (const [density, factor] of Object.entries(DENSITIES)) {
  const dir = path.join(RES, `mipmap-${density}`);
  mkdirSync(dir, { recursive: true });
  for (const [name, art] of Object.entries(layers)) {
    const px = Math.round(LAYER * factor);
    writeFileSync(path.join(dir, `${name}.png`), await sharp(art, { density: 72 * factor * 4 }).resize(px, px).png().toBuffer());
  }
  for (const [name, art] of Object.entries(legacy)) {
    const px = Math.round(LEGACY * factor);
    writeFileSync(path.join(dir, `${name}.png`), await sharp(art, { density: 72 * factor * 4 }).resize(px, px).png().toBuffer());
  }
}

const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<!-- Gerado por scripts/build-android-icons.mjs a partir de src/app/icon.svg. -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;
mkdirSync(path.join(RES, "mipmap-anydpi-v26"), { recursive: true });
writeFileSync(path.join(RES, "mipmap-anydpi-v26", "ic_launcher.xml"), adaptive);
writeFileSync(path.join(RES, "mipmap-anydpi-v26", "ic_launcher_round.xml"), adaptive);
console.log(`Ícones do Android escritos em ${RES} (${Object.keys(DENSITIES).length} densidades).`);
