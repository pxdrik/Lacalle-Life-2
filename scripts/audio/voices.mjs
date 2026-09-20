// Instrumentos e efeitos procedurais. Cada função devolve amostras; quem posiciona no tempo é o Track.
import {
  N, SR, TAU, applyBiquad, biquad, compress, fadeEnds, hz, limit, pingPong, rng, sawBL, softClip, svf, width,
} from "./dsp.mjs";

let noise = rng(20260920);
export const reseed = (s = 20260920) => { noise = rng(s); };
export const n_ = (d) => Math.max(1, Math.ceil(d * SR));
const smooth = (x) => x * x * (3 - 2 * x);

/** Um stem: acumula o sinal seco, o envio de reverb e o envio de delay. */
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

// --- graves e pulsos --------------------------------------------------------------
/** Seno sustentado (sub), com glide opcional e um toque de saturação para audibilidade. */
export function sub({ freq, dur, attack = 0.01, release = 0.12, glideFrom = 0, glideTau = 0.06, drive = 0, tau = 0 }) {
  const n = n_(dur + release);
  const x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = glideFrom ? freq + (glideFrom - freq) * Math.exp(-t / glideTau) : freq;
    ph += f / SR;
    let env = Math.min(1, t / attack);
    if (t > dur) env *= Math.max(0, 1 - (t - dur) / release);
    if (tau) env *= Math.exp(-t / tau);
    let s = Math.sin(TAU * ph);
    if (drive) s = Math.tanh(s * drive) / Math.tanh(drive);
    x[i] = s * env;
  }
  return fadeEnds(x, 0, 6);
}

export function bassPluck({ freq, dur = 0.55, cutHigh = 1500, cutLow = 170, tau = 0.11 }) {
  const n = n_(dur);
  const x = new Float32Array(n);
  const dt1 = (freq * 1.0023) / SR;
  const dt2 = (freq * 0.9977) / SR;
  let p1 = 0.1, p2 = 0.6, ps = 0;
  for (let i = 0; i < n; i++) {
    x[i] = 0.5 * sawBL(p1, dt1) + 0.5 * sawBL(p2, dt2) + 0.9 * Math.sin(TAU * ps);
    p1 = (p1 + dt1) % 1;
    p2 = (p2 + dt2) % 1;
    ps += freq / SR;
  }
  const y = svf(x, (t) => cutLow + (cutHigh - cutLow) * Math.exp(-t / tau), 1.3, "lp");
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    y[i] *= Math.min(1, t / 0.003) * Math.exp(-t / (dur * 0.42));
  }
  return fadeEnds(y, 0, 8);
}

export function kick({ dur = 0.5, f0 = 118, f1 = 46, tauF = 0.032, tau = 0.17 } = {}) {
  const n = n_(dur);
  const x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (f1 + (f0 - f1) * Math.exp(-t / tauF)) / SR;
    x[i] = Math.tanh(1.5 * Math.sin(TAU * ph)) * Math.min(1, t / 0.002) * Math.exp(-t / tau);
  }
  return fadeEnds(x, 0, 10);
}

// --- percussão fina ---------------------------------------------------------------
export function hat({ dur = 0.06, tau = 0.014, hp = 7500 } = {}) {
  const n = n_(dur);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = noise() * Math.exp(-(i / SR) / tau);
  return fadeEnds(applyBiquad(x, biquad("hp", hp, 0.7)), 0, 3);
}
export function shaker({ dur = 0.09 } = {}) {
  const n = n_(dur);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    x[i] = noise() * Math.min(1, t / 0.008) * Math.exp(-t / 0.028);
  }
  return fadeEnds(applyBiquad(x, biquad("bp", 5200, 0.9)), 0, 4);
}
/** Estalo seco e curto, quase uma nota: marca contratempos sem virar caixa. */
export function rim({ freq = 1750 } = {}) {
  const n = n_(0.05);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    x[i] = (Math.sin(TAU * freq * t) + 0.6 * Math.sin(TAU * freq * 0.5 * t) + 0.25 * noise()) * Math.exp(-t / 0.007);
  }
  return fadeEnds(x, 0, 2);
}
export function snap({ dur = 0.22 } = {}) {
  const n = n_(dur);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let env = 0;
    for (const o of [0, 0.009, 0.018]) if (t >= o) env += 0.5 * Math.exp(-(t - o) / 0.004);
    env += 0.55 * Math.exp(-t / 0.075) * Math.min(1, t / 0.02);
    x[i] = noise() * env + 0.3 * Math.sin(TAU * 190 * t) * Math.exp(-t / 0.03);
  }
  return fadeEnds(applyBiquad(x, biquad("bp", 1900, 0.8)), 0, 6);
}

// --- tons melódicos ---------------------------------------------------------------
/** Pluck FM: brilho no ataque que se fecha rápido. Base do motivo e do arpejo. */
export function pluckFM({ freq, dur = 1.1, ratio = 2, index = 2.3, idxTau = 0.08, tau = 0.42 }) {
  const n = n_(dur);
  const x = new Float32Array(n);
  let pc = 0, pm = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    pm += (freq * ratio) / SR;
    pc += freq / SR;
    x[i] = Math.sin(TAU * pc + index * Math.exp(-t / idxTau) * Math.sin(TAU * pm)) * Math.min(1, t / 0.002) * Math.exp(-t / tau);
  }
  return fadeEnds(x, 0, 12);
}

/** Nota de vidro: parciais quase harmônicos (um toque inarmônico), para UI e assinatura. */
export function glass({ freq, dur = 1.4, tau = 0.5, bright = 1 }) {
  const n = n_(dur);
  const x = new Float32Array(n);
  const parts = [[1, 1, 1], [2.001, 0.42 * bright, 0.55], [3.005, 0.2 * bright, 0.32], [4.166, 0.1 * bright, 0.2]];
  for (const [r, a, d] of parts) {
    const w = TAU * freq * r;
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      x[i] += Math.sin(w * t) * a * Math.exp(-t / (tau * d));
    }
  }
  for (let i = 0; i < n; i++) x[i] *= Math.min(1, (i / SR) / 0.003);
  return fadeEnds(x, 0, 15);
}

/** Acorde sustentado: serras band-limited em trio desafinado + filtro passa-baixa móvel. */
export function padChord({ notes, dur, attack = 1, release = 1.2, cutoff = [900, 900], q = 0.7, detune = 9, seed = 1 }) {
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
  const cf = Array.isArray(cutoff)
    ? (t) => cutoff[0] + (cutoff[1] - cutoff[0]) * Math.min(1, t / dur)
    : cutoff;
  const fc = (t) => cf(t) * (1 + 0.06 * Math.sin(TAU * 0.17 * t));
  const l = svf(L, fc, q, "lp");
  const rr = svf(R, fc, q, "lp");
  const norm = 1 / Math.sqrt(notes.length * 3);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let env = smooth(Math.min(1, t / attack));
    if (t > dur) env *= Math.max(0, 1 - (t - dur) / release);
    l[i] *= env * norm;
    rr[i] *= env * norm;
  }
  return [l, rr];
}

/** Brilho sustentado em oitavas altas (senos com vibrato lento), para a seção de abertura. */
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

// --- efeitos ------------------------------------------------------------------------
/** Varredura de ruído filtrado (whoosh/riser). shape(p) dá a curva de amplitude em [0,1]. */
export function noiseSweep({ dur, f0, f1, q = 1.1, shape = (p) => p * p, mode = "bp" }) {
  const n = n_(dur);
  const out = [0, 1].map(() => {
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = noise();
    const y = svf(x, (t) => f0 * (f1 / f0) ** Math.min(1, t / dur), q, mode);
    for (let i = 0; i < n; i++) y[i] *= shape(i / n);
    return fadeEnds(y, 4, 8);
  });
  return out;
}

/** Corpo do impacto principal: sub com queda de pitch + tom audível no celular + sopro curto. */
export function boom({ dur = 2, punch = 1 }) {
  const n = n_(dur);
  const x = new Float32Array(n);
  let p1 = 0, p2 = 0;
  const nz = new Float32Array(n);
  for (let i = 0; i < n; i++) nz[i] = noise();
  const thump = svf(nz, 420, 0.7, "lp");
  const click = svf(nz, 2600, 1.1, "bp");
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    p1 += (36 + 64 * Math.exp(-t / 0.075)) / SR;
    p2 += (73.4 + 22 * Math.exp(-t / 0.05)) / SR;
    const a = Math.min(1, t / 0.004);
    const body = Math.tanh(1.3 * Math.sin(TAU * p1)) * Math.exp(-t / 0.62);
    const mid = Math.sin(TAU * p2) * Math.exp(-t / 0.34) * 0.55;
    x[i] = (body + mid) * a + punch * (thump[i] * Math.exp(-t / 0.05) * 0.5 + click[i] * Math.exp(-t / 0.007) * 0.14);
  }
  return fadeEnds(x, 0, 30);
}

/** Toque seco de interface: senoide curta + um fio de ruído, quase um clique de vidro. */
export function tick({ freq = 2400, dur = 0.035, air = 0.25 } = {}) {
  const n = n_(dur);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    x[i] = (Math.sin(TAU * freq * t) + air * noise()) * Math.min(1, t / 0.0006) * Math.exp(-t / 0.007);
  }
  return fadeEnds(applyBiquad(x, biquad("hp", 900, 0.7)), 0, 2);
}
/** Batida grave curta, para "assentar" (a tela chega, o número muda). */
export function tock({ freq = 190, dur = 0.16 } = {}) {
  const n = n_(dur);
  const x = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (freq * (1 + 0.6 * Math.exp(-t / 0.02))) / SR;
    x[i] = Math.sin(TAU * ph) * Math.min(1, t / 0.002) * Math.exp(-t / 0.045);
  }
  return fadeEnds(x, 0, 6);
}
/** Ruído filtrado cuja energia e cor seguem a velocidade da rolagem da tela. */
export function whisper({ dur, vel, level = 1 }) {
  const n = n_(dur);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = noise();
  const y = svf(x, (t) => 1500 + 2600 * vel(t), 0.9, "bp");
  const yl = svf(x.map(() => noise()), (t) => 1500 + 2600 * vel(t), 0.9, "bp");
  for (let i = 0; i < n; i++) {
    const v = vel(i / SR);
    const e = level * v ** 1.3;
    y[i] *= e;
    yl[i] *= e;
  }
  return [fadeEnds(y, 12, 12), fadeEnds(yl, 12, 12)];
}

// --- acabamento de cada stem -----------------------------------------------------------
/** RMS (dBFS) só dos trechos com som, para medir o "corpo" do stem sem as pausas. */
function activeRmsDb(L, R) {
  const blk = 4800;
  let e = 0, c = 0;
  for (let s = 0; s + blk <= L.length; s += blk) {
    let b = 0;
    for (let i = s; i < s + blk; i++) b += L[i] * L[i] + R[i] * R[i];
    b /= 2 * blk;
    if (b > 3e-6) { e += b; c++; }
  }
  return 10 * Math.log10(e / Math.max(c, 1) + 1e-12);
}

/** Soma delay e reverb, tira o subgrave inútil e aplica o perfil (cinematográfico ou mobile). */
export function finishTrack(track, { reverb, wet = 0.3, delay = null, profile = "cinematic", kind = "music", ceilingDb = -3, crestDb = 0 }) {
  const { L, R } = track;
  if (delay) {
    const [dl, dr] = pingPong(track.dlyL, track.dlyR, delay);
    for (let i = 0; i < N; i++) {
      L[i] += dl[i] * delay.mix;
      R[i] += dr[i] * delay.mix;
      track.sendL[i] += dl[i] * delay.mix * (delay.toReverb ?? 0.5);
      track.sendR[i] += dr[i] * delay.mix * (delay.toReverb ?? 0.5);
    }
  }
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
    const lowKinds = kind === "music" || kind === "impacts";
    if (lowKinds) {
      // Alto-falante de celular não reproduz < ~120 Hz: sintetiza harmônicos do grave (percepção de "peso").
      const mono = new Float32Array(N);
      for (let i = 0; i < N; i++) mono[i] = (L[i] + R[i]) * 0.5;
      const lowBand = svf(mono, 130, 0.7, "lp");
      const harm = applyBiquad(softClip(lowBand, 4), biquad("hp", 150, 0.7));
      for (let i = 0; i < N; i++) { L[i] += harm[i] * 0.55; R[i] += harm[i] * 0.55; }
    }
    const hp2 = biquad("hp", lowKinds ? 62 : 120, 0.7);
    applyBiquad(L, hp2);
    applyBiquad(R, hp2);
    const pres = biquad("peak", 3200, 0.8, kind === "ui" ? 3 : 2);
    applyBiquad(L, pres);
    applyBiquad(R, pres);
    width(L, R, kind === "ui" ? 0.7 : 0.6);
    compress(L, R, { thr: -24, ratio: 2.2, atk: 0.01, rel: 0.16, knee: 6, makeup: 3 });
    // Fator de crista menor: picos ficam mais perto do corpo do som, então o stem soa mais alto
    // no mesmo pico. Alto-falante de celular e feed de rede social pedem isso.
    if (crestDb) limit(L, R, { ceilingDb: activeRmsDb(L, R) + crestDb, lookMs: 3, relMs: 90 });
  }
  limit(L, R, { ceilingDb, lookMs: 3, relMs: 120 });
  return track;
}
