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
 * cannot drift into asserting values the app no longer uses. Lowering a
 * lightness until it "looks right" now fails the build instead of quietly
 * shipping unreadable text.
 *
 * Thresholds follow WCAG 2.2: 4.5:1 for text (1.4.3), 3:1 for the
 * non-text parts of a UI and for graphics that carry meaning (1.4.11).
 */

type Rgb = readonly [number, number, number];

/** OKLCH → linear sRGB, per the OKLab specification. */
function oklchToLinearSrgb(lightness: number, chroma: number, hue: number): Rgb {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** WCAG relative luminance, computed from already-linear channels. */
function luminance([r, g, b]: Rgb): number {
  return 0.2126 * clamp(r) + 0.7152 * clamp(g) + 0.0722 * clamp(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter! + 0.05) / (darker! + 0.05);
}

/**
 * Reads the opaque `oklch()` tokens from one selector block. Values carrying
 * an alpha channel (overlays) and non-colour tokens are skipped: neither is
 * a foreground/background pair.
 */
function parseTokens(selector: string): ReadonlyMap<string, Rgb> {
  const block = new RegExp(
    `${selector.replace(/[[\]"]/g, "\\$&")}\\s*\\{([^}]*)\\}`,
  ).exec(css);

  if (block?.[1] === undefined) {
    throw new Error(`No "${selector}" block found in tokens.css.`);
  }

  const tokens = new Map<string, Rgb>();
  const declaration = /--([\w-]+):\s*oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)\s*;/g;

  for (const [, name, l, c, h] of block[1].matchAll(declaration)) {
    tokens.set(name!, oklchToLinearSrgb(Number(l), Number(c), Number(h)));
  }

  return tokens;
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
  ["ink-muted", "canvas", 4.5, "secondary text"],
  ["ink-subtle", "canvas", 4.5, "placeholder text"],
  ["accent-ink", "accent", 4.5, "primary button label"],
  ["accent-text", "canvas", 4.5, "the emerald used as text on the page"],
  ["accent-text", "surface", 4.5, "the emerald used as text on a card"],
  ["accent", "canvas", 3, "the emerald as a chart line or filled control"],
  ["danger-ink", "danger", 4.5, "destructive button label"],
  // Both are used as text beside their icon, not only as a tint behind one,
  // so they answer to 4.5:1 rather than the 3:1 a graphic would need.
  ["warning", "canvas", 4.5, "a warning's text and icon"],
  ["warning", "surface", 4.5, "a warning inside a card"],
  ["info", "canvas", 4.5, "an informational note"],
  ["info", "surface", 4.5, "an informational note inside a card"],
  ["focus", "canvas", 3, "focus ring"],
  ["protein", "canvas", 3, "protein in charts"],
  ["carbs", "canvas", 3, "carbohydrate in charts"],
  ["fat", "canvas", 3, "fat in charts"],
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
