// Trilha provisória sintetizada por código: pad em Am-F-C-G, arpejo, pulso suave,
// risers/impactos nos cortes do vídeo e um "toque" a cada toque de tela.
// Uso: npm run score. Troque por uma faixa licenciada quando houver uma.
import { mkdirSync, writeFileSync } from "node:fs";

const SR = 44100;
const DUR = 30;
const N = SR * DUR;
const L = new Float32Array(N);
const R = new Float32Array(N);
const revL = new Float32Array(N); // envio para o reverb
const revR = new Float32Array(N);

const TAU = Math.PI * 2;
const at = (frame) => frame / 30; // quadro do vídeo -> segundos
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

function put(t0, len, fn, { pan = 0, dry = 1, wet = 0 } = {}) {
  const s0 = Math.floor(t0 * SR);
  const n = Math.min(Math.floor(len * SR), N - s0);
  const gl = Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < n; i++) {
    const v = fn(i / SR, i);
    L[s0 + i] += v * gl * dry;
    R[s0 + i] += v * gr * dry;
    revL[s0 + i] += v * gl * wet;
    revR[s0 + i] += v * gr * wet;
  }
}

// --- vozes -------------------------------------------------------------------
const saw = (ph) => 2 * (ph - Math.floor(ph + 0.5));
function pad(t0, len, freqs, gain) {
  for (const [k, f] of freqs.entries()) {
    let lp = 0;
    put(
      t0,
      len + 1.2,
      (t) => {
        const a = Math.min(t / 1.6, 1) * (t < len ? 1 : Math.exp(-(t - len) / 0.45));
        const s =
          saw(t * f * 0.998) + saw(t * f * 1.002) + 0.7 * Math.sin(TAU * t * f) + 0.4 * saw(t * f * 2.004);
        lp += (s - lp) * 0.055; // passa-baixa suave
        return lp * a * gain * (1 + 0.15 * Math.sin(t * 0.7 + k));
      },
      { pan: (k - 1.5) * 0.35, dry: 0.5, wet: 0.7 },
    );
  }
}
function pluck(t0, f, gain, pan) {
  put(
    t0,
    1.4,
    (t) =>
      (Math.sin(TAU * t * f) + 0.35 * Math.sin(TAU * t * f * 2) + 0.15 * Math.sin(TAU * t * f * 3)) *
      env(t, 0.004, 0.32) *
      gain,
    { pan, dry: 0.55, wet: 0.9 },
  );
}
function kick(t0, gain) {
  put(t0, 0.6, (t) => {
    const f = 42 + 90 * Math.exp(-t * 28);
    return Math.sin(TAU * f * t) * env(t, 0.002, 0.16) * gain;
  });
}
function tick(t0, gain, pan = 0) {
  let hp = 0;
  put(t0, 0.08, (t) => { const n = rnd(); const o = n - hp; hp += (n - hp) * 0.15; return o * env(t, 0.001, 0.012) * gain; }, { pan, dry: 0.6, wet: 0.3 });
}
function tap(t0) {
  put(t0, 0.25, (t) => Math.sin(TAU * (120 + 380 * Math.exp(-t * 45)) * t) * env(t, 0.001, 0.045) * 0.42, { dry: 0.9, wet: 0.2 });
  tick(t0, 0.32);
}
function whoosh(t0, len, up, gain) {
  let lp = 0;
  put(t0, len, (t) => {
    const p = t / len;
    const a = up ? p * p : (1 - p) * (1 - p);
    lp += (rnd() - lp) * (0.02 + 0.5 * (up ? p : 1 - p));
    return lp * a * gain;
  }, { dry: 0.7, wet: 0.6 });
}
function riser(t0, len, gain) {
  put(t0, len, (t) => {
    const p = t / len;
    const f = 200 * Math.pow(6, p);
    return (Math.sin(TAU * f * t) * 0.5 + rnd() * 0.25) * p * p * gain;
  }, { dry: 0.6, wet: 0.7 });
}
function impact(t0, gain) {
  kick(t0, gain);
  put(t0, 2.4, (t) => rnd() * env(t, 0.002, 0.28) * gain * 0.35, { dry: 0.5, wet: 1 });
  put(t0, 3, (t) => Math.sin(TAU * 55 * t) * env(t, 0.01, 0.9) * gain * 0.6);
}

// --- arranjo (tempos vêm dos quadros do vídeo em 30 fps) ---------------------
const chords = [
  [110, 164.81, 220, 261.63], // Am
  [87.31, 174.61, 220, 261.63], // F
  [130.81, 164.81, 196, 261.63], // C
  [98, 146.83, 196, 246.94], // G
];
const BPM = 100;
const beat = 60 / BPM;

// gancho: drone que cresce e um clique por linha de texto
put(0, 3.6, (t) => Math.sin(TAU * 55 * t) * Math.min(t / 2.5, 1) * 0.28 + Math.sin(TAU * 82.4 * t) * Math.min(t / 3, 1) * 0.07, { dry: 0.8, wet: 0.4 });
for (const f of [6, 28, 50]) tick(at(f), 0.5, 0.15);
riser(at(60), at(98) - at(60), 0.5);
impact(at(98) + 0.06, 0.95); // marca aparece

// corpo: pads a cada ~5.6 s, arpejo na dieta, pulso a partir do treino
const barLen = beat * 8;
for (let c = 0; c < 5; c++) pad(at(168) + c * barLen, barLen, chords[c % 4], 0.11);
pad(at(826) - 0.4, 3.8, [110, 164.81, 220, 277.18, 329.63], 0.14); // acorde final, Am virando A

for (let t = at(292); t < at(772); t += beat / 2) {
  const bar = Math.max(0, Math.floor((t - at(168)) / barLen));
  const ch = chords[bar % 4];
  const step = Math.round((t - at(292)) / (beat / 2));
  const note = ch[[0, 2, 1, 3, 2, 1, 3, 2][step % 8]] * 2;
  pluck(t, note, 0.16, ((step % 4) - 1.5) * 0.25);
}
for (let t = at(402); t < at(772); t += beat) {
  kick(t, 0.5);
  tick(t + beat / 2, 0.16, 0.3);
}

// cortes e transições
for (const f of [292, 402, 582]) { whoosh(at(f) - 0.32, 0.4, true, 0.28); tick(at(f), 0.4); }
whoosh(at(168) - 0.05, 0.7, false, 0.3); // aparelho sobe
whoosh(at(772) - 0.1, 0.55, false, 0.34); // aparelho sai
tick(at(826), 0.6);
impact(at(826), 0.9); // "Nada além disso."

// toques de tela (Diário e treino), na mesma ordem em que aparecem no vídeo
for (const f of [322, 352, 442, 482, 522]) tap(at(f));

// --- reverb (Schroeder simples) ----------------------------------------------
function reverb(inp, delays, fb) {
  const out = new Float32Array(N);
  for (const d of delays) {
    const buf = new Float32Array(d);
    let idx = 0;
    let lp = 0;
    for (let i = 0; i < N; i++) {
      lp += (buf[idx] - lp) * 0.35;
      const v = inp[i] + lp * fb;
      out[i] += buf[idx] * 0.32;
      buf[idx] = v;
      idx = (idx + 1) % d;
    }
  }
  return out;
}
const wl = reverb(revL, [1687, 1931, 2293, 2617], 0.84);
const wr = reverb(revR, [1753, 2011, 2381, 2711], 0.84);
for (let i = 0; i < N; i++) {
  L[i] += wl[i] * 0.9;
  R[i] += wr[i] * 0.9;
}

// --- master: fade, soft clip, normaliza para -2 dBFS ---------------------------
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const g = Math.min(t / 0.6, 1) * Math.min((DUR - t) / 1.6, 1);
  L[i] = Math.tanh(L[i] * 1.1) * g;
  R[i] = Math.tanh(R[i] * 1.1) * g;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.79 / peak;

const pcm = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  pcm.writeInt16LE(Math.round(L[i] * norm * 32767), i * 4);
  pcm.writeInt16LE(Math.round(R[i] * norm * 32767), i * 4 + 2);
}
const head = Buffer.alloc(44);
head.write("RIFF", 0);
head.writeUInt32LE(36 + pcm.length, 4);
head.write("WAVEfmt ", 8);
head.writeUInt32LE(16, 16);
head.writeUInt16LE(1, 20);
head.writeUInt16LE(2, 22);
head.writeUInt32LE(SR, 24);
head.writeUInt32LE(SR * 4, 28);
head.writeUInt16LE(4, 32);
head.writeUInt16LE(16, 34);
head.write("data", 36);
head.writeUInt32LE(pcm.length, 40);
mkdirSync("public/audio", { recursive: true });
writeFileSync("public/audio/score.wav", Buffer.concat([head, pcm]));
console.log("score.wav ok, pico original", peak.toFixed(2));
