import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Read from disk, not imported: Vitest short-circuits CSS imports to an empty
// string, and `?raw` goes through the same path.
const css = readFileSync(
  join(process.cwd(), "src/design-system/tokens.css"),
  "utf8",
);

/**
 * Contrast is verified against the stylesheet that actually ships.
 *
 * Tokens are parsed out of `tokens.css` rather than duplicated here, so this
 * cannot drift into asserting values the app no longer uses. Changing a value
 * until it "looks right" now fails the build instead of quietly shipping
 * unreadable text.
 *
 * Thresholds follow WCAG 2.2, which is the minimum the brand system's own
 * accessibility page (48) adopts: 4.5:1 for text (1.4.3), 3:1 for the non-text
 * parts of a UI and for graphics that carry meaning (1.4.11).
 *
 * **The parser reads hexadecimal now**, because the tokens are hexadecimal now.
 * They were OKLCH while the palette's intermediate steps had to be interpolated
 * by perceptual maths; the brand system names every step, so there is nothing
 * left to derive and the values can be diffed against the document directly.
 */

type Rgb = readonly [number, number, number];

/** sRGB hex → linear sRGB. */
function hexToLinearSrgb(hex: string): Rgb {
  const channels = [1, 3, 5].map((at) => {
    const value = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });

  return channels as unknown as Rgb;
}

/** WCAG relative luminance, computed from already-linear channels. */
function luminance([r, g, b]: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter! + 0.05) / (darker! + 0.05);
}

/**
 * Reads the opaque colour tokens from one selector block.
 *
 * A token may be written as a literal (`#059669`) or as a reference to another
 * token in the same block (`var(--accent-600)`), and both have to resolve —
 * `--accent` is a reference, and it is the one every button label is measured
 * against. References are followed after the literals are collected, so
 * declaration order does not matter.
 *
 * Values carrying an alpha channel (overlays) and non-colour tokens are
 * skipped: neither is a foreground/background pair.
 */
function parseTokens(selector: string): ReadonlyMap<string, Rgb> {
  const block = new RegExp(
    `${selector.replace(/[[\]"]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  ).exec(css);

  if (block?.[1] === undefined) {
    throw new Error(`No "${selector}" block found in tokens.css.`);
  }

  const literals = new Map<string, string>();
  const references = new Map<string, string>();

  for (const [, name, value] of block[1].matchAll(
    /--([\w-]+):\s*(#[0-9a-fA-F]{6}|var\(--[\w-]+\))\s*;/g,
  )) {
    const reference = /^var\(--([\w-]+)\)$/.exec(value!);

    if (reference) references.set(name!, reference[1]!);
    else literals.set(name!, value!);
  }

  for (const [name, target] of references) {
    const resolved = literals.get(target);
    if (resolved !== undefined) literals.set(name, resolved);
  }

  return new Map(
    [...literals].map(([name, hex]) => [name, hexToLinearSrgb(hex)]),
  );
}

const THEMES = [
  { name: "light", tokens: parseTokens(":root") },
  { name: "dark", tokens: parseTokens('[data-theme="dark"]') },
] as const;

/** [foreground, background, minimum ratio, what the pair is for] */
const PAIRS = [
  ["ink", "canvas", 7, "body text on the page"],
  ["ink", "surface", 7, "body text on a card"],
  ["ink", "muted", 4.5, "body text on a hovered row"],
  ["ink", "elevated", 7, "body text on a raised surface"],
  ["ink-muted", "canvas", 4.5, "secondary text"],
  ["ink-muted", "elevated", 4.5, "secondary text on a raised surface"],
  ["ink-subtle", "canvas", 4.5, "placeholder text"],
  ["ink-subtle", "surface", 4.5, "placeholder text on a card"],
  ["ink-subtle", "elevated", 4.5, "the caption under the calorie ring"],

  /**
   * The pair that lets `ink-subtle` be wrong on `muted`.
   *
   * On the light theme Gray 500 on Surface 100 measures **4.39:1**, and there
   * is no fix in the token layer: both values are the brand system's, named on
   * page 18, and neither may move. The fix is in components — a row that takes
   * `muted` on hover takes `ink-muted` with it — and this asserts the
   * destination of that swap, so the escape route cannot rot.
   *
   * Asserting `ink-subtle` on `muted` here instead would be asserting something
   * the brand system forbids fixing.
   */
  ["ink-muted", "muted", 4.5, "the colour a subtle row swaps to on hover"],

  ["accent-ink", "accent", 4.5, "primary button label"],
  ["accent", "canvas", 3, "the emerald as a chart line or filled control"],
  ["accent", "surface", 3, "the emerald as a filled control on a card"],
  ["accent-text", "canvas", 4.5, "the emerald used as text on the page"],
  ["accent-text", "surface", 4.5, "the emerald used as text on a card"],
  ["accent-text", "elevated", 4.5, "the emerald as text on a raised surface"],
  // The page header's icon chip: a saturated glyph on the recessed surface.
  ["accent-text", "muted", 4.5, "the emerald on a chip"],
  // The active navigation item: accent 50 behind accent text — page 31.
  ["accent-text", "accent-surface", 4.5, "the active sidebar item"],
  ["ink", "accent-surface", 4.5, "body text on the active item's fill"],

  /**
   * States. The base carries icon, border and fill at the 3:1 a graphic owes;
   * the `-text` pair carries the words at 4.5:1.
   *
   * This split is the file's second documented divergence from the brand
   * system, and these are the assertions that force it: `--warning` measures
   * 3.04:1 on the page and `--danger` measures 4.41:1 on its own surface.
   */
  ["danger-ink", "danger", 4.5, "destructive button label"],
  ["danger", "canvas", 3, "a destructive control's fill and border"],
  ["danger-text", "canvas", 4.5, "an error message"],
  ["danger-text", "surface", 4.5, "an error message inside a card"],
  ["danger-text", "danger-surface", 4.5, "an error message on its own tint"],
  ["warning", "canvas", 3, "a warning's icon and border"],
  ["warning-text", "canvas", 4.5, "a warning's text"],
  ["warning-text", "surface", 4.5, "a warning inside a card"],
  ["warning-text", "elevated", 4.5, "calories past the target"],
  ["warning-text", "warning-surface", 4.5, "a warning on its own tint"],
  ["success", "canvas", 3, "a success tick"],
  ["info", "canvas", 4.5, "an informational note"],
  ["info", "surface", 4.5, "an informational note inside a card"],

  ["focus", "canvas", 3, "focus ring against the page"],
  ["focus", "surface", 3, "focus ring against a card"],

  /**
   * Data colours — page 27. These say what a value *is*, not what the system
   * did, so they are asserted separately from the state colours even where a
   * value happens to coincide.
   */
  ["data-positive", "canvas", 3, "a favourable change, as an arrow or a bar"],
  ["data-negative", "canvas", 3, "an unfavourable change, as an arrow or a bar"],
  ["data-neutral", "canvas", 4.5, "an unchanged figure, printed as text"],
  // The stat card on page 24 prints its delta at 12px, which is the 4.5:1
  // band. Both graphic values measure 3.60 — right as a mark, short as a digit.
  ["data-positive-text", "canvas", 4.5, "a favourable delta, printed"],
  ["data-positive-text", "surface", 4.5, "a favourable delta on a card"],
  ["data-negative-text", "canvas", 4.5, "an unfavourable delta, printed"],
  ["data-negative-text", "surface", 4.5, "an unfavourable delta on a card"],

  ["protein", "canvas", 3, "protein in charts"],
  ["carbs", "canvas", 3, "carbohydrate in charts"],
  ["fat", "canvas", 3, "fat in charts"],
  // The gap these were written to close: the three above are asserted at the
  // 3:1 a *graphic* owes, and that assertion is right — but five screens print
  // the same numbers as small text, where carbohydrate measured 3.58:1. The
  // pairs below are why `--carbs-text` exists.
  ["protein-text", "canvas", 4.5, "protein as a figure on the page"],
  ["carbs-text", "canvas", 4.5, "carbohydrate as a figure on the page"],
  ["fat-text", "canvas", 4.5, "fat as a figure on the page"],
  ["protein-text", "surface", 4.5, "protein as a figure on a card"],
  ["carbs-text", "surface", 4.5, "carbohydrate as a figure on a card"],
  ["fat-text", "surface", 4.5, "fat as a figure on a card"],
  ["protein-text", "elevated", 4.5, "protein on a raised surface"],
  ["carbs-text", "elevated", 4.5, "carbohydrate on a raised surface"],
  ["fat-text", "elevated", 4.5, "fat on a raised surface"],
] as const;

describe.each(THEMES)("$name theme contrast", ({ tokens }) => {
  it.each(PAIRS)(
    "%s on %s meets %s:1 — %s",
    (foreground, background, minimum) => {
      const fg = tokens.get(foreground);
      const bg = tokens.get(background);

      expect(fg, `token --${foreground} is missing`).toBeDefined();
      expect(bg, `token --${background} is missing`).toBeDefined();

      expect(contrast(fg!, bg!)).toBeGreaterThanOrEqual(minimum);
    },
  );
});

describe("token parity", () => {
  it("defines the same token names in both themes", () => {
    const [light, dark] = THEMES;

    expect([...dark.tokens.keys()].sort()).toEqual(
      [...light.tokens.keys()].sort(),
    );
  });
});

/**
 * The values the brand system names, asserted literally.
 *
 * Contrast alone would not catch these: a slightly different grey passes every
 * ratio above and is still the wrong grey. Page 49 calls the token file the
 * contract between design and development, and a contract nobody checks is a
 * suggestion — so the numbers that came from the document are pinned to the
 * document, page by page.
 *
 * Only values quoted verbatim in the brand system are here. The three
 * interpolated dark tokens, the two `-text` states and the macro triad are
 * deliberately absent: they are this file's documented divergences, and pinning
 * them here would dress up a local decision as a brand rule.
 */
describe("brand system values", () => {
  const hex = (theme: (typeof THEMES)[number], name: string) => {
    const token = theme.tokens.get(name);
    expect(token, `token --${name} is missing`).toBeDefined();

    return `#${token!
      .map((channel) => {
        const encoded =
          channel <= 0.0031308
            ? channel * 12.92
            : 1.055 * channel ** (1 / 2.4) - 0.055;
        return Math.round(encoded * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")}`;
  };

  const [light, dark] = THEMES;

  it.each([
    // Page 18 — the parent brand's neutral palette.
    ["canvas", "#f8fafc"],
    ["surface", "#ffffff"],
    ["muted", "#f3f4f6"],
    ["ink", "#111111"],
    ["ink-muted", "#374151"],
    ["ink-subtle", "#6b7280"],
    ["line", "#e5e7eb"],
    ["line-strong", "#d1d5db"],
    // Page 19 — the five LaCalle Life tokens.
    ["accent-50", "#ecfdf5"],
    ["accent-300", "#6ee7b7"],
    ["accent-500", "#10b981"],
    ["accent-600", "#059669"],
    ["accent-800", "#065f46"],
    // Page 27 — UI states and product data colours.
    ["success", "#059669"],
    ["warning", "#d97706"],
    ["danger", "#dc2626"],
    ["info", "#6b7280"],
    ["data-negative", "#ef4444"],
    ["data-neutral", "#6b7280"],
    ["data-comparison", "#d1d5db"],
  ])("light --%s is %s", (name, expected) => {
    expect(hex(light!, name)).toBe(expected);
  });

  it.each([
    // Page 33 — the dark scale, which is its own, not an inversion.
    ["canvas", "#0b0d0f"],
    ["surface", "#16191d"],
    ["elevated", "#1d2126"],
    ["line", "#262b31"],
    ["ink", "#f3f4f6"],
    ["ink-muted", "#9aa3ae"],
    ["accent", "#34d399"],
    ["warning", "#fbbf24"],
    ["danger", "#f87171"],
  ])("dark --%s is %s", (name, expected) => {
    expect(hex(dark!, name)).toBe(expected);
  });

  it("resolves --accent to the 600 step on light and 500's dark pair", () => {
    // Page 19 makes 500 the official colour and 600 the hover step; page 48
    // is why the light theme fills with 600 anyway. Asserted here so the
    // reasoning in tokens.css cannot drift away from what ships.
    expect(hex(light!, "accent")).toBe("#059669");
    expect(hex(light!, "accent-text")).toBe("#065f46");
    expect(hex(dark!, "accent-text")).toBe("#34d399");
  });

  it("keeps ink, not white, on the accent", () => {
    // The first documented divergence. White on #059669 measures 3.77:1 and
    // fails page 48; this is the assertion that stops it coming back.
    expect(hex(light!, "accent-ink")).toBe("#111111");
    expect(hex(dark!, "accent-ink")).toBe("#0b0d0f");
  });

  it("takes the 600 step for a positive value on a light ground", () => {
    /**
     * Page 27 names Positive as #10B981, and on the light canvas that measures
     * **2.42:1** — under the 3:1 page 48 requires of a graphic that carries
     * meaning. Page 48 already records this ceiling for the accent; page 27
     * does not inherit it, and between the two the accessibility page wins.
     *
     * Pinned rather than left to the ratio assertions because 3:1 admits a
     * range and only one value in it is the brand's.
     */
    expect(hex(light!, "data-positive")).toBe("#059669");
    expect(hex(light!, "data-positive-text")).toBe("#065f46");
    // Untouched on the dark ground, where the brand system's own step reads.
    expect(hex(dark!, "data-positive")).toBe("#34d399");
  });
});
