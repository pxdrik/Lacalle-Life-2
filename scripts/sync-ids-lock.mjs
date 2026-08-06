/**
 * Records newly published exercise ids in `ids.lock.json`.
 *
 * Adds only. Removing an id stays a manual edit on purpose: a saved workout
 * references exercises by id, so retiring one is a decision about somebody's
 * history, not housekeeping a script should do while you are not looking.
 *
 *   node scripts/sync-ids-lock.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const DIR = "src/features/workouts/data";
const LOCK = `${DIR}/ids.lock.json`;

const ids = readdirSync(`${DIR}/catalogue`)
  .filter((file) => file.endsWith(".json"))
  .flatMap((file) =>
    JSON.parse(readFileSync(`${DIR}/catalogue/${file}`, "utf8")).map((e) => e.id),
  );

const locked = JSON.parse(readFileSync(LOCK, "utf8"));
const added = ids.filter((id) => !locked.includes(id)).sort();

if (added.length === 0) {
  console.log("nada a adicionar");
} else {
  writeFileSync(LOCK, JSON.stringify([...locked, ...added].sort(), null, 2) + "\n");
  console.log(`adicionados ${added.length}:`);
  for (const id of added) console.log(`  ${id}`);
}

const orphaned = locked.filter((id) => !ids.includes(id));
if (orphaned.length > 0) {
  console.warn(
    `\n${orphaned.length} id(s) no lock sem exercício correspondente. ` +
      `Se foram aposentados de propósito, remova-os do lock à mão:`,
  );
  for (const id of orphaned) console.warn(`  ${id}`);
}
