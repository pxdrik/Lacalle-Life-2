// Efeitos do áudio v2: swoosh de transição de página e clique de interface. Todos limpos
// (nada de saturação, nada de tom musical). Quem posiciona no tempo é o Track.
import { N, SR, TAU, applyBiquad, biquad, compress, fadeEnds, limit, rng, svf, width } from "./dsp.mjs";

let noise = rng(20260920);
export const reseed = (s = 20260920) => { noise = rng(s); };
export const n_ = (d) => Math.max(1, Math.ceil(d * SR));

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

/**
 * Swoosh de transição de página: ar filtrado (ruído rosa em banda larga) que sobe ou desce de
 * frequência, com envelope em sino suave (pico em 44%) e largura estéreo. Sem clique, sem chiado.
 */
export function swoosh({ dur = 0.42, f0 = 900, f1 = 3600, q = 0.75 }) {
  const n = n_(dur);
  return [0, 1].map(() => {
    const x = new Float32Array(n);
    let b0 = 0, b1 = 0, b2 = 0; // ruído rosa (aproximação de Paul Kellet)
    for (let i = 0; i < n; i++) {
      const w = noise();
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      x[i] = (b0 + b1 + b2 + w * 0.1848) * 0.3;
    }
    const y = svf(x, (t) => f0 * (f1 / f0) ** Math.min(1, t / dur), q, "bp");
    for (let i = 0; i < n; i++) {
      const p = i / n;
      y[i] *= (p ** 1.6 * (1 - p) ** 2) / 0.0844; // sino assimétrico normalizado a 1 no pico
    }
    return fadeEnds(y, 6, 10);
  });
}

/**
 * Clique de interface, sem tom definido: um corpo grave curto que cai de pitch (o "toque") e um
 * estalo agudo macio por cima. `body: 0` dá só o estalo (o tique de confirmação).
 */
export function click({ body = 190, top = 2600, dur = 0.07, bodyGain = 1, topGain = 1.4 }) {
  const n = n_(dur);
  const nz = new Float32Array(n);
  for (let i = 0; i < n; i++) nz[i] = noise();
  const air = svf(nz, top, 1.1, "bp");
  const x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (body * (1 + 0.7 * Math.exp(-t / 0.008))) / SR;
    const a = Math.min(1, t / 0.0008);
    x[i] = a * ((body ? bodyGain * Math.sin(TAU * ph) * Math.exp(-t / 0.016) : 0) + topGain * air[i] * Math.exp(-t / 0.005));
  }
  return fadeEnds(x, 0, 6);
}

/** Soma o reverb, tira o subgrave inútil e aplica o perfil. Sem saturação. */
export function finishTrack(track, { reverb, wet = 0.3, profile = "cinematic", kind = "swooshes", ceilingDb = -3 }) {
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
    const pres = biquad("peak", 3000, 0.8, kind === "clicks" ? 3 : 2);
    applyBiquad(L, pres);
    applyBiquad(R, pres);
    width(L, R, kind === "clicks" ? 0.7 : 0.6);
    compress(L, R, { thr: -32, ratio: 1.8, atk: 0.02, rel: 0.25, knee: 8, makeup: 2 });
  }
  limit(L, R, { ceilingDb, lookMs: 3, relMs: 120 });
  return track;
}
