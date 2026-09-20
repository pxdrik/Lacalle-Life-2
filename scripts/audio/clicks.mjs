// Procura transientes agudos que não caem em evento planejado nem na grade rítmica: candidatos a estalo.
// Uso: node scripts/audio/clicks.mjs caminho.wav
import { readFileSync } from "node:fs";
import { CUES, FPS } from "../../src/audio/timeline.ts";
import { SR, applyBiquad, biquad, readWav } from "./dsp.mjs";

const [L, R] = readWav(readFileSync(process.argv[2]));
const mono = new Float32Array(L.length);
for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) * 0.5;
applyBiquad(mono, biquad("hp", 5000, 0.7));
const win = Math.round(0.002 * SR);
const e = [];
for (let s = 0; s + win <= mono.length; s += win) {
  let v = 0;
  for (let i = s; i < s + win; i++) v += mono[i] * mono[i];
  e.push(10 * Math.log10(v / win + 1e-14));
}
const T0 = CUES.agora[0] / FPS;
const planned = [];
for (const f of [...CUES.hook.lines, ...CUES.agora, ...CUES.diario.taps, ...CUES.diario.states, ...CUES.treino.taps, ...CUES.treino.states, CUES.treino.ultimaVez, CUES.fechamento.cta[0]]) planned.push(f / FPS);
const nearPlanned = (t) => planned.some((p) => Math.abs(t - p) < 0.25);
const onGrid = (t) => { const g = (t - T0) / 0.125; return t > T0 - 0.05 && Math.abs(g - Math.round(g)) * 0.125 < 0.014; };
const flagged = [];
for (let k = 60; k < e.length - 60; k++) {
  const med = [...e.slice(k - 50, k + 50)].sort((a, b) => a - b)[50];
  const t = (k * win) / SR;
  if (e[k] - med > 18 && e[k] > -75 && !nearPlanned(t) && !onGrid(t)) flagged.push({ t: +t.toFixed(3), above: +(e[k] - med).toFixed(0) });
}
console.log(flagged.length ? `${flagged.length} candidatos:` : "nenhum transiente agudo fora de evento/grade");
for (const f of flagged.slice(0, 25)) console.log(`  ${f.t}s (+${f.above} dB sobre a vizinhança)`);
