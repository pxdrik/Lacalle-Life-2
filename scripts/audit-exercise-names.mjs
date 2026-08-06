/**
 * Flags source rows whose names did not survive the V1 import.
 *
 * Run once to seed `exclusions.json`, which is then committed and owned by
 * hand — rescuing a name is deleting a line there, or giving it a correct
 * `name` in the enrichment table. This script never overwrites that file.
 *
 *   node scripts/audit-exercise-names.mjs          # report only
 *   node scripts/audit-exercise-names.mjs --write  # also write exclusions.seed.json
 */
import { readFileSync, writeFileSync } from "node:fs";

const DIR = "src/features/workouts/data";
const source = JSON.parse(readFileSync(`${DIR}/source/exercises.source.json`, "utf8"));

/**
 * The import leaked category words into the front of some names. Each of these
 * is a category fragment, never the start of a real exercise name.
 */
const LEAKED_PREFIX =
  /^(corpo inteiro|inteiro|superiores|costas superiores|costas|pull|snatch|the)\b/i;

/** Begins mid-phrase: a connector, a lowercase word, or an open parenthesis. */
const FRAGMENT_START = /^(\(|[a-z]|de |da |do |na |no |com |atrás|até|para |- )/;

const RULES = [
  {
    reason: "prefixo de categoria vazado para dentro do nome",
    test: (name) => LEAKED_PREFIX.test(name),
  },
  {
    reason: "nome começa no meio da frase; a palavra principal foi cortada",
    test: (name) => FRAGMENT_START.test(name),
  },
  {
    reason: "parênteses desbalanceados",
    test: (name) =>
      (name.match(/\(/g) ?? []).length !== (name.match(/\)/g) ?? []).length,
  },
  {
    reason: "curto demais para identificar um exercício",
    test: (name) => name.replace(/\(.*?\)/g, "").trim().length < 5,
  },
];

const excluded = [];
const kept = [];

for (const row of source) {
  const name = row.name.trim();
  const rule = RULES.find((r) => r.test(name));

  if (rule) excluded.push({ id: row.id, name: row.name, reason: rule.reason });
  else kept.push(row);
}

console.log(`origem:     ${source.length}`);
console.log(`excluidos:  ${excluded.length}`);
console.log(`preservados:${kept.length}\n`);

const byReason = {};
for (const e of excluded) byReason[e.reason] = (byReason[e.reason] ?? 0) + 1;
for (const [reason, count] of Object.entries(byReason)) {
  console.log(`  ${String(count).padStart(3)}  ${reason}`);
}

if (process.argv.includes("--write")) {
  writeFileSync(
    `${DIR}/enrichment/exclusions.seed.json`,
    JSON.stringify(excluded, null, 2) + "\n",
  );
  console.log("\nescrito: exclusions.seed.json (revise e renomeie para exclusions.json)");
}

if (process.argv.includes("--list")) {
  const byCategory = new Map();
  for (const row of kept) {
    if (!byCategory.has(row.category)) byCategory.set(row.category, []);
    byCategory.get(row.category).push(row.name);
  }
  for (const [category, names] of [...byCategory].sort()) {
    console.log(`\n### ${category} (${names.length})`);
    console.log(names.sort((a, b) => a.localeCompare(b, "pt-BR")).join(" | "));
  }
}
