// Instrumentos do áudio v2, todos limpos (nada de saturação): base sustentada, baque grave,
// nota tonal redonda e subidas. Quem posiciona no tempo é o Track.
import { N, SR, TAU, applyBiquad, biquad, compress, fadeEnds, hz, limit, rng, sawBL, svf, width } from "./dsp.mjs";

let noise = rng(20260920);
export const reseed = (s = 20260920) => { noise = rng(s); };
export const n_ = (d) => Math.max(1, Math.ceil(d * SR));
const smooth = (x) => x * x * (3 - 2 * x);

/** Um stem: acumula o sinal seco e o envio de reverb. */
export class Track {
  constructor(name) {
    this.name = name;
    this.L = new Float32Array(N);
    this.R = new Float32Array(N);
    this.sendL = new Float32Array(N);
    this.sendR = new Float32Array(N);
  }
  /** Estéreo: xr === null significa mono com `pan` em [-1, 1]. */
  put(t0, xl, xr, { gain = 1, pan = 0, send = 0 } = {}) {
    const s0 = Math.round(t0 * SR);
    const a = ((pan + 1) * Math.PI) / 4;
    const gl = xr ? gain : gain * Math.cos(a) * Math.SQRT2;
    const gr = xr ? gain : gain * Math.sin(a) * Math.SQRT2;
    for (let i = 0; i < xl.length; i++) {
      const k = s0 + i;
      if (k < 0 || k >= N) continue;
      const l = xl[i] * gl;
      const r = (xr ? xr[i] : xl[i]) * gr;
      this.L[k] += l;
      this.R[k] += r;
      if (send) { this.sendL[k] += l * send; this.sendR[k] += r * send; }
    }
  }
}

/** Seno puro sustentado, com glide e decaimento opcionais. */
export function sub({ freq, dur, attack = 0.01, release = 0.12, glideFrom = 0, glideTau = 0.06, tau = 0 }) {
  const n = n_(dur + release);
  const x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (glideFrom ? freq + (glideFrom - freq) * Math.exp(-t / glideTau) : freq) / SR;
    let env = smooth(Math.min(1, t / attack));
    if (t > dur) env *= Math.max(0, 1 - (t - dur) / release);
    if (tau) env *= Math.exp(-t / tau);
    x[i] = Math.sin(TAU * ph) * env;
  }
  return fadeEnds(x, 0, 6);
}

/**
 * Base sustentada: trio de serras band-limited desafinadas por nota, passa-baixa móvel e uma
 * "respiração" lenta de volume (`breath`). `cutoff` é [de, até] ou uma função do tempo local.
 */
export function padChord({ notes, dur, attack = 1, release = 1.2, cutoff = [900, 900], q = 0.7, detune = 5, breath = 0, seed = 1 }) {
  const n = n_(dur + release);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const r = rng(seed);
  notes.forEach((name, ni) => {
    const f0 = hz(name);
    for (let v = 0; v < 3; v++) {
      const f = f0 * 2 ** (((v - 1) * detune) / 1200);
      const dt = f / SR;
      let ph = r() * 0.5 + 0.5;
      const pan = (v - 1) * 0.55 + (ni % 2 ? 0.15 : -0.15);
      const gl = Math.cos(((pan + 1) * Math.PI) / 4);
      const gr = Math.sin(((pan + 1) * Math.PI) / 4);
      for (let i = 0; i < n; i++) {
        const s = sawBL(ph, dt);
        ph += dt;
        if (ph >= 1) ph -= 1;
        L[i] += s * gl;
        R[i] += s * gr;
      }
    }
  });
  const cf = Array.isArray(cutoff) ? (t) => cutoff[0] + (cutoff[1] - cutoff[0]) * Math.min(1, t / dur) : cutoff;
  const fc = (t) => cf(t) * (1 + 0.05 * Math.sin(TAU * 0.13 * t));
  const l = svf(L, fc, q, "lp");
  const rr = svf(R, fc, q, "lp");
  const norm = 1 / Math.sqrt(notes.length * 3);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let env = smooth(Math.min(1, t / attack)) * (1 + breath * Math.sin(TAU * 0.11 * t));
    if (t > dur) env *= Math.max(0, 1 - (t - dur) / release);
    l[i] *= env * norm;
    rr[i] *= env * norm;
  }
  return [l, rr];
}

/** Brilho sustentado em oitavas altas (senos com vibrato lento), bem baixo. */
export function shimmer({ notes, dur, attack = 1.6, release = 1.6, seed = 3 }) {
  const n = n_(dur + release);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const r = rng(seed);
  notes.forEach((name, i) => {
    const f = hz(name);
    const lfo = 0.13 + 0.05 * i;
    const p0 = r() * TAU;
    const pan = i % 2 ? 0.7 : -0.7;
    const gl = Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = Math.sin(((pan + 1) * Math.PI) / 4);
    for (let k = 0; k < n; k++) {
      const t = k / SR;
      const s = Math.sin(TAU * f * t + 0.6 * Math.sin(TAU * lfo * t + p0)) * (0.7 + 0.3 * Math.sin(TAU * lfo * 0.7 * t + p0));
      let env = smooth(Math.min(1, t / attack));
      if (t > dur) env *= Math.max(0, 1 - (t - dur) / release);
      L[k] += s * env * gl;
      R[k] += s * env * gr;
    }
  });
  const norm = 1 / Math.sqrt(notes.length);
  for (let i = 0; i < n; i++) { L[i] *= norm; R[i] *= norm; }
  return [L, R];
}

/**
 * Nota tonal redonda (marimba/vidro macio): fundamental + harmônicos que morrem rápido,
 * ataque de 5 ms. É o "som de interface" e a melodia ao mesmo tempo.
 */
export function mallet({ freq, dur = 1.8, tau = 0.6, bright = 1 }) {
  const n = n_(dur);
  const x = new Float32Array(n);
  for (const [r, a, d] of [[1, 1, 1], [2, 0.16 * bright, 0.45], [3, 0.05 * bright, 0.25], [4.01, 0.02 * bright, 0.15]]) {
    const w = TAU * freq * r;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      x[i] += Math.sin(w * t) * a * Math.exp(-t / (tau * d));
    }
  }
  for (let i = 0; i < n; i++) x[i] *= Math.min(1, i / SR / 0.005);
  return fadeEnds(x, 0, 20);
}

/** Golpe grave limpo: senos com queda de pitch e um segundo harmônico audível em caixa pequena. Sem saturação. */
export function hit({ dur = 2 }) {
  const n = n_(dur);
  const x = new Float32Array(n);
  const nz = new Float32Array(n);
  for (let i = 0; i < n; i++) nz[i] = noise();
  const air = svf(nz, 900, 0.7, "lp");
  let p = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    p += (44 + 50 * Math.exp(-t / 0.09)) / SR;
    const a = smooth(Math.min(1, t / 0.006));
    x[i] = a * (Math.sin(TAU * p) * Math.exp(-t / 0.5) + 0.34 * Math.sin(TAU * 2 * p) * Math.exp(-t / 0.22) + 0.15 * air[i] * Math.exp(-t / 0.07));
  }
  return fadeEnds(x, 0, 40);
}

/** Subida de tom (dois senos levemente desafinados) que ganha volume até o fim. */
export function riserTone({ dur, f0, f1, curve = 2.6 }) {
  const n = n_(dur);
  const x = new Float32Array(n);
  let pa = 0, pb = 0;
  for (let i = 0; i < n; i++) {
    const p = i / n;
    const f = f0 * (f1 / f0) ** p;
    pa += f / SR;
    pb += (f * 1.004) / SR;
    x[i] = (Math.sin(TAU * pa) + Math.sin(TAU * pb)) * 0.5 * p ** curve * (p > 0.94 ? (1 - p) / 0.06 : 1);
  }
  return fadeEnds(x, 10, 10);
}

/** Varredura de ruído filtrado (sopro). shape(p) dá a curva de amplitude em [0,1]. */
export function noiseSweep({ dur, f0, f1, q = 1.1, shape = (p) => p * p, mode = "bp" }) {
  const n = n_(dur);
  return [0, 1].map(() => {
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = noise();
    const y = svf(x, (t) => f0 * (f1 / f0) ** Math.min(1, t / dur), q, mode);
    for (let i = 0; i < n; i++) y[i] *= shape(i / n);
    return fadeEnds(y, 4, 8);
  });
}

/** Soma o reverb, tira o subgrave inútil e aplica o perfil. Sem saturação e sem excitador de grave. */
export function finishTrack(track, { reverb, wet = 0.3, profile = "cinematic", kind = "music", ceilingDb = -3 }) {
  const { L, R } = track;
  const wl = reverb.run(track.sendL, 0);
  const wr = reverb.run(track.sendR, 1);
  for (let i = 0; i < N; i++) {
    L[i] += wl[i] * wet;
    R[i] += wr[i] * wet;
  }
  const hp = biquad("hp", 28, 0.7);
  applyBiquad(L, hp);
  applyBiquad(R, hp);
  if (profile === "mobile") {
    // Celular: sem o que o alto-falante não reproduz (< ~80 Hz), um pouco de presença, mais centrado.
    const hp2 = biquad("hp", 80, 0.7);
    applyBiquad(L, hp2);
    applyBiquad(R, hp2);
    const pres = biquad("peak", 3000, 0.8, kind === "ui" ? 3 : 2);
    applyBiquad(L, pres);
    applyBiquad(R, pres);
    width(L, R, kind === "ui" ? 0.7 : 0.6);
    compress(L, R, { thr: -32, ratio: 1.8, atk: 0.02, rel: 0.25, knee: 8, makeup: 2 });
  }
  limit(L, R, { ceilingDb, lookMs: 3, relMs: 120 });
  return track;
}
