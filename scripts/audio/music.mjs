// Trilha original do comercial (versão COM música). Ambient eletrônico minimalista, ré maior,
// 100 bpm. Funciona como atmosfera, abaixo dos efeitos, e cresce devagar até o pico em
// "Tudo em um lugar só.", com um release curto sob a chamada final.
//
// Camadas (poucas de cada vez): pad profundo, ar (textura), graves limpos que "respiram",
// pequenos pulsos tonais e algumas notas soltas. Sem bateria, sem melodia marcante.
//
// A grade de compassos é ancorada em "Tudo em um lugar só." (o pico) e as seções vêm das cenas
// (src/timeline.ts), então retimar o filme move a música junto.
// Uso: node scripts/audio/music.mjs [cinematic] [mobile]   (sem argumento, gera os dois)
import { mkdirSync } from "node:fs";
import { CUES, FPS } from "../../src/timeline.ts";
import { SYNTH } from "../../src/audio/config.ts";
import { DUR, N, Reverb, SR, hz, lin, makeIR, peakDb, pingPong, writeWav } from "./dsp.mjs";
import * as V from "./voices.mjs";

const S = (f) => f / FPS;
const TAG = S(CUES.fechamento.tudo[0]); // "Tudo em um lugar só.": o pico
const CTA = S(CUES.fechamento.cta[0]); // a chamada: começa o release
const BEAT = 60 / 100;
const BAR = 4 * BEAT; // 2,4 s
const EIGHTH = BEAT / 2;
const NBARS = Math.ceil(TAG / BAR);
const B0 = TAG - NBARS * BAR; // o compasso NBARS começa exatamente no pico
const barT = (k) => B0 + k * BAR;
const barOf = (t) => Math.round((t - B0) / BAR);

const smooth = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
const ramp = (t, a, b) => smooth((t - a) / (b - a));
/** Automação por pontos [tempo, valor], suavizada entre eles. */
const auto = (pts) => (t) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * smooth((t - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]));
  }
  return pts.at(-1)[1];
};

// --- seções (vêm das cenas) ---------------------------------------------------------
const pulseBar = barOf(S(CUES.stage.enter)); // o pulso entra quando o aparelho entra
const denseBar = barOf(S(CUES.treino.cut)); // mais densidade no treino
const peakBar = barOf(S(CUES.evolucao.scroll[1][0])); // pico começa no fim da evolução

/** Intensidade geral (0 a 1): quase vazio no começo, pico na frase final, release sob a chamada. */
const I = auto([
  [0, 0], [S(CUES.logo.start), 0.08], [barT(pulseBar), 0.2], [barT(denseBar), 0.5],
  [S(CUES.evolucao.cut), 0.62], [barT(peakBar), 0.88], [TAG, 1], [CTA, 0.7], [CTA + 0.9, 0.22], [DUR, 0],
]);

// --- harmonia: I - vi - IV - V(sus) - I, em ré maior --------------------------------
const CHORDS = [
  { from: 0, to: 2, pad: ["D3", "A3", "E4", "F#4"], bass: "D2", tones: ["D5", "A5", "E5", "F#5"] }, // Dadd9
  { from: 2, to: 4, pad: ["B2", "F#3", "A3", "C#4", "D4"], bass: "B1", tones: ["B4", "F#5", "D5", "C#5"] }, // Bm9
  { from: 4, to: 6, pad: ["D3", "G3", "B3", "F#4", "A4"], bass: "G1", tones: ["G4", "D5", "B4", "A4"] }, // Gmaj9
  { from: 6, to: peakBar, pad: ["A2", "E3", "B3", "D4", "E4"], bass: "A1", tones: ["A4", "E5", "D5", "B4"] }, // Asus4add9
  { from: peakBar, to: null, pad: ["D3", "A3", "C#4", "E4", "F#4"], bass: "D2", tones: ["D5", "A5", "F#5", "E5"] }, // Dmaj9
];
const chordEnd = (c) => (c.to === null ? CTA + 0.6 : barT(c.to));

function build(profile) {
  V.reseed(61);
  const m = new V.Track("music");
  const shape = (arr, t0, g) => { for (let i = 0; i < arr.length; i++) arr[i] *= g(t0 + i / SR); };

  // Ar: quase nada, o "espaço" do começo. Cresce só um pouco com a intensidade.
  {
    const [tl, tr] = V.texture({ dur: DUR, f: 1500, depth: 700, rate: 0.045 });
    const g = (t) => (0.02 + 0.03 * I(t)) * ramp(t, 0, 1.5);
    shape(tl, 0, g);
    shape(tr, 0, g);
    m.put(0, tl, tr, { gain: 1, send: 0.3 });
  }

  // Pad profundo: um acorde por bloco, filtro que abre com a intensidade
  CHORDS.forEach((c, k) => {
    const t0 = barT(c.from);
    const t1 = chordEnd(c);
    const [l, r] = V.padChord({ notes: c.pad, dur: t1 - t0, attack: 1.4, release: 1.6, cutoff: (tl) => 450 + 1700 * I(t0 + tl), seed: 11 + k });
    const g = (t) => 0.012 + 0.16 * I(t) ** 1.15;
    shape(l, t0, g);
    shape(r, t0, g);
    m.put(t0, l, r, { gain: 1, send: 0.4 });

    // Grave limpo que "respira" (tremolo lento em quartos de nota, só do treino em diante)
    const bStart = Math.max(t0, barT(4));
    if (t1 > bStart) {
      const bass = V.sub({ freq: hz(c.bass), dur: t1 - bStart, attack: 0.8, release: 0.9 });
      const h2 = V.sub({ freq: hz(c.bass) * 2, dur: t1 - bStart, attack: 0.8, release: 0.9 }); // 2º harmônico: audível em caixa pequena
      const gb = (t) => ramp(t, barT(4), barT(4) + 2) * (0.025 + 0.11 * I(t) ** 1.3)
        * (1 - 0.28 * ramp(t, barT(denseBar), barT(denseBar) + 2) * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / BEAT)));
      for (let i = 0; i < bass.length; i++) bass[i] = (bass[i] + 0.35 * h2[i]) * gb(bStart + i / SR);
      m.put(bStart, bass, null, { gain: 1, send: 0.05 });
    }
  });

  // Pulso: notas tonais curtas e macias, em grupos de 3+3+2 oitavos (nada de metrônomo)
  {
    const tiers = [[pulseBar, denseBar, [0, 3, 6]], [denseBar, peakBar, [0, 3, 5, 6]], [peakBar, NBARS + 3, [0, 2, 3, 5, 6, 7]]];
    let n = 0;
    for (const [from, to, steps] of tiers) {
      for (let bar = from; bar < to; bar++) {
        const c = CHORDS.find((x) => bar >= x.from && (x.to === null || bar < x.to));
        for (const st of steps) {
          const t = barT(bar) + st * EIGHTH;
          if (t > CTA + 0.5) continue;
          const f = hz(c.tones[[0, 1, 2, 1][n++ % 4]]);
          const gp = 0.006 + 0.075 * I(t) ** 1.6;
          m.put(t, V.mallet({ freq: f, dur: 0.8, tau: 0.22, bright: 0.5 }), null, { gain: gp, pan: n % 2 ? 0.35 : -0.35, send: 0.5, delay: 0.5 });
        }
      }
    }
  }

  // Poucas notas soltas, bem discretas
  [[barT(3) + 0.9, "F#5", 0.07], [barT(5), "D5", 0.06], [barT(5) + 1.5, "A5", 0.055], [barT(7) + 0.6, "E5", 0.06],
    [barT(peakBar), "F#5", 0.07], [TAG, "A5", 0.09], [TAG + 0.6, "D6", 0.075]].forEach(([t, n, g]) => {
    m.put(t, V.mallet({ freq: hz(n), dur: 2.2, tau: 1.0 }), null, { gain: g, send: 0.7, delay: 0.3 });
  });

  // Delay ping-pong (colcheia pontuada) só nas notas e pulsos
  const [dl, dr] = pingPong(m.dlyL, m.dlyR, { time: EIGHTH * 1.5, feedback: 0.38, lp: 3000, hp: 350 });
  for (let i = 0; i < N; i++) {
    m.L[i] += dl[i] * 0.32;
    m.R[i] += dr[i] * 0.32;
    m.sendL[i] += dl[i] * 0.16;
    m.sendR[i] += dr[i] * 0.16;
  }

  V.finishTrack(m, { reverb: new Reverb(makeIR({ rt60: 4.2, predelay: 0.04, hfStart: 5000, hfEnd: 1200, lowCut: 150, seed: 61 })), wet: 0.32, profile, kind: "music", ceilingDb: SYNTH.stemCeilingDb });

  // Release limpo: a cauda some até o fim do filme
  const fadeFrom = CTA + 0.6;
  const fadeTo = DUR - 0.05;
  for (let i = Math.round(fadeFrom * SR); i < N; i++) {
    const g = 1 - smooth((i / SR - fadeFrom) / (fadeTo - fadeFrom));
    m.L[i] *= g;
    m.R[i] *= g;
  }
  const g = lin(SYNTH.stemPeakDb.music) / lin(peakDb(m.L, m.R));
  for (let i = 0; i < N; i++) { m.L[i] *= g; m.R[i] *= g; }
  return m;
}

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : ["cinematic", "mobile"];
for (const profile of wanted) {
  const t0 = Date.now();
  const m = build(profile);
  const dir = `public/audio/v2/${profile}`;
  mkdirSync(dir, { recursive: true });
  writeWav(`${dir}/music.wav`, m.L, m.R, 24);
  console.log(`${profile}/music.wav  pico ${peakDb(m.L, m.R).toFixed(1)} dBFS  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
console.log(`compassos: ${NBARS} de ${BAR} s; pulso entra no ${pulseBar}, densidade no ${denseBar}, pico no ${peakBar}; pico da frase final em ${TAG.toFixed(2)} s`);
