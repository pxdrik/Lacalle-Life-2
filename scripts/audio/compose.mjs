// Áudio v2, versão mínima: pouca coisa, limpa, com suspense harmônico.
//
// Ideia: uma base em ré (ré, lá) com uma quarta suspensa (sol) que fica "pendurada" o filme
// inteiro e só resolve na terça maior (fá sustenido) quando aparece "Tudo em um lugar só.".
// O fá sustenido não é usado em nenhum outro lugar, então a chegada é ouvida como resolução.
// Os sons de interface não são uma camada de cliques: cada evento importante toca UMA nota
// tonal, da mesma escala da base, então eles são a melodia. O resto é silêncio e espaço.
//
// Gera 4 stems por perfil: music, impacts, ui, closing.
// Uso: node scripts/audio/compose.mjs [cinematic] [mobile]   (sem argumento, gera os dois)
import { mkdirSync, writeFileSync } from "node:fs";
import { CUES, FPS } from "../../src/audio/timeline.ts";
import { SYNTH } from "../../src/audio/config.ts";
import { N, Reverb, SR as SR_, hz, lin, makeIR, peakDb, writeWav } from "./dsp.mjs";
import * as V from "./voices.mjs";

const { Track } = V;
const S = (f) => f / FPS;
const T0 = S(CUES.agora[0]); // "Agora, um só." (4,27 s)
const TUDO = S(CUES.fechamento.tudo[0]); // "Tudo em um lugar só." (27,53 s)
const CTA = S(CUES.fechamento.cta[0]);
const smooth = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };
/** Automação por pontos [tempo, valor], suavizada entre eles. */
const auto = (pts) => (t) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * smooth((t - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]));
  }
  return pts.at(-1)[1];
};

const cues = [];
const cue = (stem, name, t) => cues.push({ stem, name, t: +t.toFixed(4), frame: +(t * FPS).toFixed(2) });

// ================================ MÚSICA ==========================================
function buildMusic(m) {
  // Gancho: o "problema" é um aglomerado grave (ré e mi bemol, que batem a ~4 Hz) que cresce
  // devagar, e um par agudo quase igual (3 Hz de diferença) que cintila. Some 60 ms antes do golpe.
  const hookEnd = T0 - 0.06;
  const [hl, hr] = V.padChord({ notes: ["D2", "Eb2"], dur: hookEnd - 0.2, attack: 3.4, release: 0.05, cutoff: [260, 560], seed: 5 });
  m.put(0.2, hl, hr, { gain: 0.15, send: 0.25 });
  m.put(1.2, V.sub({ freq: 880, dur: hookEnd - 1.2, attack: 2.4, release: 0.05 }), null, { gain: 0.012, pan: -0.5, send: 0.4 });
  m.put(1.2, V.sub({ freq: 883.2, dur: hookEnd - 1.2, attack: 2.4, release: 0.05 }), null, { gain: 0.012, pan: 0.5, send: 0.4 });
  cue("music", "bed-gancho", 0.2);

  // A base: ré, lá, ré (quinta vazia) e a quarta suspensa (sol). O filtro abre com a narrativa.
  const cut = auto([[T0, 520], [S(CUES.diario.cut), 780], [S(CUES.treino.cut), 900], [S(CUES.evolucao.cut), 1050],
    [S(CUES.evolucao.scroll[0][0]), 1300], [S(CUES.evolucao.scroll[1][1]), 2500], [27.9, 1300], [28.4, 900]]);
  const sus = TUDO - 0.08; // o sol sai um instante antes do fá sustenido chegar
  const layer = (notes, t0, t1, opts, gain, send = 0.3) => {
    const [l, r] = V.padChord({ notes, dur: t1 - t0, ...opts, cutoff: opts.cutoff ?? ((tl) => cut(t0 + tl)) });
    m.put(t0, l, r, { gain, send });
  };
  // Uma oitava acima do que parece natural: caixa pequena (celular, notebook) reproduz e não estoura.
  layer(["D3", "A3", "D4"], T0, 28.0, { attack: 0.9, release: 0.6, breath: 0.16, seed: 11 }, 0.16);
  m.put(T0, V.sub({ freq: hz("D2"), dur: 28.0 - T0, attack: 0.9, release: 0.6 }), null, { gain: 0.04 }); // só um fio de grave
  layer(["G3"], T0, sus, { attack: 1.2, release: 0.12, seed: 12 }, 0.085);
  cue("music", "base-ré-lá", T0);
  cue("music", "quarta-suspensa-sol", T0);
  // Treino: uma sétima menor (dó) entra baixinho. A tensão sobe um degrau, sem ritmo.
  layer(["C4"], S(CUES.treino.cut), 19.7, { attack: 1.0, release: 1.2, cutoff: [800, 1100], seed: 13 }, 0.05);
  // Evolução: a base se abre com uma segunda e uma quinta em cima (mi, lá) e um brilho agudo.
  layer(["E4", "A4"], S(CUES.evolucao.cut), 27.9, { attack: 1.6, release: 1.6, cutoff: auto([[19.4, 1500], [25.47, 3200], [27.9, 1600]]), seed: 14 }, 0.06);
  cue("music", "abre-evolução", S(CUES.evolucao.cut));
  const [sl, sr] = V.shimmer({ notes: ["A5", "E6"], dur: 27.4 - 20.2, attack: 2.0, release: 2.0 });
  m.put(20.2, sl, sr, { gain: 0.03, send: 0.8 });
}

// ================================ IMPACTOS ==========================================
function buildImpacts(p) {
  // Gancho: três "problemas". Cada um é um baque grave curto mais um par dissonante que acumula.
  const clusters = [["A3", "Bb3"], ["A3", "Bb3", "E4", "F4"], ["A3", "Bb3", "E4", "F4", "Db5", "D5"]];
  const lv = [0.5, 0.72, 1];
  CUES.hook.lines.forEach((f, i) => {
    const t = S(f) + 0.13;
    p.put(t, V.sub({ freq: 56, dur: 0.04, release: 0.32, glideFrom: 88, glideTau: 0.05, tau: 0.18 }), null, { gain: 0.3 * lv[i], send: 0.25 });
    clusters[i].forEach((n, k) => p.put(t + 0.004 * k, V.mallet({ freq: hz(n), dur: 1.6, tau: 0.6, bright: 0.3 }), null, { gain: 0.05 * lv[i], pan: (k % 2 ? 0.4 : -0.4), send: 0.9 }));
    cue("impacts", `hook-${i + 1}`, t);
  });

  // A tensão sobe até o logo e há um respiro de silêncio antes do golpe
  const swellStart = S(CUES.logo.start);
  const swellDur = T0 - 0.04 - swellStart;
  const [wl, wr] = V.noiseSweep({ dur: swellDur, f0: 350, f1: 5200, q: 0.8, shape: (x) => x ** 2.8 * (x > 0.94 ? (1 - x) / 0.06 : 1) });
  p.put(swellStart, wl, wr, { gain: 0.06, send: 0.6 });
  p.put(swellStart, V.riserTone({ dur: swellDur, f0: 147, f1: 587 }), null, { gain: 0.035, send: 0.5 });
  cue("impacts", "subida-logo", swellStart);

  // "Agora, um só.": um golpe limpo e curto, e o ar que sai depois
  p.put(T0, V.hit({ dur: 2.2 }), null, { gain: 0.55, send: 0.3 });
  const [al, ar] = V.noiseSweep({ dur: 1.4, f0: 4200, f1: 600, q: 0.7, shape: (x) => (x < 0.01 ? x / 0.01 : Math.exp(-5 * x)) });
  p.put(T0, al, ar, { gain: 0.035, send: 0.8 });
  cue("impacts", "hit-agora-um-so", T0);

  // Transições: só um sopro, quase nada
  const sweep = (t0, dur, f0, f1, gain, shape) => {
    const [l, r] = V.noiseSweep({ dur, f0, f1, q: 1, shape });
    p.put(t0, l, r, { gain, send: 0.5 });
  };
  const up = (x) => x ** 2;
  const down = (x) => (x < 0.08 ? x / 0.08 : (1 - x) ** 1.5);
  sweep(S(CUES.treino.cut) - 0.5, 0.5, 500, 3500, 0.025, up);
  sweep(S(CUES.evolucao.cut) - 0.8, 0.8, 300, 5000, 0.03, up);
  sweep(S(CUES.stage.exitStart), 0.85, 4200, 300, 0.03, down);
}

// ================================ INTERFACE ==========================================
// Uma nota por evento, sempre de {ré, mi, sol, lá}: nunca fá sustenido, que fica reservado para a resolução.
function buildUI(u) {
  const note = (frame, name, gain, label) => {
    u.put(S(frame), V.mallet({ freq: hz(name), dur: 1.9, tau: 0.6 }), null, { gain, send: 0.7 });
    cue("ui", `nota-${label}`, S(frame));
  };
  CUES.diario.states.forEach((f, i) => note(f, ["A4", "D5"][i], 0.1, `diário-${i + 1}`));
  CUES.treino.states.forEach((f, i) => note(f, ["D5", "E5", "A5"][i], 0.1, `treino-${i + 1}`));
  // Evolução: quando o volume semanal entra na tela e quando chegam os recordes
  note(CUES.evolucao.scroll[0][1] - 6, "E5", 0.085, "evolução-volume");
  note(CUES.evolucao.scroll[1][0] + 34, "A5", 0.085, "evolução-recordes");
}

// ================================ FECHAMENTO ==========================================
function buildClosing(c) {
  // "Tudo em um lugar só.": a quarta suspensa resolve. Fá sustenido pela primeira vez, sem impacto.
  const [pl, pr] = V.padChord({ notes: ["F#3", "A3", "D4", "F#4"], dur: 0.5, attack: 0.28, release: 0.7, cutoff: [1300, 2400], seed: 41 });
  c.put(TUDO, pl, pr, { gain: 0.2, send: 0.5 });
  c.put(TUDO, V.mallet({ freq: hz("F#5"), dur: 1.8, tau: 0.7 }), null, { gain: 0.075, send: 0.8 });
  c.put(TUDO, V.sub({ freq: hz("D2"), dur: 0.3, attack: 0.08, release: 0.6 }), null, { gain: 0.11, send: 0.2 });
  cue("closing", "resolução-tudo", TUDO);
  // Assinatura: lá, ré. Quinta e oitava, sem terça, então nem alegre nem triste.
  const sig = CTA + 0.53; // 29,2 s, quando o bloco da chamada já está legível
  c.put(sig, V.mallet({ freq: hz("A5"), dur: 1.7, tau: 0.65 }), null, { gain: 0.14, send: 0.85 });
  c.put(sig + 0.28, V.mallet({ freq: hz("D6"), dur: 1.5, tau: 0.65 }), null, { gain: 0.12, send: 0.9 });
  cue("closing", "assinatura", sig);
}

// ================================ orquestração ==========================================
const REVERBS = {
  music: { ir: { rt60: 3.4, predelay: 0.03, hfStart: 6000, hfEnd: 1400, lowCut: 150, seed: 11 }, wet: 0.22 },
  impacts: { ir: { rt60: 3.6, predelay: 0.03, hfStart: 6500, hfEnd: 1300, lowCut: 140, seed: 22 }, wet: 0.28 },
  ui: { ir: { rt60: 2.8, predelay: 0.02, hfStart: 11000, hfEnd: 3200, lowCut: 220, seed: 33 }, wet: 0.5 },
  closing: { ir: { rt60: 3.6, predelay: 0.03, hfStart: 9000, hfEnd: 2200, lowCut: 180, seed: 44 }, wet: 0.42 },
};

/** Cava um vale de `depthDb` entre t1 e t2 (rampas de t0->t1 e t2->t3), sem clique. */
function duck(tr, t0, t1, t2, t3, depthDb) {
  const floor = lin(depthDb);
  for (let i = Math.round(t0 * SR_); i < Math.round(t3 * SR_); i++) {
    const t = i / SR_;
    const g = t < t1 ? 1 - (1 - floor) * ((t - t0) / (t1 - t0)) : t < t2 ? floor : floor + (1 - floor) * ((t - t2) / (t3 - t2));
    tr.L[i] *= g;
    tr.R[i] *= g;
  }
}

function build(profile) {
  V.reseed();
  cues.length = 0;
  const tracks = { music: new Track("music"), impacts: new Track("impacts"), ui: new Track("ui"), closing: new Track("closing") };
  buildMusic(tracks.music);
  buildImpacts(tracks.impacts);
  buildUI(tracks.ui);
  buildClosing(tracks.closing);
  for (const [name, tr] of Object.entries(tracks)) {
    const cfg = REVERBS[name];
    V.finishTrack(tr, { reverb: new Reverb(makeIR(cfg.ir)), wet: cfg.wet, profile, kind: name, ceilingDb: SYNTH.stemCeilingDb });
    // O espaço antes da chamada é gravado no stem de fechamento; a música sai ao vivo, pela config.
    if (name === "closing") duck(tr, 28.3, 28.4, 28.72, 28.85, -42);
    const g = lin(SYNTH.stemPeakDb[name]) / lin(peakDb(tr.L, tr.R));
    for (let i = 0; i < N; i++) { tr.L[i] *= g; tr.R[i] *= g; }
  }
  return tracks;
}

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : ["cinematic", "mobile"];
for (const profile of wanted) {
  const t0 = Date.now();
  const stems = build(profile);
  const dir = `public/audio/v2/${profile}`;
  mkdirSync(dir, { recursive: true });
  for (const [name, tr] of Object.entries(stems)) {
    writeWav(`${dir}/${name}.wav`, tr.L, tr.R, 24);
    console.log(`${profile}/${name}.wav  pico ${peakDb(tr.L, tr.R).toFixed(1)} dBFS`);
  }
  console.log(`${profile} pronto em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
writeFileSync("public/audio/v2/cues.json", JSON.stringify(cues, null, 2));
console.log(`${cues.length} marcas de sincronia em public/audio/v2/cues.json`);
