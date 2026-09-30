import { describe, expect, it } from "vitest";

import { viewportFor } from "./viewport";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.0.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36";
const DESKTOP_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

/**
 * Roadmap 8.6 (29/09/2026): sem zoom ao focar campo no iPhone, sem tirar a
 * pinça do Android.
 */
describe("viewportFor", () => {
  it.each([
    ["Safari no iPhone", IPHONE_SAFARI],
    ["Chrome no iPhone", IPHONE_CHROME],
  ])("trava a escala em %s", (_, userAgent) => {
    expect(viewportFor(userAgent).maximumScale).toBe(1);
  });

  it.each([
    ["Chrome no Android", ANDROID_CHROME],
    ["desktop", DESKTOP_CHROME],
    ["sem cabeçalho", null],
  ])("não trava a escala em %s", (_, userAgent) => {
    expect(viewportFor(userAgent).maximumScale).toBeUndefined();
  });

  it("não muda nada além da escala", () => {
    const { maximumScale, ...ios } = viewportFor(IPHONE_SAFARI);
    expect(maximumScale).toBe(1);
    expect(ios).toEqual(viewportFor(ANDROID_CHROME));
  });
});
