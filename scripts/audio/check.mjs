// Verificação objetiva do áudio: loudness, picos, mono, equilíbrio por seção, sincronia das marcas
// e espectrogramas. Sem ouvir, é o que dá para medir.
// Uso: node scripts/audio/check.mjs [cinematic|mobile] [--file caminho.wav] [--png]
//   sem --file: simula a mixagem do Remotion a partir dos stems e da config (src/audio/config.ts).
//   com --file: analisa um WAV já renderizado (por exemplo, o áudio final do Remotion).
import { mkdirSync, readFileSync } from "node:fs";
import { CUES, FPS } from "../../src/audio/timeline.ts";
import { STEMS, stemGain } from "../../src/audio/config.ts";
import { DUR, N, SR, db, fft, loudness, peakDb, readWav, rmsProfile, spectrogram, truePeakDb } from "./dsp.mjs";

const args = process.argv.slice(2);
const profile = args.find((a) => a === "cinematic" || a === "mobile") ?? "cinematic";
const file = args.includes("--file") ? args[args.indexOf("--file") + 1] : null;
const png = args.includes("--png");
const S = (f) => f / FPS;
const FRAME = SR / FPS;

function loadStem(name) {
  const [l, r] = readWav(readFileSync(`public/audio/v2/${profile}/${name}.wav`));
  return { L: l, R: r };
}

function simulate() {
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  const stems = {};
  for (const name of STEMS) {
    const st = loadStem(name);
    stems[name] = st;
    for (let i = 0; i < N; i++) {
      const g = stemGain(profile, name, Math.floor(i / FRAME));
      L[i] += st.L[i] * g;
      R[i] += st.R[i] * g;
    }
  }
  return { L, R, stems };
}

const cta = S(CUES.fechamento.cta[0]);
const sections = [
  ["gancho", 0, S(CUES.logo.start)],
  ["logo/agora", S(CUES.logo.start), S(CUES.stage.enter)],
  ["dieta", S(CUES.stage.enter), S(CUES.diario.cut)],
  ["diário", S(CUES.diario.cut), S(CUES.diario.hoje[0])],
  ["hoje", S(CUES.diario.hoje[0]), S(CUES.treino.cut)],
  ["treino", S(CUES.treino.cut), S(CUES.evolucao.cut)],
  ["evolução", S(CUES.evolucao.cut), S(CUES.fechamento.lines[0])],
  ["fechamento", S(CUES.fechamento.lines[0]), DUR],
];

const bands = [["sub <60", 20, 60], ["grave 60-250", 60, 250], ["médio 250-2k", 250, 2000], ["presença 2-6k", 2000, 6000], ["ar >6k", 6000, 16000]];
function bandEnergies(L, R, t0, t1) {
  const n = 16384;
  const s0 = Math.max(0, Math.round(t0 * SR));
  const s1 = Math.min(L.length - n, Math.round(t1 * SR) - n);
  const acc = new Float64Array(bands.length);
  let cnt = 0;
  for (let s = s0; s <= s1; s += n / 2) {
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = (L[s + i] + R[s + i]) * 0.5 * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
    fft(re, im);
    bands.forEach(([, lo, hi], b) => {
      let e = 0;
      for (let k = Math.round((lo * n) / SR); k < Math.round((hi * n) / SR); k++) e += re[k] * re[k] + im[k] * im[k];
      acc[b] += e;
    });
    cnt++;
  }
  return cnt ? Array.from(acc, (e) => 10 * Math.log10(e / cnt + 1e-20)) : null;
}

function rmsWindow(L, R, t0, t1) {
  let e = 0;
  const a = Math.round(t0 * SR), b = Math.round(t1 * SR);
  for (let i = a; i < b; i++) e += L[i] * L[i] + R[i] * R[i];
  return db(Math.sqrt(e / (2 * (b - a))));
}

function report(L, R, label, stems) {
  console.log(`\n=== ${label} ===`);
  const ld = loudness(L, R);
  const mono = new Float32Array(L.length);
  for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) * 0.5;
  const zero = new Float32Array(L.length);
  const ldMono = loudness(mono, mono);
  console.log(`LUFS integrado ${ld.integrated.toFixed(1)}  |  curto prazo máx ${ld.shortMax.toFixed(1)}  |  pico ${peakDb(L, R).toFixed(1)} dBFS  |  true peak ${truePeakDb(L, R).toFixed(1)} dBTP`);
  console.log(`compatibilidade mono: ${(ldMono.integrated - ld.integrated).toFixed(1)} dB (perto de 0 é bom; muito negativo indica cancelamento)`);
  let dc = 0;
  for (let i = 0; i < L.length; i++) dc += L[i];
  console.log(`DC ${(dc / L.length).toExponential(1)}  |  primeira/última amostra ${Math.abs(L[0]).toExponential(1)} / ${Math.abs(L[L.length - 1]).toExponential(1)}`);
  if (stems) for (const [n, st] of Object.entries(stems)) console.log(`  stem ${n.padEnd(8)} pico ${peakDb(st.L, st.R).toFixed(1)} dBFS`);
  console.log("\nseção".padEnd(28) + "RMS dBFS   " + bands.map(([n]) => n.padStart(13)).join(""));
  for (const [name, a, b] of sections) {
    const be = bandEnergies(L, R, a, b);
    console.log(`${name.padEnd(27)}${rmsWindow(L, R, a, b).toFixed(1).padStart(7)}     ` + (be ? be.map((v) => v.toFixed(0).padStart(13)).join("") : ""));
  }
  void zero;
}

/** Sincronia: para cada marca, acha o pico de energia perto do instante previsto. */
function syncReport(stems) {
  const cues = JSON.parse(readFileSync("public/audio/v2/cues.json", "utf8"));
  console.log("\n--- sincronia (início do som vs. instante planejado; só eventos secos) ---");
  let worst = 0;
  let checked = 0;
  const swooshes = [];
  for (const c of cues) {
    if (c.name.startsWith("swoosh")) {
      // swoosh: o pico de energia (janelas de 10 ms) tem que cair no centro previsto da troca de página
      const w = Math.round(0.01 * SR);
      let best = 0, bt = c.t;
      for (let s0 = Math.round((c.t - 0.5) * SR); s0 < Math.round((c.t + 0.5) * SR); s0 += w) {
        let e = 0;
        for (let i = s0; i < s0 + w; i++) e += Math.abs(stems[c.stem].L[i]) + Math.abs(stems[c.stem].R[i]);
        if (e > best) { best = e; bt = (s0 + w / 2) / SR; }
      }
      const d = (bt - c.t) * 1000;
      swooshes.push(`${c.name} ${d >= 0 ? "+" : ""}${d.toFixed(0)} ms`);
      continue;
    }
    if (!/^(clique|confirma)/.test(c.name)) continue;
    const st = stems[c.stem];
    if (!st) continue;
    const a = Math.round(Math.max(0, c.t - 0.03) * SR), b = Math.round((c.t + (c.name.startsWith("clique") ? 0.06 : 0.15)) * SR);
    let pk = 0;
    for (let i = a; i < b; i++) pk = Math.max(pk, Math.abs(st.L[i]) + Math.abs(st.R[i]));
    // início do som: primeira amostra que passa de 20% do pico local (é o que o olho vê)
    let pi = a;
    for (let i = a; i < b; i++) if (Math.abs(st.L[i]) + Math.abs(st.R[i]) >= 0.2 * pk) { pi = i; break; }
    const dt = (pi / SR - c.t) * 1000;
    worst = Math.max(worst, Math.abs(dt));
    checked++;
    if (Math.abs(dt) > 25) console.log(`  ${c.stem}/${c.name} @ ${c.t}s: início ${dt.toFixed(0)} ms depois do previsto`);
  }
  if (swooshes.length) console.log(`pico de cada swoosh vs. centro da troca de página: ${swooshes.join(" | ")}`);
  console.log(`${checked} eventos secos conferidos; maior desvio ${worst.toFixed(0)} ms (1 quadro = 33 ms)`);
}

let L, R, stems = null;
if (file) {
  [L, R] = readWav(readFileSync(file));
  if (L.length < N) { const a = new Float32Array(N); a.set(L); L = a; const b = new Float32Array(N); b.set(R); R = b; }
} else {
  ({ L, R, stems } = simulate());
}
report(L.subarray(0, N), R.subarray(0, N), `${profile}${file ? ` (${file})` : " (simulação dos stems + config)"}`, stems);
if (stems) syncReport(stems);

if (png) {
  mkdirSync("out/audio-report", { recursive: true });
  const marks = [S(CUES.logo.start), S(CUES.agora[0]), S(CUES.diario.cut), S(CUES.treino.cut), S(CUES.evolucao.cut), S(CUES.fechamento.tudo[0]), S(CUES.fechamento.cta[0])];
  spectrogram(`out/audio-report/${profile}-mix.png`, L, R, { marks });
  if (stems) for (const n of STEMS) spectrogram(`out/audio-report/${profile}-${n}.png`, stems[n].L, stems[n].R, { marks, height: 300 });
  console.log(`\nespectrogramas em out/audio-report/${profile}-*.png (linhas vermelhas: logo, "Agora um só", diário, treino, evolução, "Tudo em um lugar só", chamada)`);
}
void rmsProfile;
