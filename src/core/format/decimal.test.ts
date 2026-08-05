import { describe, expect, it } from "vitest";

import { parseDecimal } from "./decimal";

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
