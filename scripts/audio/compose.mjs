// Arranjo do áudio v2, amarrado aos quadros do vídeo (src/audio/timeline.ts).
// Gera 4 stems por perfil: music, impacts, ui, closing.
// Uso: node scripts/audio/compose.mjs [cinematic] [mobile]   (sem argumento, gera os dois)
import { mkdirSync, writeFileSync } from "node:fs";
import { CUES, FPS } from "../../src/audio/timeline.ts";
import { SYNTH } from "../../src/audio/config.ts";
import { N, Reverb, SR as SR_, hz, lin, makeIR, peakDb, writeWav } from "./dsp.mjs";
import * as V from "./voices.mjs";

const { Track } = V;
const S = (f) => f / FPS;
const BEAT = 60 / SYNTH.bpm;
const BAR = BEAT * 4;
const STEP = BEAT / 4;
/** Compasso 1 começa em "Agora, um só." e a grade é de 120 bpm: os cortes do vídeo caem em pulsos. */
const T0 = S(CUES.agora[0]);
const barT = (bar, step = 0) => T0 + (bar - 1) * BAR + step * STEP;
const smoothstep = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };

// --- harmonia (Ré menor) --------------------------------------------------------------
const CHORDS = {
  Dm9: { pad: ["D3", "F3", "A3", "C4", "E4"], arp: ["D5", "F5", "A5", "C6", "E6"], sub: "D2", bass: "D3" },
  Bbmaj7: { pad: ["Bb2", "D3", "F3", "A3", "D4"], arp: ["D5", "F5", "A5", "Bb5", "D6"], sub: "Bb1", bass: "Bb2" },
  Gm9: { pad: ["G2", "Bb2", "D3", "F3", "A3"], arp: ["Bb4", "D5", "F5", "A5", "D6"], sub: "G1", bass: "G2" },
  A7sus4: { pad: ["A2", "D3", "E3", "G3", "D4"], arp: ["D5", "E5", "G5", "A5", "D6"], sub: "A1", bass: "A2" },
  Fmaj9: { pad: ["F2", "A2", "C3", "E3", "G3", "C4"], arp: ["C5", "E5", "G5", "A5", "C6"], sub: "F1", bass: "F2" },
  Bbmaj7s11: { pad: ["Bb2", "D3", "F3", "A3", "E4"], arp: ["D5", "F5", "A5", "E6", "Bb5"], sub: "Bb1", bass: "Bb2" },
};
// bar -> acorde (compasso 1 = 4,27 s; a cada compasso, 2 s)
const PROG = { 1: "Dm9", 2: "Dm9", 3: "Bbmaj7", 4: "Bbmaj7", 5: "Gm9", 6: "Gm9", 7: "Bbmaj7", 8: "A7sus4", 9: "Fmaj9", 10: "Fmaj9", 11: "Bbmaj7s11", 12: "Dm9", 13: "Dm9" };
const BLOCKS = [
  { bar: 1, n: 2, chord: "Dm9", pad: 0.13, cut: [650, 1250], attack: 0.35 },
  { bar: 3, n: 2, chord: "Bbmaj7", pad: 0.14, cut: [800, 1500], attack: 1.1 },
  { bar: 5, n: 2, chord: "Gm9", pad: 0.17, cut: [900, 1800], attack: 1.1 },
  { bar: 7, n: 1, chord: "Bbmaj7", pad: 0.17, cut: [1000, 1500], attack: 0.9 },
  { bar: 8, n: 1, chord: "A7sus4", pad: 0.17, cut: [1100, 2600], attack: 0.9 },
  { bar: 9, n: 2, chord: "Fmaj9", pad: 0.27, cut: null, attack: 1.0 },
  { bar: 11, n: 1, chord: "Bbmaj7s11", pad: 0.2, cut: [3200, 2300], attack: 1.0 },
  { bar: 12, n: 2, chord: "Dm9", pad: 0.15, cut: [2200, 900], attack: 0.9 },
];
// Motivo principal (duas compassos). Sempre as mesmas notas, com cores diferentes conforme o acorde.
const MOTIF = [[0, "D5"], [6, "A5"], [10, "F5"], [16, "E5"], [24, "A5"]]; // [passo desde o início do motivo, nota]
const ARP_STEPS = [0, 3, 6, 8, 11, 14];
const ARP_ORDER = [[0, 2, 1, 3, 2, 4], [4, 2, 3, 1, 2, 0]];

// Sub grave por bloco: cheio no impacto e no treino, recolhido na evolução (a energia migra para o brilho).
const SUB_GAIN = { 1: 0.17, 3: 0.12, 5: 0.17, 7: 0.16, 8: 0.16, 9: 0.075, 11: 0.08, 12: 0.11 };

// Micro-humanização determinística (±4 ms, ±8% de velocidade), sem "cara de grade".
let hs = 90210;
const hr = () => { hs = (hs * 1103515245 + 12345) & 0x7fffffff; return hs / 0x7fffffff - 0.5; };
const hTime = () => hr() * 0.008;
const hVel = (v) => v * (1 + hr() * 0.16);

const cues = [];
const cue = (stem, name, t) => cues.push({ stem, name, t: +t.toFixed(4), frame: +(t * FPS).toFixed(2) });

function bezier(x1, y1, x2, y2) {
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
      const xt = ((ax * t + bx) * t + cx) * t - x;
      const dx = (3 * ax * t + 2 * bx) * t + cx;
      if (Math.abs(xt) < 1e-7 || Math.abs(dx) < 1e-7) break;
      t -= xt / dx;
    }
    t = Math.min(1, Math.max(0, t));
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    return ((ay * t + by) * t + cy) * t;
  };
}
/** Velocidade normalizada (0..1) de uma rolagem com o easeInOut do Motion System, entre dois quadros. */
function scrollVelocity(fa, fb) {
  const E = bezier(0.65, 0, 0.35, 1);
  const D = S(fb - fa);
  const raw = (p) => { const e = 1e-3; return Math.abs(E(Math.min(1, p + e)) - E(Math.max(0, p - e))) / (2 * e); };
  let vmax = 0;
  for (let i = 0; i <= 200; i++) vmax = Math.max(vmax, raw(i / 200));
  return (tl) => Math.min(1, raw(Math.min(1, Math.max(0, tl / D))) / vmax);
}

// ================================ MÚSICA ==========================================
function buildMusic(m) {
  // Gancho: quase nada. Um zumbido grave que cresce e some um instante antes do impacto.
  const bedEnd = T0 - 0.06;
  m.put(0.25, V.sub({ freq: hz("D2"), dur: bedEnd - 0.25, attack: 3.2, release: 0.05, drive: 1 }), null, { gain: 0.05 });
  m.put(0.25, V.sub({ freq: hz("A2") * 1.0035, dur: bedEnd - 0.25, attack: 3.6, release: 0.05 }), null, { gain: 0.026, pan: 0.3 });
  cue("music", "bed-hook", 0.25);

  // Pads e sub, por bloco harmônico
  for (const b of BLOCKS) {
    const ch = CHORDS[b.chord];
    const t0 = barT(b.bar);
    const dur = b.n * BAR + 0.15;
    const cutoff = b.cut ?? ((tl) => 1300 + 4300 * smoothstep((t0 + tl - S(CUES.evolucao.scroll[0][0])) / (S(CUES.evolucao.scroll[1][1]) - S(CUES.evolucao.scroll[0][0]))));
    const [pl, pr] = V.padChord({ notes: ch.pad, dur, attack: b.attack, release: 1.3, cutoff, seed: b.bar * 7 });
    m.put(t0, pl, pr, { gain: b.pad, send: 0.4 });
    m.put(t0, V.sub({ freq: hz(ch.sub), dur: b.n * BAR - 0.05, attack: b.bar === 1 ? 0.1 : 0.22, release: 0.5, drive: 1.2 }), null, { gain: SUB_GAIN[b.bar] });
    cue("music", `pad-${b.chord}`, t0);
  }

  // Ritmo e baixo por compasso
  const hatV = (step, kind) => (kind === "sixteenth" ? (step % 4 === 2 ? 1 : step % 2 === 0 ? 0.55 : 0.28) : 1);
  const SEC = {
    2: { kick: [[0, 1]], hat: "off8", arp: 0.55 },
    3: { kick: [[0, 1], [10, 0.8]], hat: "off8", shaker: true, rim: [6], bass: [[0, 1], [6, 0.8], [10, 0.9]], arp: 0.75 },
    4: { kick: [[0, 1], [10, 0.8], [14, 0.4]], hat: "off8", shaker: true, rim: [6, 13], bass: [[0, 1], [6, 0.8], [10, 0.9]], arp: 0.75 },
    5: { kg: 0.44, kick: [[0, 1], [6, 0.75], [10, 0.9]], hat: "sixteenth", shaker: true, snap: [[4, 0.7], [12, 0.8]], rim: [6, 13], bass: [[0, 1], [3, 0.7], [6, 0.85], [10, 0.9], [12, 0.7], [14, 0.8]], arp: 1 },
    6: { kg: 0.44, kick: [[0, 1], [6, 0.75], [10, 0.9]], hat: "sixteenth", shaker: true, snap: [[4, 0.7], [12, 0.8]], rim: [6, 13], bass: [[0, 1], [3, 0.7], [6, 0.85], [10, 0.9], [12, 0.7], [14, 0.8]], arp: 1 },
    7: { kg: 0.44, kick: [[0, 1], [6, 0.75], [10, 0.9]], hat: "sixteenth", shaker: true, snap: [[4, 0.7], [12, 0.8], [14, 0.4], [15, 0.5]], rim: [6, 13], bass: [[0, 1], [3, 0.7], [6, 0.85], [10, 0.9], [12, 0.7], [14, 0.8]], arp: 1 },
    // compasso 8: a percussão cai na batida 3 (19,27 s), logo antes do corte para a Evolução
    8: { kg: 0.44, kick: [[0, 1], [4, 0.9]], hat: "sixteenth", hatUntil: 8, bass: [[0, 1], [6, 0.8]], arp: 0.85, arpUntil: 8 },
    9: { kick: [[0, 0.55]], hat: "sparse", arp: 0.7 },
    10: { kick: [[0, 0.5]], hat: "sparse", arp: 0.7 },
    11: { arp: 0.5 },
  };
  for (const [barS, sp] of Object.entries(SEC)) {
    const bar = Number(barS);
    const ch = CHORDS[PROG[bar]];
    const at = (step) => barT(bar, step) + hTime();
    for (const [st, v] of sp.kick ?? []) m.put(at(st), V.kick(), null, { gain: (sp.kg ?? 0.33) * hVel(v) });
    if (sp.hat) {
      const steps = sp.hat === "off8" ? [2, 6, 10, 14] : sp.hat === "sparse" ? [2, 10] : Array.from({ length: 16 }, (_, i) => i);
      for (const st of steps) {
        if (sp.hatUntil && st >= sp.hatUntil) continue;
        const open = sp.hat === "sixteenth" && st === 14 && bar >= 5 && bar <= 7;
        m.put(at(st), open ? V.hat({ dur: 0.16, tau: 0.055 }) : V.hat(), null, { gain: (sp.hat === "sparse" ? 0.05 : 0.075) * hatV(st, sp.hat) * (open ? 1.3 : 1), pan: st % 4 === 2 ? 0.3 : -0.2, send: 0.15 });
      }
    }
    if (sp.shaker) for (let st = 0; st < 16; st += 2) m.put(at(st), V.shaker(), null, { gain: 0.085 * (st % 4 === 2 ? 1 : 0.6), pan: -0.3, send: 0.12 });
    for (const st of sp.rim ?? []) m.put(at(st), V.rim(), null, { gain: 0.06, pan: 0.4, send: 0.3 });
    for (const [st, v] of sp.snap ?? []) m.put(at(st), V.snap(), null, { gain: 0.2 * v, send: 0.35 });
    for (const [st, v] of sp.bass ?? []) m.put(at(st), V.bassPluck({ freq: hz(ch.bass), dur: 0.5 }), null, { gain: 0.2 * hVel(v), send: 0.08 });
    // arpejo (textura): 6 notas por compasso, sincopado; mais aberto e longo na Evolução
    const order = ARP_ORDER[bar % 2];
    ARP_STEPS.forEach((st, k) => {
      if (sp.arpUntil && st >= sp.arpUntil) return;
      const airy = bar >= 9;
      m.put(at(st), V.pluckFM({ freq: hz(ch.arp[order[k]]), dur: airy ? 1.2 : 0.6, tau: airy ? 0.42 : 0.17, index: 1.5 }), null, {
        gain: 0.085 * (sp.arp ?? 0.6) * (k === 0 ? 1 : 0.72) * hVel(1), pan: k % 2 ? 0.4 : -0.4, send: 0.4, delay: 0.5,
      });
    });
  }
  cue("music", "groove-começa", barT(2));
  cue("music", "percussão-cai", barT(8, 8));

  // Motivo principal: entra com "Agora, um só.", volta no treino, na evolução e no fechamento
  const playMotif = (bar, upTo = MOTIF.length) => {
    MOTIF.slice(0, upTo).forEach(([st, note]) => {
      m.put(barT(bar, st), V.pluckFM({ freq: hz(note), dur: 1.9, tau: 0.72, index: 2.0 }), null, { gain: 0.19, pan: (st % 2 ? 0.25 : -0.25), send: 0.55, delay: 0.6 });
    });
    cue("music", "motivo", barT(bar));
  };
  playMotif(1);
  playMotif(5);
  playMotif(9);
  playMotif(12, 3); // D5, A5 e F5: o F5 cai junto com "Nada além disso." (27,52 s)

  // Evolução: brilho sustentado nas oitavas altas, "mais amplo"
  const [sl, sr] = V.shimmer({ notes: ["E5", "A5", "C6", "E6"], dur: 3 * BAR - 0.4, attack: 1.8, release: 1.8 });
  m.put(barT(9), sl, sr, { gain: 0.07, send: 0.85 });
  cue("music", "shimmer-evolução", barT(9));
}

// ================================ IMPACTOS ==========================================
function buildImpacts(p) {
  // Gancho: três pequenos "problemas". Graves secos com um agrupamento dissonante que vai crescendo.
  const clusters = [["A2", "Bb2"], ["A2", "Bb2", "E3", "F3"], ["A2", "Bb2", "E3", "F3", "Db4", "D4"]];
  const lv = [0.55, 0.75, 1];
  CUES.hook.lines.forEach((f, i) => {
    const t = S(f) + 0.13;
    p.put(t, V.sub({ freq: 58, dur: 0.05, release: 0.3, glideFrom: 96, glideTau: 0.045, drive: 1.6, tau: 0.16 }), null, { gain: 0.34 * lv[i], send: 0.25 });
    p.put(t, V.tock({ freq: 150, dur: 0.2 }), null, { gain: 0.16 * lv[i], send: 0.3 });
    p.put(t, V.tick({ freq: 1250, dur: 0.05, air: 0.7 }), null, { gain: 0.1 * lv[i], pan: -0.2 + i * 0.2, send: 0.3 });
    clusters[i].forEach((n, k) => p.put(t + 0.004 * k, V.glass({ freq: hz(n), dur: 1.5, tau: 0.6, bright: 0.2 }), null, { gain: 0.085 * lv[i], pan: (k % 2 ? 0.5 : -0.5) * 0.7, send: 0.9 }));
    cue("impacts", `hook-${i + 1}`, t);
  });
  // Tensão: sopro que sobe devagar, e um "inspirar" (varredura reversa) até o logo
  const [tl, tr] = V.noiseSweep({ dur: S(CUES.logo.start) - 2.0, f0: 250, f1: 1900, q: 0.9, shape: (x) => x ** 2.2 });
  p.put(2.0, tl, tr, { gain: 0.028, send: 0.5 });
  const swellStart = S(CUES.logo.start);
  const swellDur = T0 - 0.03 - swellStart; // termina 30 ms antes do impacto: um respiro de silêncio antes do golpe
  const [wl, wr] = V.noiseSweep({ dur: swellDur, f0: 420, f1: 7000, q: 0.8, shape: (x) => x ** 2.6 * (x > 0.94 ? (1 - x) / 0.06 : 1) });
  p.put(swellStart, wl, wr, { gain: 0.085, send: 0.6 });
  cue("impacts", "swell-logo", swellStart);

  // "Agora, um só.": o primeiro grande momento
  p.put(T0, V.boom({ dur: 2.2 }), null, { gain: 0.66, send: 0.28 });
  const [al, ar] = V.noiseSweep({ dur: 1.4, f0: 5200, f1: 500, q: 0.7, shape: (x) => (x < 0.01 ? x / 0.01 : Math.exp(-5 * x)) });
  p.put(T0, al, ar, { gain: 0.07, send: 0.8 });
  cue("impacts", "boom-agora-um-so", T0);

  // Transições
  const sweepUp = (t0, dur, f0, f1, gain, curve = 2) => {
    const [l, r] = V.noiseSweep({ dur, f0, f1, q: 1, shape: (x) => x ** curve });
    p.put(t0, l, r, { gain, send: 0.5 });
  };
  const sweepDown = (t0, dur, f0, f1, gain) => {
    const [l, r] = V.noiseSweep({ dur, f0, f1, q: 0.9, shape: (x) => (x < 0.08 ? x / 0.08 : (1 - x) ** 1.5) });
    p.put(t0, l, r, { gain, send: 0.5 });
  };
  sweepUp(S(CUES.stage.enter) - 0.15, 0.75, 400, 4200, 0.05, 1.8);
  cue("impacts", "whoosh-aparelho-sobe", S(CUES.stage.enter) - 0.15);
  sweepUp(S(CUES.diario.cut) - 0.35, 0.35, 600, 3200, 0.04);
  p.put(S(CUES.diario.cut), V.tock({ freq: 150, dur: 0.2 }), null, { gain: 0.12, send: 0.3 });
  cue("impacts", "corte-diário", S(CUES.diario.cut));
  // Treino: um golpe pequeno (bem abaixo do impacto principal), a energia sobe um degrau
  sweepUp(S(CUES.diario.hoje[0]) - 0.15, S(CUES.treino.cut) - S(CUES.diario.hoje[0]) + 0.15, 500, 5200, 0.06, 2);
  p.put(S(CUES.treino.cut), V.boom({ dur: 1.1, punch: 0.6 }), null, { gain: 0.18, send: 0.25 });
  cue("impacts", "corte-treino", S(CUES.treino.cut));
  // Evolução: sobe durante o compasso 8 e "abre" no corte, sem golpe
  const evo = S(CUES.evolucao.cut);
  sweepUp(barT(8) + 0.1, evo - barT(8) - 0.1, 300, 7000, 0.075, 2.4);
  p.put(evo, V.tock({ freq: 110, dur: 0.3 }), null, { gain: 0.13, send: 0.4 });
  cue("impacts", "corte-evolução", evo);
  sweepDown(S(CUES.stage.exitStart), 0.85, 4200, 300, 0.05);
  cue("impacts", "whoosh-aparelho-sai", S(CUES.stage.exitStart));
}

// ================================ UI ==========================================
function buildUI(u) {
  const chime = (t, freq, gain = 0.1, tau = 0.4) => u.put(t, V.glass({ freq, dur: 1.2, tau }), null, { gain, send: 0.55 });
  const tapSound = (f) => {
    const t = S(f);
    u.put(t, V.tick({ freq: 3000, dur: 0.02, air: 0.15 }), null, { gain: 0.07 });
    u.put(t, V.tock({ freq: 240, dur: 0.1 }), null, { gain: 0.05 });
    cue("ui", "toque", t);
  };
  const odometer = (t0, n, f0 = 1500, gain = 0.035) => {
    for (let i = 0; i < n; i++) u.put(t0 + i * 0.045, V.tick({ freq: f0 + i * 170, dur: 0.03, air: 0.1 }), null, { gain: gain * (0.7 + i / n * 0.5), pan: 0.15 * (i % 2 ? 1 : -1), send: 0.2 });
  };

  // Dieta: o aparelho assenta, os totais "contam", a rolagem sussurra na velocidade real
  const settle = S(CUES.stage.settled);
  u.put(settle, V.tock({ freq: 170, dur: 0.16 }), null, { gain: 0.1, send: 0.2 });
  u.put(settle, V.tick({ freq: 2600, dur: 0.03 }), null, { gain: 0.05 });
  cue("ui", "aparelho-assenta", settle);
  odometer(settle + 0.06, 6, 1500, 0.04);
  cue("ui", "totais-contam", settle + 0.06);
  const [d0, d1] = CUES.dieta.scroll;
  const v1 = scrollVelocity(d0, d1);
  const [wl, wr] = V.whisper({ dur: S(d1 - d0), vel: v1, level: 0.05 });
  u.put(S(d0), wl, wr, { gain: 1, send: 0.2 });
  cue("ui", "rolagem-dieta", S(d0));

  // Diário: troca de título, dois registros de refeição, totais mudam, Hoje mostra o que resta
  u.put(S(CUES.diario.cut) + 0.02, V.tick({ freq: 2000, dur: 0.03 }), null, { gain: 0.05 });
  CUES.diario.taps.forEach((tf, i) => {
    tapSound(tf);
    const ts = S(CUES.diario.states[i]);
    chime(ts, hz(i ? "F5" : "D5"), 0.1);
    chime(ts + 0.07, hz(i ? "C6" : "A5"), 0.085);
    odometer(ts + 0.03, 5, 1700 + i * 200, 0.04);
    cue("ui", "refeição-registrada", ts);
  });
  const h0 = S(CUES.diario.hoje[0]);
  const [hl, hr2] = V.noiseSweep({ dur: 0.4, f0: 900, f1: 4800, q: 1.2, shape: (x) => Math.sin(Math.PI * x) ** 2 });
  u.put(h0 + 0.03, hl, hr2, { gain: 0.03, send: 0.4 });
  chime(S(CUES.diario.hoje[1]) - 0.06, hz("D6"), 0.07, 0.5);
  cue("ui", "hoje-kcal-restantes", S(CUES.diario.hoje[1]) - 0.06);

  // Treino: "Última vez" (memória), séries concluídas subindo em D-F-A, descanso começando
  const uv = S(CUES.treino.ultimaVez) + 0.03;
  chime(uv, hz("A5"), 0.09, 0.4);
  chime(uv + 0.09, hz("D5"), 0.08, 0.4);
  cue("ui", "ultima-vez", uv);
  CUES.treino.taps.forEach((tf, i) => {
    tapSound(tf);
    const ts = S(CUES.treino.states[i]);
    chime(ts, hz(["D5", "F5", "A5"][i]), 0.1 + i * 0.01, 0.45);
    if (i === 2) chime(ts + 0.07, hz("E6"), 0.05, 0.5);
    u.put(ts + 0.05, V.tock({ freq: 130, dur: 0.22 }), null, { gain: i === 0 ? 0.1 : 0.06, send: 0.3 });
    cue("ui", i === 0 ? "série-concluída+descanso" : "série-concluída", ts);
  });

  // Evolução: o gráfico chega como uma pequena recompensa; volume e recordes aparecem
  const e0 = S(CUES.evolucao.cut) + 0.1;
  ["D5", "A5", "D6", "F6"].forEach((n, k) => chime(e0 + k * 0.075, hz(n), 0.075, 0.9));
  cue("ui", "gráfico-recompensa", e0);
  CUES.evolucao.scroll.forEach(([a, b], k) => {
    const [wl2, wr2] = V.whisper({ dur: S(b - a), vel: scrollVelocity(a, b), level: 0.045 });
    u.put(S(a), wl2, wr2, { gain: 1, send: 0.25 });
    cue("ui", `rolagem-evolução-${k + 1}`, S(a));
  });
  const vb = S(CUES.evolucao.scroll[0][1]) - 0.2;
  ["D5", "F5", "A5"].forEach((n, k) => chime(vb + k * 0.11, hz(n), 0.08, 0.7));
  cue("ui", "volume-semanal", vb);
  const rc = S(CUES.evolucao.scroll[1][0]) + 1.0;
  chime(rc, hz("C6"), 0.06, 0.8);
  chime(rc + 0.12, hz("E6"), 0.055, 0.9);
  cue("ui", "recordes", rc);
}

// ================================ FECHAMENTO ==========================================
function buildClosing(c) {
  // As três linhas resolvem, em notas consonantes, o "problema, problema, problema" do começo
  CUES.fechamento.lines.forEach((f, i) => {
    c.put(S(f) + 0.02, V.glass({ freq: hz(["D5", "F5", "A5"][i]), dur: 1.6, tau: 0.55 }), null, { gain: 0.1, send: 0.7 });
    cue("closing", `linha-${i + 1}`, S(f) + 0.02);
  });
  // "Nada além disso.": uma resolução calorosa, não um impacto
  const nada = S(CUES.fechamento.nada[0]);
  c.put(nada, V.sub({ freq: hz("D2"), dur: 0.3, attack: 0.03, release: 0.55, drive: 1.2 }), null, { gain: 0.3, send: 0.2 });
  const [pl, pr] = V.padChord({ notes: ["D3", "A3", "D4", "F4", "A4"], dur: 0.4, attack: 0.2, release: 0.5, cutoff: [1400, 2600], seed: 41 });
  c.put(nada, pl, pr, { gain: 0.22, send: 0.5 });
  c.put(nada, V.tock({ freq: 110, dur: 0.3 }), null, { gain: 0.16, send: 0.3 });
  cue("closing", "nada-além-disso", nada);
  // Assinatura: A5 -> D6 (quinta e oitava, sem terça, então nem alegre nem triste), e o calor de D3 por baixo
  const cta = S(CUES.fechamento.cta[0]);
  const sig = cta + 0.53; // 29,2 s, quando o bloco da chamada já está legível
  c.put(sig, V.glass({ freq: hz("A5"), dur: 1.6, tau: 0.6 }), null, { gain: 0.1, send: 0.85 });
  c.put(sig + 0.24, V.glass({ freq: hz("D6"), dur: 1.4, tau: 0.6 }), null, { gain: 0.09, send: 0.9 });
  c.put(sig, V.sub({ freq: hz("D3"), dur: 0.3, attack: 0.05, release: 0.9 }), null, { gain: 0.08, send: 0.6 });
  cue("closing", "assinatura", sig);
}

// ================================ orquestração ==========================================
const REVERBS = {
  music: { ir: { rt60: 2.4, predelay: 0.025, hfStart: 7000, hfEnd: 1500, lowCut: 160, seed: 11 }, wet: 0.3, delay: { time: BEAT * 0.75, feedback: 0.38, lp: 4200, hp: 350, mix: 0.32, toReverb: 0.5 } },
  impacts: { ir: { rt60: 3.2, predelay: 0.03, hfStart: 6500, hfEnd: 1300, lowCut: 140, seed: 22 }, wet: 0.3, delay: null },
  ui: { ir: { rt60: 1.3, predelay: 0.012, hfStart: 12000, hfEnd: 4000, lowCut: 260, seed: 33 }, wet: 0.36, delay: null },
  closing: { ir: { rt60: 3.0, predelay: 0.03, hfStart: 8000, hfEnd: 1800, lowCut: 180, seed: 44 }, wet: 0.42, delay: null },
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
  hs = 90210;
  cues.length = 0;
  const tracks = { music: new Track("music"), impacts: new Track("impacts"), ui: new Track("ui"), closing: new Track("closing") };
  buildMusic(tracks.music);
  buildImpacts(tracks.impacts);
  buildUI(tracks.ui);
  buildClosing(tracks.closing);
  const out = {};
  for (const [name, tr] of Object.entries(tracks)) {
    const cfg = REVERBS[name];
    V.finishTrack(tr, { reverb: new Reverb(makeIR(cfg.ir)), wet: cfg.wet, delay: cfg.delay, profile, kind: name, ceilingDb: SYNTH.stemCeilingDb, crestDb: SYNTH.mobileCrestDb[name] });
    if (name === "closing") duck(tr, 28.3, 28.4, 28.72, 28.85, -42);
    const g = lin(SYNTH.stemPeakDb[name]) / lin(peakDb(tr.L, tr.R));
    for (let i = 0; i < N; i++) { tr.L[i] *= g; tr.R[i] *= g; }
    out[name] = tr;
  }
  return out;
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
