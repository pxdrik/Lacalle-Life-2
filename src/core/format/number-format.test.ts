import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Numbers reach the screen through `formatDecimal`, and only through it.
 *
 * This is asserted against the source tree because the invariant is not
 * checkable from any single module — and because it had already lapsed
 * unnoticed. The session summary was printing `72.5 kg` with a full stop while
 * the diary two taps away wrote `72,5`, and nine other surfaces called
 * `toLocaleString("pt-BR")` directly: right separators, but bypassing the em
 * dash that `formatDecimal` puts where corrupt data would otherwise print
 * `NaN`. Both behaviours are listed as delivered in the roadmap. Neither had a
 * test, so both rotted quietly.
 *
 * The rule is deliberately about the *call*, not the output: a component that
 * formats its own numbers is one refactor away from disagreeing with the one
 * beside it, which is the failure this catches.
 *
 * `Intl.DateTimeFormat` is untouched — dates have their own formatters in
 * `core/format/day.ts`, and this only looks for the numeric call.
 */

const ROOT = join(process.cwd(), "src");

/** The call this forbids, in the spelling it actually appeared in. */
const FORBIDDEN = /\.toLocaleString\(\s*["']pt-BR["']/;

/**
 * Lines allowed to keep it, each for a reason written at the call site.
 *
 * Kept as a path plus the substring that has to be on the line, so moving the
 * code does not silently widen the exemption to a whole file.
 */
const ALLOWED: readonly { readonly file: string; readonly line: string }[] = [
  // Feeds a text field for editing, where an em dash would be handed to
  // someone to type over. See the comment above it.
  {
    file: "features/body/components/body-history.tsx",
    line: "entry.measurements[site]?.toLocaleString",
  },
];

function sourceFiles(dir: string): readonly string[] {
  const found: string[] = [];

  for (const name of readdirSync(dir)) {
    const path = join(dir, name);

    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
      continue;
    }

    if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) found.push(path);
  }

  return found;
}

describe("number formatting", () => {
  it("routes every displayed number through formatDecimal", () => {
    const offenders: string[] = [];

    for (const path of sourceFiles(ROOT)) {
      const relative = path.slice(ROOT.length + 1).replace(/\\/g, "/");
      if (relative === "core/format/decimal.ts") continue;

      readFileSync(path, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (!FORBIDDEN.test(line)) return;

          const exempt = ALLOWED.some(
            (rule) => rule.file === relative && line.includes(rule.line),
          );

          if (!exempt) offenders.push(`${relative}:${String(index + 1)}`);
        });
    }

    expect(
      offenders,
      `Use formatDecimal from @/core/format/decimal instead of toLocaleString("pt-BR"), so a stored value nobody can read prints an em dash rather than NaN:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
