/**
 * Lists candidate photos for the exercises that still have none.
 *
 * Suggests only. The output is read by a human and the ones that are actually
 * the same movement are copied into `build-exercise-media.mjs`. The last time
 * a script's proposals were trusted wholesale, half were wrong.
 *
 *   node scripts/suggest-exercise-media.mjs [regiao]
 */
import { readFileSync, readdirSync } from "node:fs";

const CACHE = "scripts/.cache-free-exercise-db.json";
const CATALOGUE = "src/features/workouts/data/catalogue";
const MEDIA = "src/features/workouts/data/exercise-media.json";

const TERMS = {
  rosca: "curl", direta: "", alternada: "alternate", martelo: "hammer",
  inversa: "reverse", inverso: "reverse", punho: "wrist", invertida: "reverse",
  triceps: "triceps", testa: "skullcrusher lying extension", frances: "overhead extension",
  coice: "kickback", diamante: "close", flexao: "push up", palmas: "clap plyo",
  caminhada: "walk", fazendeiro: "farmers", corrida: "run", tiro: "sprint",
  natacao: "swimming", burpee: "burpee", bicicleta: "bike bicycle", ar: "air",
  prancha: "plank bridge", lateral: "side lateral", ombro: "shoulder",
  hollow: "hollow", hold: "hold", abdominal: "crunch", infra: "leg raise",
  elevacao: "raise", pernas: "leg", deitado: "lying", barra: "barbell",
  fixa: "hanging", joelhos: "knee", paralelas: "parallel bars",
  rotacao: "rotation twist", tronco: "torso", polia: "cable", halter: "dumbbell",
  halteres: "dumbbell", bird: "bird", dog: "dog", assistida: "assisted",
  maquina: "machine leverage", puxada: "pulldown", alta: "high",
  pullover: "pullover", remada: "row", cavalinho: "t bar", baixa: "seated",
  articulada: "leverage", unilateral: "one arm single", encolhimento: "shrug",
  desenvolvimento: "shoulder press", militar: "military", sentado: "seated",
  smith: "smith machine", frontal: "front", crucifixo: "fly", landmine: "landmine",
  supino: "bench press", inclinado: "incline", chao: "floor",
  agachamento: "squat", hack: "hack", bulgaro: "bulgarian split", pistol: "single leg",
  isometrico: "wall", parede: "wall", salto: "jump", leg: "leg", press: "press",
  sissy: "sissy", afundo: "lunge", reverso: "reverse", passada: "walking lunge",
  subida: "step up", banco: "bench", terra: "deadlift", hexagonal: "trap bar",
  romeno: "romanian stiff", nordica: "nordic glute ham", pelvica: "hip thrust",
  ponte: "bridge", gluteo: "glute", quatro: "kickback", apoios: "quadruped",
  abducao: "abduction", elastico: "band", panturrilha: "calf raise",
  em: "", pe: "standing", com: "", de: "", do: "", da: "", na: "", no: "", e: "",
};

const normalize = (v) =>
  v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

function terms(name) {
  const out = new Set();
  for (const word of normalize(name).split(" ")) {
    const mapped = TERMS[word];
    if (mapped === undefined) out.add(word);
    else for (const part of mapped.split(" ").filter(Boolean)) out.add(part);
  }
  return out;
}

function score(ours, theirs) {
  const mine = terms(ours);
  const yours = new Set(normalize(theirs).split(" ").filter((w) => w.length > 1));
  if (mine.size === 0) return 0;

  let hits = 0;
  for (const t of mine) if (yours.has(t)) hits += 1;
  return hits / mine.size - Math.max(yours.size - hits, 0) * 0.04;
}

const source = JSON.parse(readFileSync(CACHE, "utf8"));
const media = JSON.parse(readFileSync(MEDIA, "utf8"));
const taken = new Set(Object.values(media).map((m) => m.images[0]));
const region = process.argv[2];

for (const file of readdirSync(CATALOGUE).filter((f) => f.endsWith(".json"))) {
  if (region !== undefined && !file.startsWith(region)) continue;

  const missing = JSON.parse(readFileSync(`${CATALOGUE}/${file}`, "utf8"))
    .filter((e) => media[e.id] === undefined);
  if (missing.length === 0) continue;

  console.log(`\n===== ${file.replace(".json", "")} =====`);
  for (const exercise of missing) {
    const ranked = source
      // An image already used by another exercise is not a candidate: two
      // entries sharing a photo means one of them is being misrepresented.
      .filter((c) => !taken.has(c.images?.[0]))
      .map((c) => ({ name: c.name, value: score(exercise.name, c.name) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    console.log(`\n${exercise.id}  «${exercise.name}»`);
    for (const r of ranked) console.log(`   ${r.value.toFixed(2)}  ${r.name}`);
  }
}
