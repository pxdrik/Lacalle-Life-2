// Biblioteca de DSP local, sem dependências: síntese, filtros, reverb por convolução,
// compressor, limitador, medidores (LUFS, true peak) e espectrograma em PNG.
import { writeFileSync } from "node:fs";
import zlib from "node:zlib";

export const SR = 48000;
export const DUR = 30;
export const N = SR * DUR;
export const TAU = Math.PI * 2;
export const db = (x) => 20 * Math.log10(Math.max(x, 1e-12));
export const lin = (d) => 10 ** (d / 20);
export const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Ruído branco determinístico em [-1, 1) (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

// --- notas --------------------------------------------------------------------
const PC = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
export function hz(name) {
  const m = /^([A-G][b#]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`nota inválida: ${name}`);
  return 440 * 2 ** ((PC[m[1]] + 12 * (Number(m[2]) + 1) - 69) / 12);
}

// --- FFT ----------------------------------------------------------------------
const twCache = new Map();
function twiddles(n) {
  let t = twCache.get(n);
  if (!t) {
    const c = new Float64Array(n / 2);
    const s = new Float64Array(n / 2);
    for (let k = 0; k < n / 2; k++) {
      const a = (-TAU * k) / n;
      c[k] = Math.cos(a);
      s[k] = Math.sin(a);
    }
    t = { c, s };
    twCache.set(n, t);
  }
  return t;
}

export function fft(re, im, inverse = false) {
  const n = re.length;
  const { c, s } = twiddles(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const step = n / len;
    for (let i = 0; i < n; i += len) {
      for (let j = 0, k = 0; j < half; j++, k += step) {
        const wr = c[k];
        const wi = inverse ? -s[k] : s[k];
        const a = i + j;
        const b = a + half;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
      }
    }
  }
  if (inverse) {
    const inv = 1 / n;
    for (let i = 0; i < n; i++) { re[i] *= inv; im[i] *= inv; }
  }
}

// --- filtros ------------------------------------------------------------------
/** Coeficientes RBJ. Retorna [b0, b1, b2, a1, a2] já normalizados. */
export function biquad(type, f, q = Math.SQRT1_2, gainDb = 0) {
  const w0 = (TAU * f) / SR;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * q);
  const A = 10 ** (gainDb / 40);
  const sA = Math.sqrt(A);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case "lp": b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = b0; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; break;
    case "hp": b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = b0; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; break;
    case "bp": b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; break;
    case "notch": b0 = 1; b1 = -2 * cos; b2 = 1; a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha; break;
    case "peak": b0 = 1 + alpha * A; b1 = -2 * cos; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cos; a2 = 1 - alpha / A; break;
    case "lowshelf":
      b0 = A * (A + 1 - (A - 1) * cos + 2 * sA * alpha);
      b1 = 2 * A * (A - 1 - (A + 1) * cos);
      b2 = A * (A + 1 - (A - 1) * cos - 2 * sA * alpha);
      a0 = A + 1 + (A - 1) * cos + 2 * sA * alpha;
      a1 = -2 * (A - 1 + (A + 1) * cos);
      a2 = A + 1 + (A - 1) * cos - 2 * sA * alpha;
      break;
    case "highshelf":
      b0 = A * (A + 1 + (A - 1) * cos + 2 * sA * alpha);
      b1 = -2 * A * (A - 1 + (A + 1) * cos);
      b2 = A * (A + 1 + (A - 1) * cos - 2 * sA * alpha);
      a0 = A + 1 - (A - 1) * cos + 2 * sA * alpha;
      a1 = 2 * (A - 1 - (A + 1) * cos);
      a2 = A + 1 - (A - 1) * cos - 2 * sA * alpha;
      break;
    default: throw new Error(`filtro desconhecido: ${type}`);
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

/** Aplica um biquad no lugar (ou em `out`). */
export function applyBiquad(x, c, out = x) {
  const [b0, b1, b2, a1, a2] = c;
  let z1 = 0, z2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    const y = b0 * v + z1;
    z1 = b1 * v - a1 * y + z2;
    z2 = b2 * v - a2 * y;
    out[i] = y;
  }
  return out;
}

export const filt = (x, type, f, q, g) => applyBiquad(x, biquad(type, f, q, g));

/** Filtro de estado variável (TPT) com cutoff que pode variar por amostra. mode: lp | bp | hp */
export function svf(x, fc, q = 0.8, mode = "lp") {
  const out = new Float32Array(x.length);
  const k = 1 / q;
  let ic1 = 0, ic2 = 0;
  const isFn = typeof fc === "function";
  const isArr = typeof fc !== "number" && !isFn;
  let g = Math.tan((Math.PI * (isFn || isArr ? 1000 : fc)) / SR);
  for (let i = 0; i < x.length; i++) {
    if (isFn) g = Math.tan((Math.PI * Math.min(fc(i / SR), SR * 0.45)) / SR);
    else if (isArr) g = Math.tan((Math.PI * Math.min(fc[i], SR * 0.45)) / SR);
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;
    const v3 = x[i] - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    out[i] = mode === "lp" ? v2 : mode === "bp" ? v1 : x[i] - k * v1 - v2;
  }
  return out;
}

// --- osciladores e envelopes --------------------------------------------------
function polyblep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
/** Serra band-limited, fase em [0,1). */
export const sawBL = (phase, dt) => 2 * phase - 1 - polyblep(phase, dt);

/** Rampa de saída para evitar clique no fim de uma nota. */
export function fadeEnds(x, inMs = 0, outMs = 4) {
  const a = Math.round((inMs * SR) / 1000);
  const b = Math.round((outMs * SR) / 1000);
  for (let i = 0; i < a && i < x.length; i++) x[i] *= i / a;
  for (let i = 0; i < b && i < x.length; i++) x[x.length - 1 - i] *= i / b;
  return x;
}

export function softClip(x, drive = 1.5) {
  const n = Math.tanh(drive);
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * drive) / n;
  return x;
}

// --- convolução (reverb) -------------------------------------------------------
/** Resposta ao impulso sintética: ruído com decaimento exponencial e HF amortecido. */
export function makeIR({ rt60 = 2.5, predelay = 0.02, hfStart = 9000, hfEnd = 1800, lowCut = 140, erGain = 0.5, seed = 1 }) {
  const len = Math.round((predelay + rt60 * 1.1) * SR);
  const pd = Math.round(predelay * SR);
  const erTimes = [0.007, 0.013, 0.019, 0.029, 0.037, 0.053];
  const chans = [0, 1].map((c) => {
    const r = rng(seed * 101 + c * 17 + 3);
    const x = new Float32Array(len);
    let lp = 0;
    for (let i = pd; i < len; i++) {
      const t = (i - pd) / SR;
      const env = Math.exp((-6.9078 * t) / rt60) * Math.min(1, t / 0.012);
      const fc = hfEnd + (hfStart - hfEnd) * Math.exp(-t / (rt60 * 0.35));
      lp += (r() - lp) * (1 - Math.exp((-TAU * fc) / SR));
      x[i] = lp * env;
    }
    erTimes.forEach((et, k) => {
      const idx = pd + Math.round((et + c * 0.0021) * SR);
      if (idx < len) x[idx] += erGain * (k % 2 === c ? 1 : -1) * (0.55 - k * 0.06);
    });
    applyBiquad(x, biquad("hp", lowCut, 0.7));
    return x;
  });
  let e = 0;
  for (const x of chans) for (let i = 0; i < x.length; i++) e += x[i] * x[i];
  const norm = 1 / Math.sqrt(e / 2);
  for (const x of chans) for (let i = 0; i < x.length; i++) x[i] *= norm;
  return chans;
}

const nextPow2 = (n) => 2 ** Math.ceil(Math.log2(n));

export class Reverb {
  constructor(ir) {
    this.M = nextPow2(N + ir[0].length);
    this.spec = ir.map((x) => {
      const re = new Float64Array(this.M);
      const im = new Float64Array(this.M);
      re.set(x);
      fft(re, im);
      return { re, im };
    });
  }
  /** Convolve o envio com a IR do canal (0 = L, 1 = R). */
  run(send, ch) {
    const { M } = this;
    const re = new Float64Array(M);
    const im = new Float64Array(M);
    re.set(send);
    fft(re, im);
    const s = this.spec[ch];
    for (let i = 0; i < M; i++) {
      const r = re[i] * s.re[i] - im[i] * s.im[i];
      im[i] = re[i] * s.im[i] + im[i] * s.re[i];
      re[i] = r;
    }
    fft(re, im, true);
    const out = new Float32Array(send.length);
    for (let i = 0; i < out.length; i++) out[i] = re[i];
    return out;
  }
}

// --- delay ping-pong ------------------------------------------------------------
export function pingPong(inL, inR, { time = 0.375, feedback = 0.4, lp = 4200, hp = 320 } = {}) {
  const d = Math.round(time * SR);
  const outL = new Float32Array(N);
  const outR = new Float32Array(N);
  const cLp = biquad("lp", lp, 0.7);
  const cHp = biquad("hp", hp, 0.7);
  const st = { l: [0, 0, 0, 0], r: [0, 0, 0, 0] };
  const tick = (s, v) => {
    let y = cLp[0] * v + s[0];
    s[0] = cLp[1] * v - cLp[3] * y + s[1];
    s[1] = cLp[2] * v - cLp[4] * y;
    const z = cHp[0] * y + s[2];
    s[2] = cHp[1] * y - cHp[3] * z + s[3];
    s[3] = cHp[2] * y - cHp[4] * z;
    return z;
  };
  for (let i = 0; i < N; i++) {
    // L recebe a entrada L e o retorno de R; R recebe o retorno de L (cruzado)
    const fbR = i >= d ? outR[i - d] : 0;
    const fbL = i >= d ? outL[i - d] : 0;
    outL[i] = tick(st.l, inL[i] * 0.5 + inR[i] * 0.5 + fbR * feedback);
    outR[i] = tick(st.r, fbL * feedback);
  }
  return [outL, outR];
}

// --- dinâmica -------------------------------------------------------------------
export function compress(L, R, { thr = -20, ratio = 2, atk = 0.015, rel = 0.18, knee = 6, makeup = 0 } = {}) {
  const at = Math.exp(-1 / (atk * SR));
  const rl = Math.exp(-1 / (rel * SR));
  const mk = lin(makeup);
  let env = 0;
  const slope = 1 - 1 / ratio;
  for (let i = 0; i < L.length; i++) {
    const lvl = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    env = lvl > env ? at * env + (1 - at) * lvl : rl * env + (1 - rl) * lvl;
    const over = db(env) - thr;
    let gr = 0;
    if (over >= knee / 2) gr = over * slope;
    else if (over > -knee / 2) gr = (slope * (over + knee / 2) ** 2) / (2 * knee);
    const g = lin(-gr) * mk;
    L[i] *= g;
    R[i] *= g;
  }
}

/** Limitador com lookahead simétrico: o ganho médio nunca passa do necessário. */
export function limit(L, R, { ceilingDb = -1.5, lookMs = 3, relMs = 90 } = {}) {
  const ceil = lin(ceilingDb);
  const look = Math.max(1, Math.round((lookMs * SR) / 1000));
  const n = L.length;
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) need[i] = Math.min(1, ceil / Math.max(Math.abs(L[i]), Math.abs(R[i]), 1e-9));
  // mínimo deslizante em [i-look, i+look]
  const mn = new Float32Array(n);
  const dq = new Int32Array(n);
  let head = 0, tail = 0;
  for (let i = 0; i < n + look; i++) {
    if (i < n) {
      while (tail > head && need[dq[tail - 1]] >= need[i]) tail--;
      dq[tail++] = i;
    }
    const c = i - look;
    if (c >= 0) {
      while (dq[head] < c - look) head++;
      mn[c] = need[dq[head]];
    }
  }
  // média móvel de mesma janela (garante gain <= necessário) + release
  const win = 2 * look + 1;
  const csum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) csum[i + 1] = csum[i] + mn[i];
  const relC = Math.exp(-1 / ((relMs / 1000) * SR));
  let prev = 1;
  let minG = 1;
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - look);
    const b = Math.min(n, i + look + 1);
    const avg = (csum[b] - csum[a]) / (b - a || win);
    prev = Math.min(avg, 1 - (1 - prev) * relC);
    L[i] *= prev;
    R[i] *= prev;
    if (prev < minG) minG = prev;
  }
  return db(minG);
}

/** Mid/side: ajusta a largura (1 = igual, 0 = mono). */
export function width(L, R, w) {
  for (let i = 0; i < L.length; i++) {
    const m = (L[i] + R[i]) * 0.5;
    const s = (L[i] - R[i]) * 0.5 * w;
    L[i] = m + s;
    R[i] = m - s;
  }
}

// --- medidores ------------------------------------------------------------------
const K1 = [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585];
const K2 = [1, -2, 1, -1.99004745483398, 0.99007225036621];

function kWeighted(x) {
  const y = new Float32Array(x);
  applyBiquad(y, K1);
  applyBiquad(y, K2);
  return y;
}

/** LUFS integrado (BS.1770-4, 48 kHz) e o máximo de curto prazo (3 s). */
export function loudness(L, R) {
  const kl = kWeighted(L);
  const kr = kWeighted(R);
  const blk = Math.round(0.4 * SR);
  const hop = Math.round(0.1 * SR);
  const ms = [];
  for (let s = 0; s + blk <= kl.length; s += hop) {
    let e = 0;
    for (let i = s; i < s + blk; i++) e += kl[i] * kl[i] + kr[i] * kr[i];
    ms.push(e / blk);
  }
  const lk = (e) => -0.691 + 10 * Math.log10(e + 1e-12);
  const abs = ms.filter((e) => lk(e) > -70);
  const rel = lk(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const gated = abs.filter((e) => lk(e) > rel);
  const integrated = lk(gated.reduce((a, b) => a + b, 0) / gated.length);
  const shortLen = Math.round((3 * SR) / hop) - 3;
  let shortMax = -Infinity;
  for (let i = 0; i + shortLen <= ms.length; i += 5) {
    let e = 0;
    for (let k = i; k < i + shortLen; k++) e += ms[k];
    shortMax = Math.max(shortMax, lk(e / shortLen));
  }
  return { integrated, shortMax };
}

export function peakDb(L, R) {
  let p = 0;
  for (let i = 0; i < L.length; i++) p = Math.max(p, Math.abs(L[i]), Math.abs(R[i]));
  return db(p);
}

/** True peak aproximado com 4x de oversampling (sinc janelada). */
export function truePeakDb(L, R) {
  const taps = 24;
  const ph = [0.25, 0.5, 0.75].map((f) => {
    const k = new Float64Array(taps * 2);
    for (let i = 0; i < taps * 2; i++) {
      const x = i - taps + 1 - f;
      const w = 0.5 + 0.5 * Math.cos((Math.PI * x) / (taps + 1));
      k[i] = (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * w;
    }
    return k;
  });
  let p = 0;
  for (const x of [L, R]) {
    for (let i = taps; i < x.length - taps; i++) {
      if (Math.abs(x[i]) < 0.2) continue;
      for (const k of ph) {
        let acc = 0;
        for (let j = 0; j < taps * 2; j++) acc += x[i - taps + 1 + j] * k[j];
        p = Math.max(p, Math.abs(acc));
      }
    }
  }
  return db(Math.max(p, ...[L, R].map((x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0))));
}

/** Perfil de energia (RMS em dBFS) a cada `win` segundos. */
export function rmsProfile(L, R, win = 0.5) {
  const n = Math.round(win * SR);
  const out = [];
  for (let s = 0; s + n <= L.length; s += n) {
    let e = 0;
    for (let i = s; i < s + n; i++) e += L[i] * L[i] + R[i] * R[i];
    out.push(db(Math.sqrt(e / (2 * n))));
  }
  return out;
}

// --- arquivos -------------------------------------------------------------------
export function writeWav(path, L, R, bits = 24) {
  const n = L.length;
  const bytes = bits / 8;
  const data = Buffer.alloc(n * 2 * bytes);
  const max = 2 ** (bits - 1) - 1;
  for (let i = 0; i < n; i++) {
    for (const [c, x] of [[0, L], [1, R]]) {
      const v = Math.max(-1, Math.min(1, x[i])) * max;
      const o = (i * 2 + c) * bytes;
      if (bits === 16) data.writeInt16LE(Math.round(v), o);
      else data.writeIntLE(Math.round(v), o, 3);
    }
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2 * bytes, 28);
  h.writeUInt16LE(2 * bytes, 32);
  h.writeUInt16LE(bits, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([h, data]));
}

/** Lê um WAV PCM (16/24 bits, estéreo ou mono) para Float32. */
export function readWav(buf) {
  const ch = buf.readUInt16LE(22);
  const bits = buf.readUInt16LE(34);
  const off = buf.indexOf("data") + 8;
  const bytes = bits / 8;
  const n = Math.floor((buf.length - off) / (bytes * ch));
  const chans = Array.from({ length: ch }, () => new Float32Array(n));
  const max = 2 ** (bits - 1);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const o = off + (i * ch + c) * bytes;
      chans[c][i] = (bits === 16 ? buf.readInt16LE(o) : buf.readIntLE(o, 3)) / max;
    }
  }
  return ch === 1 ? [chans[0], chans[0]] : chans;
}

// --- espectrograma em PNG ---------------------------------------------------------
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function writePNG(path, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}

/**
 * Espectrograma (eixo de frequência logarítmico, 30 Hz a 16 kHz), com marcas verticais
 * opcionais em segundos e faixa de RMS embaixo.
 */
export function spectrogram(path, L, R, { width: W = 1500, height: H = 420, marks = [], dbRange = 78 } = {}) {
  const fftN = 4096;
  const mono = new Float32Array(L.length);
  for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) * 0.5;
  const win = new Float64Array(fftN);
  for (let i = 0; i < fftN; i++) win[i] = 0.5 - 0.5 * Math.cos((TAU * i) / fftN);
  const rows = H - 40;
  const fMin = 30, fMax = 16000;
  const binOf = (f) => (f * fftN) / SR;
  const img = Buffer.alloc(W * H * 3, 14);
  const prof = rmsProfile(L, R, 0.1);
  for (let x = 0; x < W; x++) {
    const centre = Math.round(((x + 0.5) / W) * mono.length);
    const re = new Float64Array(fftN);
    const im = new Float64Array(fftN);
    for (let i = 0; i < fftN; i++) {
      const s = centre - fftN / 2 + i;
      re[i] = s >= 0 && s < mono.length ? mono[s] * win[i] : 0;
    }
    fft(re, im);
    for (let y = 0; y < rows; y++) {
      const f = fMin * (fMax / fMin) ** (1 - y / (rows - 1));
      const b = binOf(f);
      const k = Math.min(fftN / 2 - 1, Math.max(0, Math.round(b)));
      const mag = Math.hypot(re[k], im[k]) / (fftN / 4);
      const v = clamp01((db(mag) + dbRange) / dbRange);
      // mapa de cor: preto -> azul -> verde -> amarelo -> branco
      const r = Math.round(255 * clamp01((v - 0.55) * 3));
      const g = Math.round(255 * clamp01((v - 0.15) * 1.6));
      const bl = Math.round(255 * clamp01(v * 2.2 - (v > 0.5 ? (v - 0.5) * 3.5 : 0)));
      const o = (y * W + x) * 3;
      img[o] = r; img[o + 1] = g; img[o + 2] = bl;
    }
    // faixa de RMS
    const pi = Math.min(prof.length - 1, Math.floor((x / W) * prof.length));
    const h = clamp01((prof[pi] + 60) / 60) * 34;
    for (let y = 0; y < 34; y++) {
      const o = ((H - 3 - y) * W + x) * 3;
      const on = y < h;
      img[o] = on ? 80 : 26; img[o + 1] = on ? 200 : 30; img[o + 2] = on ? 140 : 36;
    }
  }
  for (const m of marks) {
    const x = Math.round((m / (L.length / SR)) * W);
    for (let y = 0; y < H; y++) {
      const o = (y * W + Math.min(W - 1, x)) * 3;
      img[o] = 255; img[o + 1] = 90; img[o + 2] = 90;
    }
  }
  writePNG(path, W, H, img);
}
