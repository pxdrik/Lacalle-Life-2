import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getSupabaseEnv, isSupabaseConfigured } from "./env";

const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function setEnv(url: string | undefined, anonKey: string | undefined) {
  if (url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = url;

  if (anonKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anonKey;
}

beforeEach(() => {
  setEnv(undefined, undefined);
});

afterEach(() => {
  setEnv(ORIGINAL_URL, ORIGINAL_ANON_KEY);
});

describe("getSupabaseEnv", () => {
  it("returns both values when both are set", () => {
    setEnv("https://example.supabase.co", "anon-key");

    expect(getSupabaseEnv()).toEqual({
      url: "https://example.supabase.co",
      anonKey: "anon-key",
    });
  });

  it("throws when the URL is missing", () => {
    setEnv(undefined, "anon-key");

    expect(() => getSupabaseEnv()).toThrow(
      "NEXT_PUBLIC_SUPABASE_URL não está definida.",
    );
  });

  it("throws when the anon key is missing", () => {
    setEnv("https://example.supabase.co", undefined);

    expect(() => getSupabaseEnv()).toThrow(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY não está definida.",
    );
  });
});

describe("isSupabaseConfigured", () => {
  // Found 26/08/2026 by an external audit: a production deploy missing
  // these vars made `getSupabaseEnv` throw during render, with nothing to
  // catch it and no `error.tsx` in the app — the auth routes just crashed.
  // This is the non-throwing check that lets a caller (an auto-sync effect,
  // say) sit quietly in "not configured" instead.
  it("is false when neither variable is set", () => {
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("is false when only one variable is set", () => {
    setEnv("https://example.supabase.co", undefined);
    expect(isSupabaseConfigured()).toBe(false);

    setEnv(undefined, "anon-key");
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("is true when both variables are set", () => {
    setEnv("https://example.supabase.co", "anon-key");
    expect(isSupabaseConfigured()).toBe(true);
  });
});
