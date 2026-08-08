import { describe, expect, it } from "vitest";

import { formatDecimal, parseDecimal } from "./decimal";

describe("parseDecimal", () => {
  it("reads a plain number", () => {
    expect(parseDecimal("3.6")).toBe(3.6);
  });

  it("reads a comma as the decimal separator", () => {
    // The decimal key on a pt-BR phone keyboard is a comma. Rejecting this
    // would reject the way most of the users actually type.
    expect(parseDecimal("3,6")).toBe(3.6);
  });

  it("reads an integer", () => {
    expect(parseDecimal("165")).toBe(165);
  });

  it("reads zero as zero, not as absent", () => {
    expect(parseDecimal("0")).toBe(0);
  });

  it("ignores surrounding whitespace", () => {
    expect(parseDecimal("  12,5  ")).toBe(12.5);
  });

  it.each(["", "   "])("returns null for %p", (input) => {
    expect(parseDecimal(input)).toBeNull();
  });

  it.each(["abc", "1,2,3", "--5", "1kg", "NaN", "Infinity"])(
    "returns null for %p",
    (input) => {
      expect(parseDecimal(input)).toBeNull();
    },
  );

  it("returns a negative number rather than rejecting it, leaving the range to the schema", () => {
    expect(parseDecimal("-5")).toBe(-5);
  });
});

describe("formatDecimal", () => {
  it("writes a comma for the decimal mark", () => {
    expect(formatDecimal(2.7)).toBe("2,7");
  });

  it("writes a dot for thousands", () => {
    expect(formatDecimal(2220)).toBe("2.220");
  });

  it("leaves a whole number whole", () => {
    // No "180,0": a target of 180 g is not more precise for having a zero.
    expect(formatDecimal(180)).toBe("180");
  });

  it("keeps the precision it was given", () => {
    // 62.75 kg is what micro-plates produce, and rounding it in the display
    // would report a weight nobody lifted.
    expect(formatDecimal(62.75)).toBe("62,75");
  });

  it("pads to a fixed width when asked", () => {
    expect(formatDecimal(0.6, 2)).toBe("0,60");
  });

  it("round-trips through parseDecimal for the values a user types", () => {
    // The two halves have to agree, or a number saved as 3,6 comes back 3.6
    // and gets rejected the next time the form reads it.
    for (const value of [0, 1, 3.6, 62.75, 180, 2220]) {
      expect(parseDecimal(formatDecimal(value).replace(".", ""))).toBe(value);
    }
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    "renders %p as a dash instead of letters",
    (value) => {
      // Corrupt data reaches the screen sooner or later. "NaN Carb" tells a
      // person nothing; a dash at least reads as "no value".
      expect(formatDecimal(value)).toBe("—");
    },
  );
});
