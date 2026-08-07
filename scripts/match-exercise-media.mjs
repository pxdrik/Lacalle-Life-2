/**
 * Proposes matches between our curated pt-BR catalogue and free-exercise-db.
 *
 * Proposes only. The output is reviewed by hand and the confident half is
 * copied into `exercise-media.json` — the same rule the catalogue itself
 * follows, because a photo of a hack squat on a leg press entry teaches
 * somebody the wrong movement.
 *
 *   node scripts/match-exercise-media.mjs > /tmp/matches.txt
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const SOURCE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const CACHE = "scripts/.cache-free-exercise-db.json";
const DIR = "src/features/workouts/data/catalogue";

/** Portuguese gym vocabulary to the English the dataset uses. */
const TERMS = {
  supino: "bench press",
  reto: "",
  inclinado: "incline",
  declinado: "decline",
  crucifixo: "fly",
  flexao: "push up",
  mergulho: "dip",
  paralelas: "dips",
  agachamento: "squat",
  frontal: "front",
  hack: "hack",
  bulgaro: "bulgarian split",
  goblet: "goblet",
  pistol: "pistol",
  sumo: "sumo",
  afundo: "lunge",
  passada: "walking lunge",
  reverso: "reverse",
  subida: "step up",
  banco: "bench",
  leg: "leg",
  press: "press",
  cadeira: "",
  extensora: "leg extension",
  flexora: "leg curl",
  mesa: "lying",
  terra: "deadlift",
  romeno: "romanian",
  levantamento: "",
  stiff: "stiff leg",
  "good morning": "good morning",
  elevacao: "raise",
  pelvica: "hip thrust",
  ponte: "glute bridge",
  coice: "kickback",
  gluteo: "glute",
  abdutora: "abduction",
  adutora: "adduction",
  panturrilha: "calf raise",
  barra: "barbell",
  halter: "dumbbell",
  halteres: "dumbbell",
  maquina: "machine",
  polia: "cable",
  cabo: "cable",
  smith: "smith machine",
  anilha: "plate",
  elastico: "band",
  kettlebell: "kettlebell",
  corda: "rope",
  fixa: "pull up",
  pronada: "pull up",
  supinada: "chin up",
  neutra: "neutral grip",
  puxada: "pulldown",
  alta: "",
  triangulo: "v bar",
  pullover: "pullover",
  remada: "row",
  curvada: "bent over",
  unilateral: "one arm",
  cavalinho: "t bar row",
  baixa: "seated cable",
  invertida: "inverted",
  encolhimento: "shrug",
  desenvolvimento: "shoulder press",
  militar: "military press",
  arnold: "arnold press",
  lateral: "lateral",
  inverso: "reverse",
  "face pull": "face pull",
  rosca: "curl",
  direta: "",
  alternada: "alternate",
  martelo: "hammer",
  scott: "preacher",
  concentrada: "concentration",
  spider: "spider",
  zottman: "zottman",
  punho: "wrist",
  triceps: "triceps",
  testa: "lying triceps extension",
  frances: "overhead triceps extension",
  fechado: "close grip",
  diamante: "diamond",
  abdominal: "crunch",
  prancha: "plank",
  canivete: "v up",
  roda: "ab roller",
  russa: "russian twist",
  pallof: "pallof press",
  hiperextensao: "hyperextension",
  superman: "superman",
  bicicleta: "bicycle",
  esteira: "treadmill",
  corrida: "running",
  caminhada: "walking",
  eliptico: "elliptical",
  remo: "rowing",
  natacao: "swimming",
  burpee: "burpee",
  escalador: "mountain climber",
};

const STOP = new Set(["com", "de", "do", "da", "na", "no", "em", "e", "o", "a", "por", "pe"]);

const normalize = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function translate(name) {
  const words = normalize(name).split(" ").filter((w) => !STOP.has(w));
  const out = new Set();

  for (const word of words) {
    const term = TERMS[word];
    if (term === undefined) out.add(word);
    else for (const part of term.split(" ").filter(Boolean)) out.add(part);
  }

  return out;
}

function score(ours, theirs) {
  const mine = translate(ours);
  const yours = new Set(normalize(theirs).split(" ").filter((w) => w.length > 1));
  if (mine.size === 0) return 0;

  let hits = 0;
  for (const token of mine) if (yours.has(token)) hits += 1;

  // Penalise their extra words, so "Bench Press" beats "Bench Press with Bands".
  const extra = Math.max(yours.size - hits, 0);
  return hits / mine.size - extra * 0.06;
}

async function loadSource() {
  try {
    return JSON.parse(readFileSync(CACHE, "utf8"));
  } catch {
    const response = await fetch(SOURCE);
    if (!response.ok) throw new Error(`download falhou: ${String(response.status)}`);
    const data = await response.json();
    writeFileSync(CACHE, JSON.stringify(data));
    return data;
  }
}

const source = await loadSource();
const ours = readdirSync(DIR)
  .filter((file) => file.endsWith(".json"))
  .flatMap((file) => JSON.parse(readFileSync(`${DIR}/${file}`, "utf8")));

console.log(`nosso catálogo: ${ours.length}`);
console.log(`free-exercise-db: ${source.length}\n`);

const rows = ours
  .map((exercise) => {
    const ranked = source
      .map((candidate) => ({ candidate, value: score(exercise.name, candidate.name) }))
      .sort((a, b) => b.value - a.value);

    return { exercise, best: ranked[0], runnerUp: ranked[1] };
  })
  .sort((a, b) => b.best.value - a.best.value);

const STRONG = 0.85;
const strong = rows.filter((r) => r.best.value >= STRONG);

console.log(`propostas fortes (>= ${String(STRONG)}): ${strong.length}\n`);
for (const { exercise, best } of strong) {
  console.log(
    `${best.value.toFixed(2)}  ${exercise.id.padEnd(32)} -> ${best.candidate.name}`,
  );
}

console.log(`\n--- abaixo do corte, para revisão manual ---\n`);
for (const { exercise, best } of rows.filter((r) => r.best.value < STRONG).slice(0, 60)) {
  console.log(
    `${best.value.toFixed(2)}  ${exercise.id.padEnd(32)} -> ${best.candidate.name}`,
  );
}

writeFileSync(
  "scripts/.matches.json",
  JSON.stringify(
    strong.map(({ exercise, best }) => ({
      id: exercise.id,
      name: exercise.name,
      match: best.candidate.name,
      images: best.candidate.images,
      score: Number(best.value.toFixed(2)),
    })),
    null,
    2,
  ),
);
