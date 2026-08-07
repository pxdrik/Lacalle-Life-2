/**
 * Searches free-exercise-db by substring, and says which entries are already
 * spoken for.
 *
 *   node scripts/find-exercise-photo.mjs "wrist curl" "kickback"
 */
import { readFileSync } from "node:fs";

const source = JSON.parse(readFileSync("scripts/.cache-free-exercise-db.json", "utf8"));
const media = JSON.parse(readFileSync("src/features/workouts/data/exercise-media.json", "utf8"));
const taken = new Map(
  Object.entries(media).map(([id, m]) => [m.images[0].split("/")[0], id]),
);

for (const term of process.argv.slice(2)) {
  const needle = term.toLowerCase();
  const hits = source.filter((e) => e.name.toLowerCase().includes(needle));

  console.log(`\n--- "${term}" (${String(hits.length)}) ---`);
  for (const hit of hits) {
    const owner = taken.get(hit.images?.[0]?.split("/")[0] ?? "");
    console.log(`  ${hit.name}${owner === undefined ? "" : `   [já usado por ${owner}]`}`);
  }
}
