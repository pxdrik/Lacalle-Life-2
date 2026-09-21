// Áudio v2, só efeitos, sem música: um swoosh por troca de página, um clique por toque, um toque
// suave na hora em que cada bloco de texto entra e um "pop" a cada recompensa
// (o "Chega." do gancho, cada check, os números em destaque, o botão do CTA).
//
// Todos os tempos vêm de src/timeline.ts, a mesma fonte que monta o vídeo (Ad.tsx).
// Gera 4 stems por perfil: swooshes, clicks, text e rewards.
// Uso: node scripts/audio/compose.mjs [cinematic] [mobile]   (sem argumento, gera os dois)
import { mkdirSync, writeFileSync } from "node:fs";
import { CUES, FPS } from "../../src/timeline.ts";
import { SYNTH } from "../../src/audio/config.ts";
import { N, Reverb, hz, lin, makeIR, peakDb, writeWav } from "./dsp.mjs";
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
// O toque do dedo: corpo grave curto com um estalo macio. Quem responde ao toque (o item que
// marca) é o "pop" do stem rewards, alguns quadros depois.
function buildClicks(u) {
  const taps = [
    ...CUES.diario.taps.map((t) => [t, "diário"]),
    ...CUES.treino.taps.map((t) => [t, "treino"]),
  ];
  taps.forEach(([tap, page], i) => {
    // o corpo sobe um pouquinho a cada toque, para uma série de cliques não soar como metralhadora
    u.put(S(tap), V.click({ body: 185 + 6 * i }), null, { gain: 0.5, send: 0.15 });
    cue("clicks", `clique-${page}-${i + 1}`, S(tap));
  });
}

// ================================ TEXTO ==========================================
// (O gancho e o botão do CTA têm o próprio som, no stem rewards.)
// Um toque só por bloco de texto: um seno redondo e curto (lá 4), sem ruído e sem varredura, quando as
// palavras começam a assentar. Não compete com o swoosh de página (ar) nem com os pops de recompensa
// (sobem de nota e têm estalo): é grave, macio e sempre a mesma nota. A frase final, que é a chegada,
// vem uma quarta acima (ré 5).
function buildText(x) {
  const ONSET = 4; // quadros depois do início do bloco: a primeira palavra já está aparecendo
  const blip = (label, frame, note, gain) => {
    x.put(S(frame + ONSET), V.blip({ freq: hz(note) }), null, { gain, send: 0.2 });
    cue("text", `texto-${label}`, S(frame + ONSET));
  };
  blip("agora-um-so", CUES.text.agora, "A4", 0.8);
  ["dieta", "diario", "treino", "evolucao"].forEach((n, i) => blip(n, CUES.text.titles[i], "A4", 0.8));
  blip("fecho-linhas", CUES.text.closeLines, "A4", 0.6); // as três linhas do fecho entram juntas: um som só
  blip("tudo-em-um-lugar", CUES.text.tudo, "D5", 1);
}

// ================================ RECOMPENSAS ==========================================
// Um som por ganho, sempre no quadro em que ele aparece na tela:
//  - gancho: três pops que sobem (D5, F#5, A5), e uma batida grave quando cai o "Chega.";
//  - cada check: um pop que sobe de nota a cada item marcado (a escala fecha em D6);
//  - cada número em destaque: um "ding" de vidro macio (D6). Quando o número aparece junto de um
//    check (2 quadros depois), o pop do check já cobre, e o ding não repete;
//  - CTA: pop na entrada do botão e, no toque, o estalo do dedo mais um arpejo curto (D6 e A6).
function buildRewards(r) {
  const at = (label, frame, voice, opts) => {
    r.put(S(frame), voice, null, opts);
    cue("rewards", label, S(frame));
  };
  const pop = (label, frame, note, gain = 0.55) => at(label, frame, V.pop({ f0: hz(note) * 0.72, f1: hz(note) }), { gain, send: 0.25 });

  ["D5", "F#5", "A5"].forEach((note, i) => pop(`gancho-${i + 1}`, CUES.hook.lines[i] + 2, note, 0.48 + 0.05 * i));
  at("chega-batida", CUES.hookChega + 3, V.thump({ freq: 58 }), { gain: 0.62, send: 0.1 });

  const checks = [
    ...CUES.diario.states.map((f, i) => [f, ["A5", "D6"][i], "diário"]),
    ...CUES.treino.states.map((f, i) => [f, ["F#5", "A5", "D6"][i], "treino"]),
  ];
  checks.forEach(([f, note, page], i) => pop(`check-${page}-${i + 1}`, f, note));

  const near = (f) => checks.some(([c]) => Math.abs(c - f) <= 6);
  CUES.callouts.forEach((f, i) => {
    if (!near(f)) at(`numero-${i + 1}`, f, V.mallet({ freq: hz("D6"), dur: 0.6, tau: 0.3, bright: 0.6 }), { gain: 0.5, send: 0.35 });
  });

  pop("cta-botao", CUES.botao.pop + 2, "A5");
  at("cta-toque", CUES.botao.press, V.click({ body: 170 }), { gain: 0.4, send: 0.15 });
  [["D6", 3], ["A6", 8]].forEach(([note, off], i) =>
    at(`cta-arpejo-${i + 1}`, CUES.botao.press + off, V.mallet({ freq: hz(note), dur: 0.9, tau: 0.45, bright: 0.5 }), { gain: 0.46 - 0.05 * i, send: 0.4 }),
  );
}

// ================================ orquestração ==========================================
const REVERBS = {
  swooshes: { ir: { rt60: 2.2, predelay: 0.02, hfStart: 9000, hfEnd: 2500, lowCut: 200, seed: 22 }, wet: 0.25 },
  clicks: { ir: { rt60: 1.1, predelay: 0.01, hfStart: 10000, hfEnd: 3000, lowCut: 300, seed: 33 }, wet: 0.16 },
  text: { ir: { rt60: 1.4, predelay: 0.01, hfStart: 12000, hfEnd: 4000, lowCut: 400, seed: 55 }, wet: 0.14 },
  rewards: { ir: { rt60: 1.6, predelay: 0.012, hfStart: 11000, hfEnd: 3500, lowCut: 300, seed: 77 }, wet: 0.2 },
};

function build(profile) {
  V.reseed();
  cues.length = 0;
  const tracks = { swooshes: new Track("swooshes"), clicks: new Track("clicks"), text: new Track("text"), rewards: new Track("rewards") };
  buildSwooshes(tracks.swooshes);
  buildClicks(tracks.clicks);
  buildText(tracks.text);
  buildRewards(tracks.rewards);
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
