import { describe, expect, it } from "vitest";

import { safeNextPath } from "./route";

describe("safeNextPath", () => {
  it("accepts a plain local path", () => {
    expect(safeNextPath("/atualizar-senha")).toBe("/atualizar-senha");
    expect(safeNextPath("/")).toBe("/");
  });

  it("falls back to / when there is nothing to validate", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });

  it("rejects an absolute URL to another origin", () => {
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("http://evil.com/entrar")).toBe("/");
  });

  it("rejects a protocol-relative URL", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
  });

  it("rejects a backslash trick some browsers normalise as a slash", () => {
    expect(safeNextPath("/\\evil.com")).toBe("/");
  });
});
