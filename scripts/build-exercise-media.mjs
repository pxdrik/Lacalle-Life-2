/**
 * Emits `exercise-media.json` from a hand-verified list of pairs.
 *
 * Every pair below was checked by eye against the dataset's real names. The
 * automatic matcher proposed seventy-five; roughly half were wrong in ways
 * that only a human notices — "Barbell Guillotine Bench Press" for a flat
 * bench, "Ball Leg Curl" for a machine, "Axle Deadlift" for a deadlift. A
 * photograph of the wrong movement teaches the wrong movement, so only the
 * verified half ships.
 *
 * Image paths come from the dataset itself and are never written by hand.
 *
 *   node scripts/build-exercise-media.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const CACHE = "scripts/.cache-free-exercise-db.json";
const CATALOGUE = "src/features/workouts/data/catalogue";
const OUT = "src/features/workouts/data/exercise-media.json";

/** our id -> the dataset's exact `name`. Verified one by one. */
const PAIRS = {
  // Peito
  "supino-reto-barra": "Barbell Bench Press - Medium Grip",
  "supino-inclinado-barra": "Barbell Incline Bench Press - Medium Grip",
  "supino-declinado-barra": "Decline Barbell Bench Press",
  "supino-reto-halteres": "Dumbbell Bench Press",
  "supino-inclinado-halteres": "Incline Dumbbell Press",
  "supino-declinado-halteres": "Decline Dumbbell Bench Press",
  "supino-reto-smith": "Smith Machine Bench Press",
  "supino-inclinado-smith": "Smith Machine Incline Bench Press",
  "supino-reto-maquina": "Machine Bench Press",
  "crucifixo-reto-halteres": "Dumbbell Flyes",
  "crucifixo-inclinado-halteres": "Incline Dumbbell Flyes",
  "crucifixo-maquina": "Butterfly",
  "cross-over-polia": "Cable Crossover",
  "crucifixo-polia-baixa": "Low Cable Crossover",
  "flexao-de-braco": "Pushups",
  "flexao-inclinada": "Incline Push-Up",
  "flexao-declinada": "Decline Push-Up",
  "mergulho-paralelas": "Dips - Chest Version",
  "press-svend": "Svend Press",

  // Costas
  "barra-fixa-pronada": "Pullups",
  "barra-fixa-supinada": "Chin-Up",
  "barra-fixa-neutra": "V-Bar Pullup",
  "puxada-frontal-pronada": "Wide-Grip Lat Pulldown",
  "puxada-supinada": "Underhand Cable Pulldowns",
  "puxada-triangulo": "V-Bar Pulldown",
  "puxada-unilateral-polia": "One Arm Lat Pulldown",
  "pullover-polia": "Straight-Arm Pulldown",
  "remada-curvada-barra": "Bent Over Barbell Row",
  "remada-curvada-halteres": "Bent Over Two-Dumbbell Row",
  "remada-unilateral-halter": "One-Arm Dumbbell Row",
  "remada-smith": "Smith Machine Bent Over Row",
  "remada-invertida": "Inverted Row",
  "encolhimento-barra": "Barbell Shrug",
  "encolhimento-halteres": "Dumbbell Shrug",

  // Ombros
  "desenvolvimento-halteres": "Dumbbell Shoulder Press",
  "desenvolvimento-arnold": "Arnold Dumbbell Press",
  "push-press": "Push Press",
  "elevacao-lateral-halteres": "Side Lateral Raise",
  "elevacao-lateral-polia": "Cable Seated Lateral Raise",
  "elevacao-frontal-halteres": "Front Dumbbell Raise",
  "elevacao-frontal-anilha": "Front Plate Raise",
  "elevacao-frontal-polia": "Front Cable Raise",
  "crucifixo-inverso-maquina": "Reverse Machine Flyes",
  "face-pull": "Face Pull",
  "remada-alta-barra": "Upright Barbell Row",
  "remada-alta-polia": "Upright Cable Row",

  // Braços
  "rosca-direta-barra": "Barbell Curl",
  "rosca-martelo": "Hammer Curls",
  "rosca-scott-barra": "Preacher Curl",
  "rosca-scott-maquina": "Machine Preacher Curls",
  "rosca-concentrada": "Concentration Curls",
  "rosca-inclinada": "Incline Dumbbell Curl",
  "rosca-spider": "Spider Curl",
  "rosca-zottman": "Zottman Curl",
  "triceps-testa-barra": "EZ-Bar Skullcrusher",
  "triceps-polia-corda": "Cable Rope Overhead Triceps Extension",
  "triceps-maquina": "Machine Triceps Extension",
  "triceps-banco": "Bench Dips",
  "supino-fechado": "Close-Grip Barbell Bench Press",

  // Pernas
  "agachamento-livre-barra": "Barbell Squat",
  "agachamento-frontal": "Front Barbell Squat",
  "agachamento-smith": "Smith Machine Squat",
  "agachamento-goblet": "Goblet Squat",
  "agachamento-sumo-halter": "Dumbbell Squat",
  "afundo-barra": "Barbell Lunge",
  "afundo-halteres": "Dumbbell Lunges",
  "levantamento-terra": "Barbell Deadlift",
  "levantamento-terra-sumo": "Sumo Deadlift",
  "good-morning": "Good Morning",
  "mesa-flexora": "Lying Leg Curls",
  "cadeira-flexora": "Seated Leg Curl",
  "flexora-em-pe": "Standing Leg Curl",
  "cadeira-extensora": "Leg Extensions",
  "elevacao-pelvica-barra": "Barbell Hip Thrust",
  "coice-polia": "Glute Kickback",
  "elevacao-gluteo-femoral": "Glute Ham Raise",
  "cadeira-abdutora": "Thigh Abductor",
  "cadeira-adutora": "Thigh Adductor",
  "aducao-polia": "Cable Hip Adduction",
  "panturrilha-sentado": "Seated Calf Raise",
  "panturrilha-leg-press": "Calf Press On The Leg Press Machine",
  "panturrilha-em-pe-maquina": "Standing Calf Raises",
  "panturrilha-smith": "Smith Machine Calf Raise",

  // Core
  prancha: "Plank",
  "dead-bug": "Dead Bug",
  "abdominal-tradicional": "Crunches",
  "abdominal-declinado": "Decline Crunch",
  "abdominal-maquina": "Ab Crunch Machine",
  "abdominal-polia": "Cable Crunch",
  "abdominal-obliquo": "Oblique Crunches",
  "roda-abdominal": "Ab Roller",
  "rotacao-russa": "Russian Twist",
  "press-pallof": "Pallof Press",
  hiperextensao: "Hyperextensions (Back Extensions)",
  "hiperextensao-reversa": "Reverse Hyperextension",
  superman: "Superman",
  canivete: "Jackknife Sit-Up",

  // Cardio
  esteira: "Jogging, Treadmill",
  eliptico: "Elliptical Trainer",
  "bicicleta-ergometrica": "Bicycling, Stationary",
  ciclismo: "Bicycling",
  "maquina-de-remo": "Rowing, Stationary",
  "simulador-de-escadas": "Stairmaster",
  "pular-corda": "Rope Jumping",
  escalador: "Mountain Climbers",
};

const source = JSON.parse(readFileSync(CACHE, "utf8"));
const byName = new Map(source.map((entry) => [entry.name, entry]));

const ourIds = new Set(
  readdirSync(CATALOGUE)
    .filter((file) => file.endsWith(".json"))
    .flatMap((file) => JSON.parse(readFileSync(`${CATALOGUE}/${file}`, "utf8")))
    .map((exercise) => exercise.id),
);

const media = {};
const problems = [];

for (const [id, name] of Object.entries(PAIRS)) {
  if (!ourIds.has(id)) {
    problems.push(`id inexistente no catálogo: ${id}`);
    continue;
  }

  const entry = byName.get(name);
  if (entry === undefined) {
    problems.push(`nome não encontrado no dataset: ${id} -> "${name}"`);
    continue;
  }
  if (!Array.isArray(entry.images) || entry.images.length === 0) {
    problems.push(`sem imagens: ${id} -> "${name}"`);
    continue;
  }

  media[id] = { source: "free-exercise-db", images: entry.images };
}

writeFileSync(OUT, JSON.stringify(media, null, 2) + "\n");

console.log(`catálogo:   ${String(ourIds.size)}`);
console.log(`mapeados:   ${String(Object.keys(media).length)}`);
console.log(`sem imagem: ${String(ourIds.size - Object.keys(media).length)}`);

if (problems.length > 0) {
  console.warn(`\n${String(problems.length)} problema(s):`);
  for (const problem of problems) console.warn(`  ${problem}`);
}
