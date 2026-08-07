/**
 * Downloads wger's exercise images and the names they belong to.
 *
 * Cached to disk because the API is paginated and slow, and because a matching
 * session means reading the same list many times.
 *
 * wger licenses **per image**, not per repository: every record carries its own
 * `license_author` and licence. That is the whole reason this source needs
 * different handling from free-exercise-db.
 *
 *   node scripts/fetch-wger.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const CACHE = "scripts/.cache-wger.json";

async function fetchAll(url) {
  const out = [];
  let next = url;

  while (next !== null) {
    const response = await fetch(next);
    if (!response.ok) throw new Error(`${next} -> ${String(response.status)}`);

    const page = await response.json();
    out.push(...page.results);
    next = page.next;
    process.stdout.write(`\r  ${String(out.length)} registros...`);
  }

  console.log("");
  return out;
}

if (existsSync(CACHE)) {
  const cached = JSON.parse(readFileSync(CACHE, "utf8"));
  console.log(`cache: ${String(cached.images.length)} imagens, ${String(cached.names.length)} nomes`);
} else {
  console.log("baixando imagens...");
  const images = await fetchAll("https://wger.de/api/v2/exerciseimage/?limit=100&format=json");

  console.log("baixando nomes (en)...");
  const names = await fetchAll(
    "https://wger.de/api/v2/exercise-translation/?language=2&limit=100&format=json",
  );

  writeFileSync(CACHE, JSON.stringify({ images, names }));
  console.log(`salvo: ${String(images.length)} imagens, ${String(names.length)} nomes`);
}

const { images, names } = JSON.parse(readFileSync(CACHE, "utf8"));
console.log("\nexemplo de imagem:");
console.log(JSON.stringify(images[0], null, 2));
console.log("\nexemplo de nome:");
console.log(JSON.stringify(names[0], null, 2));

const licenses = {};
for (const image of images) licenses[image.license] = (licenses[image.license] ?? 0) + 1;
console.log("\nlicencas por id:", JSON.stringify(licenses));
