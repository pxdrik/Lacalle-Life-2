/**
 * Searches wger for photos, showing only the ones we are allowed to use.
 *
 * Two filters run before anything is shown, and neither is negotiable:
 *
 * - **No author, no photo.** Every licence wger uses is a Creative Commons
 *   attribution licence, and 87 of the 360 images name no author. We cannot
 *   satisfy a credit requirement for someone we cannot credit.
 * - **Nothing AI-generated.** 35 images are flagged `is_ai_generated`. The
 *   whole discipline of this catalogue is that a wrong picture teaches a wrong
 *   movement, and a generated body is exactly where that goes wrong.
 *
 *   node scripts/find-wger-photo.mjs "bulgarian" "wall sit"
 */
import { readFileSync } from "node:fs";

const LICENSES = {
  1: "CC BY-SA 3.0",
  2: "CC BY-SA 4.0",
  3: "CC0",
  4: "CC BY 4.0",
  5: "ODbL",
};

const { images, names } = JSON.parse(readFileSync("scripts/.cache-wger.json", "utf8"));

const usable = images.filter(
  (image) => Boolean(image.license_author) && !image.is_ai_generated,
);

/** exercise id -> english name */
const byExercise = new Map();
for (const entry of names) {
  if (!byExercise.has(entry.exercise)) byExercise.set(entry.exercise, entry.name);
}

const catalogue = usable.map((image) => ({
  name: byExercise.get(image.exercise) ?? `(exercicio ${String(image.exercise)})`,
  url: image.image,
  author: image.license_author,
  license: LICENSES[image.license] ?? `id ${String(image.license)}`,
  isMain: image.is_main,
}));

if (process.argv.length <= 2) {
  console.log(`imagens: ${String(images.length)}`);
  console.log(`utilizaveis (com autor, sem IA): ${String(usable.length)}`);
  console.log(`nomes resolvidos: ${String(catalogue.filter((c) => !c.name.startsWith("(")).length)}`);
  process.exit(0);
}

for (const term of process.argv.slice(2)) {
  const needle = term.toLowerCase();
  const hits = catalogue.filter((c) => c.name.toLowerCase().includes(needle));

  console.log(`\n--- "${term}" (${String(hits.length)}) ---`);
  for (const hit of hits) {
    console.log(`  ${hit.name}  [${hit.license} · ${hit.author}]`);
    console.log(`      ${hit.url}`);
  }
}
