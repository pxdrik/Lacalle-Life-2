/**
 * Measures exercise search on the real catalogue and at synthetic scale.
 *
 * Deliberately not a test. Wall-clock numbers depend on the machine and on
 * what else it is doing, so they belong in a report you read, not in an
 * assertion that fails on a busy laptop. The test suite guards the *shape* of
 * the cost — linear, not quadratic — which is the part that survives moving
 * to another computer.
 *
 *   node scripts/benchmark-search.mjs
 */
import { readFileSync, readdirSync } from "node:fs";

const DIR = "src/features/workouts/data";

const catalogue = readdirSync(`${DIR}/catalogue`)
  .filter((file) => file.endsWith(".json"))
  .flatMap((file) => JSON.parse(readFileSync(`${DIR}/catalogue/${file}`, "utf8")));

const aliases = JSON.parse(readFileSync(`${DIR}/aliases.json`, "utf8"));

const normalize = (value) =>
  value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();

function buildIndex(exercises) {
  return exercises.map((exercise) => {
    const name = normalize(exercise.name);
    const list = (aliases[exercise.id] ?? []).map(normalize);
    return {
      exercise,
      name,
      nameWords: name.split(" "),
      aliases: list,
      aliasWords: list.flatMap((alias) => alias.split(" ")),
      haystack: [name, ...list].join(" | "),
    };
  });
}

function rank(entry, term) {
  if (!entry.haystack.includes(term)) return Infinity;
  if (entry.name.startsWith(term)) return 0;
  if (entry.aliases.some((a) => a.startsWith(term))) return 1;
  if (entry.nameWords.some((w) => w.startsWith(term))) return 2;
  if (entry.aliasWords.some((w) => w.startsWith(term))) return 3;
  if (entry.name.includes(term)) return 4;
  return 5;
}

function search(index, text) {
  const terms = normalize(text).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return index.map((e) => e.exercise);

  const matches = [];
  for (const entry of index) {
    let score = Infinity;
    let all = true;
    for (const [i, term] of terms.entries()) {
      const s = rank(entry, term);
      if (s === Infinity) { all = false; break; }
      if (i === 0) score = s;
    }
    if (all) matches.push({ score, exercise: entry.exercise });
  }
  matches.sort((a, b) => a.score - b.score);
  return matches.map((m) => m.exercise);
}

function median(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function measure(index, terms, runs = 200) {
  const samples = [];
  for (let run = 0; run < runs; run += 1) {
    const started = performance.now();
    for (const term of terms) search(index, term);
    samples.push((performance.now() - started) / terms.length);
  }
  return median(samples);
}

// ── Real catalogue ──────────────────────────────────────────────────────────
const index = buildIndex(catalogue);
const TYPING = ["s", "su", "sup", "supi", "supin", "supino"];

console.log(`catálogo: ${catalogue.length} exercícios`);
console.log(`aliases:  ${Object.values(aliases).flat().length}`);

const build = (() => {
  const samples = [];
  for (let run = 0; run < 50; run += 1) {
    const started = performance.now();
    buildIndex(catalogue);
    samples.push(performance.now() - started);
  }
  return median(samples);
})();

console.log(`\níndice construído em ${build.toFixed(3)} ms (uma vez, no load)`);
console.log(`busca por tecla:      ${measure(index, TYPING).toFixed(4)} ms`);
console.log(`busca vazia:          ${measure(index, [""]).toFixed(4)} ms`);
console.log(`sem resultado:        ${measure(index, ["zzzzz"]).toFixed(4)} ms`);
console.log(`dois termos:          ${measure(index, ["supino barra"]).toFixed(4)} ms`);

// ── Synthetic scale ─────────────────────────────────────────────────────────
const MOVES = ["Supino", "Remada", "Agachamento", "Rosca", "Elevação"];
const VARS = ["Reto", "Inclinado", "Curvado", "Unilateral", "Alternado"];
const TOOLS = ["Barra", "Halteres", "Máquina", "Polia", "Smith"];

console.log("\nescala sintética (ms por tecla):");
for (const size of [1_000, 5_000, 20_000, 50_000]) {
  const synthetic = Array.from({ length: size }, (_, i) => ({
    id: `ex-${i}`,
    name: `${MOVES[i % 5]} ${VARS[i % 5]} ${TOOLS[i % 5]} ${i}`,
  }));

  const large = buildIndex(synthetic);
  const perKey = measure(large, TYPING, 30);
  console.log(
    `  ${String(size).padStart(6)}  ${perKey.toFixed(3).padStart(8)} ms` +
      `   ${perKey < 16 ? "dentro de um frame" : "ACIMA DE UM FRAME"}`,
  );
}
