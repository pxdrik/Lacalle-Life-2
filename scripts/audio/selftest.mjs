// Teste de sanidade da biblioteca de DSP. Falha (exit 1) se algum invariante quebrar.
import { N, SR, TAU, Reverb, biquad, applyBiquad, db, fft, limit, loudness, makeIR, peakDb, rng, truePeakDb } from "./dsp.mjs";

let bad = 0;
const check = (name, ok, info = "") => {
  console.log(`${ok ? "ok  " : "FALHA"} ${name} ${info}`);
  if (!ok) bad++;
};

// FFT: ida e volta
{
  const n = 1024;
  const re = new Float64Array(n).map((_, i) => Math.sin(i * 0.3) + 0.2 * Math.cos(i * 1.7));
  const orig = Float64Array.from(re);
  const im = new Float64Array(n);
  fft(re, im);
  fft(re, im, true);
  let err = 0;
  for (let i = 0; i < n; i++) err = Math.max(err, Math.abs(re[i] - orig[i]));
  check("fft ida e volta", err < 1e-9, `erro ${err.toExponential(1)}`);
}

// LUFS: seno de 1 kHz a -20 dBFS nos dois canais deve dar perto de -20 LUFS
{
  const L = new Float32Array(N).map((_, i) => 0.1 * Math.sin((TAU * 1000 * i) / SR));
  const R = Float32Array.from(L);
  const { integrated } = loudness(L, R);
  check("LUFS de seno -20 dBFS", Math.abs(integrated - -20) < 1, `${integrated.toFixed(2)} LUFS`);
}

// filtro passa-baixa: 100 Hz passa, 10 kHz cai bastante
{
  const mk = (f) => Float32Array.from({ length: SR }, (_, i) => Math.sin((TAU * f * i) / SR));
  const c = biquad("lp", 1000, 0.707);
  const lo = applyBiquad(mk(100), c);
  const hi = applyBiquad(mk(10000), c);
  const rms = (x) => Math.sqrt(x.slice(SR / 2).reduce((a, v) => a + v * v, 0) / (SR / 2));
  check("biquad lp", db(rms(lo)) > -4 && db(rms(hi)) < -35, `100 Hz ${db(rms(lo)).toFixed(1)} dB, 10 kHz ${db(rms(hi)).toFixed(1)} dB`);
}

// limitador: nenhuma amostra passa do teto
{
  const r = rng(5);
  const L = new Float32Array(N).map((_, i) => 1.8 * Math.sin(i * 0.01) * (0.3 + 0.7 * Math.abs(r())));
  const R = Float32Array.from(L);
  limit(L, R, { ceilingDb: -2 });
  check("limitador respeita o teto", peakDb(L, R) <= -1.99, `pico ${peakDb(L, R).toFixed(2)} dBFS`);
  check("true peak >= sample peak", truePeakDb(L, R) >= peakDb(L, R) - 1e-6);
}

// reverb: impulso vira cauda com energia unitária aproximada
{
  const ir = makeIR({ rt60: 2, seed: 3 });
  const rv = new Reverb(ir);
  const send = new Float32Array(N);
  send[1000] = 1;
  const t0 = Date.now();
  const out = rv.run(send, 0);
  let e = 0;
  for (const v of out) e += v * v;
  check("reverb energia ~1", e > 0.5 && e < 2, `energia ${e.toFixed(2)}, ${Date.now() - t0} ms`);
}

process.exit(bad ? 1 : 0);
