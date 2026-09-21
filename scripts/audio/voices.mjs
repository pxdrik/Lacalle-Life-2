// Efeitos do áudio v2: swoosh de transição de página e clique de interface. Todos limpos
// (nada de saturação, nada de tom musical). Quem posiciona no tempo é o Track.
import { N, SR, TAU, applyBiquad, biquad, compress, fadeEnds, hz, limit, rng, sawBL, svf, width } from "./dsp.mjs";

const smooth = (x) => x * x * (3 - 2 * x);

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
    this.dlyL = new Float32Array(N);
    this.dlyR = new Float32Array(N);
  }
  /** Estéreo: xr === null significa mono com `pan` em [-1, 1]. */
  put(t0, xl, xr, { gain = 1, pan = 0, send = 0, delay = 0 } = {}) {
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
      if (delay) { this.dlyL[k] += l * delay; this.dlyR[k] += r * delay; }
    }
  }
}

/** Seno puro sustentado (grave limpo), com ataque e saída suaves. */
export function sub({ freq, dur, attack = 0.5, release = 0.8 }) {
  const n = n_(dur + release);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let env = smooth(Math.min(1, t / attack));
    if (t > dur) env *= Math.max(0, 1 - (t - dur) / release);
    x[i] = Math.sin(TAU * freq * t) * env;
  }
  return fadeEnds(x, 0, 6);
}

/** Ar: ruído filtrado em banda média, macio, com o filtro respirando devagar. Estéreo decorrelacionado. */
export function texture({ dur, f = 1400, depth = 600, rate = 0.05, q = 0.5, lp = 3500 }) {
  const n = n_(dur);
  return [0, 1].map((c) => {
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = noise();
    const y = svf(x, (t) => f + depth * Math.sin(TAU * rate * t + c * 1.7), q, "bp");
    return applyBiquad(y, biquad("lp", lp, 0.7));
  });
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

/**
 * "Pop" de recompensa: um seno curto que sobe de pitch (de `f0` a `f1`), com um estalo de ar de
 * poucos milissegundos no começo. Limpo, sem saturação; é o som de "acertou".
 */
export function pop({ f0 = 700, f1 = 1300, dur = 0.12 }) {
  const n = n_(dur);
  const nz = new Float32Array(n);
  for (let i = 0; i < n; i++) nz[i] = noise();
  const air = svf(nz, 4200, 1.2, "bp");
  const x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f0 * (f1 / f0) ** Math.min(1, t / (dur * 0.35));
    ph += f / SR;
    const a = Math.min(1, t / 0.002);
    x[i] = a * (Math.sin(TAU * ph) + 0.12 * Math.sin(TAU * 2 * ph)) * Math.exp(-t / (dur * 0.28)) + 0.5 * air[i] * Math.exp(-t / 0.004);
  }
  return fadeEnds(x, 0, 8);
}

/**
 * Batida grave de impacto: seno que cai de pitch, com o 2º e o 3º harmônicos (para continuar audível
 * no alto-falante do celular, que corta o grave) e um estalo curto de ar. Sem saturação.
 */
export function thump({ freq = 58, dur = 0.34 }) {
  const n = n_(dur);
  const nz = new Float32Array(n);
  for (let i = 0; i < n; i++) nz[i] = noise();
  const air = svf(nz, 1600, 0.9, "bp");
  const x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (freq * (1 + 1.4 * Math.exp(-t / 0.03))) / SR;
    const a = Math.min(1, t / 0.002);
    x[i] = a * (Math.sin(TAU * ph) * Math.exp(-t / 0.11) + 0.4 * Math.sin(TAU * 2 * ph) * Math.exp(-t / 0.06) + 0.25 * Math.sin(TAU * 3 * ph) * Math.exp(-t / 0.045) + 0.3 * air[i] * Math.exp(-t / 0.006));
  }
  return fadeEnds(x, 0, 24);
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
    const pres = biquad("peak", 3000, 0.8, kind === "clicks" ? 3 : kind === "music" ? 0 : 2);
    applyBiquad(L, pres);
    applyBiquad(R, pres);
    width(L, R, kind === "clicks" ? 0.7 : 0.6);
    compress(L, R, kind === "music" ? { thr: -34, ratio: 1.4, atk: 0.05, rel: 0.4, knee: 10, makeup: 1 } : { thr: -32, ratio: 1.8, atk: 0.02, rel: 0.25, knee: 8, makeup: 2 });
  }
  limit(L, R, { ceilingDb, lookMs: 3, relMs: 120 });
  return track;
}
