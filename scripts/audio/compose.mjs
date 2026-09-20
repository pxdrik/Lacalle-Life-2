// Áudio v2, só efeitos: um swoosh por troca de página e um clique por toque. Sem música.
//
// Todos os tempos vêm de src/audio/timeline.ts (que espelha Ad.tsx).
// Gera 2 stems por perfil: swooshes e clicks.
// Uso: node scripts/audio/compose.mjs [cinematic] [mobile]   (sem argumento, gera os dois)
import { mkdirSync, writeFileSync } from "node:fs";
import { CUES, FPS } from "../../src/audio/timeline.ts";
import { SYNTH } from "../../src/audio/config.ts";
import { N, Reverb, lin, makeIR, peakDb, writeWav } from "./dsp.mjs";
import * as V from "./voices.mjs";

const { Track } = V;
const S = (f) => f / FPS;

const cues = [];
const cue = (stem, name, t) => cues.push({ stem, name, t: +t.toFixed(4), frame: +(t * FPS).toFixed(2) });

// ================================ SWOOSHES ==========================================
// Uma troca de página, um swoosh. O pico cai no meio do fade da tela, que é o instante em que o
// olho troca de página. Trocas "para frente" sobem de frequência; a saída do aparelho desce.
function buildSwooshes(p) {
  const swoosh = (label, centerFrame, dur, f0, f1, gain) => {
    const [l, r] = V.swoosh({ dur, f0, f1 });
    p.put(S(centerFrame) - 0.44 * dur, l, r, { gain, send: 0.35 });
    cue("swooshes", `swoosh-${label}`, S(centerFrame));
  };
  swoosh("logo", (CUES.logo.start + CUES.logo.sharp) / 2, 0.9, 400, 4200, 0.2);
  swoosh("aparelho-sobe", (CUES.stage.enter + CUES.stage.settled) / 2, 0.9, 400, 3000, 0.16);
  swoosh("diário", CUES.diario.cut + 4, 0.42, 900, 3600, 0.2);
  swoosh("hoje", (CUES.diario.hoje[0] + CUES.diario.hoje[1]) / 2, 0.42, 900, 3600, 0.2);
  swoosh("treino", CUES.treino.cut + 4, 0.42, 900, 3600, 0.2);
  swoosh("evolução", CUES.evolucao.cut + 5, 0.5, 700, 4200, 0.24);
  swoosh("aparelho-sai", (CUES.stage.exitStart + CUES.stage.exitEnd) / 2, 0.8, 3200, 350, 0.13);
}

// ================================ CLIQUES ==========================================
// Dois sons por toque, como um interruptor de verdade: o toque do dedo (corpo grave curto com um
// estalo macio) e, 4 a 6 quadros depois, um tique leve quando o item marca.
function buildClicks(u) {
  const pairs = [
    ...CUES.diario.taps.map((t, i) => [t, CUES.diario.states[i], "diário"]),
    ...CUES.treino.taps.map((t, i) => [t, CUES.treino.states[i], "treino"]),
  ];
  pairs.forEach(([tap, state, page], i) => {
    // o corpo sobe um pouquinho a cada toque, para uma série de cliques não soar como metralhadora
    u.put(S(tap), V.click({ body: 185 + 6 * i }), null, { gain: 0.5, send: 0.15 });
    cue("clicks", `clique-${page}-${i + 1}`, S(tap));
    u.put(S(state), V.click({ body: 0, top: 3600, dur: 0.045, topGain: 1.3 }), null, { gain: 0.3, send: 0.2 });
    cue("clicks", `confirma-${page}-${i + 1}`, S(state));
  });
}

// ================================ orquestração ==========================================
const REVERBS = {
  swooshes: { ir: { rt60: 2.2, predelay: 0.02, hfStart: 9000, hfEnd: 2500, lowCut: 200, seed: 22 }, wet: 0.25 },
  clicks: { ir: { rt60: 1.1, predelay: 0.01, hfStart: 10000, hfEnd: 3000, lowCut: 300, seed: 33 }, wet: 0.16 },
};

function build(profile) {
  V.reseed();
  cues.length = 0;
  const tracks = { swooshes: new Track("swooshes"), clicks: new Track("clicks") };
  buildSwooshes(tracks.swooshes);
  buildClicks(tracks.clicks);
  for (const [name, tr] of Object.entries(tracks)) {
    const cfg = REVERBS[name];
    V.finishTrack(tr, { reverb: new Reverb(makeIR(cfg.ir)), wet: cfg.wet, profile, kind: name, ceilingDb: SYNTH.stemCeilingDb });
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
