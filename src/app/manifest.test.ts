import { describe, expect, it } from "vitest";

import manifest from "./manifest";

/**
 * The manifest is the one file a phone reads before the app has run once. A
 * mistake here does not throw — the browser simply declines to offer
 * installation, silently, and the offline shell nobody installed never gets
 * used.
 */
describe("web app manifest", () => {
  const value = manifest();

  it("starts at the home screen, which is the summary of the day", () => {
    expect(value.start_url).toBe("/hoje");
  });

  it("opens without browser chrome, or installing buys nothing", () => {
    expect(value.display).toBe("standalone");
  });

  it("ships a maskable icon as well as a plain one", () => {
    // Android masks the icon to the launcher's shape. Given only an `any`
    // icon it letterboxes the artwork inside a white rounded square, which
    // looks like a broken install rather than a design choice.
    const purposes = (value.icons ?? []).map((icon) => icon.purpose);

    expect(purposes).toContain("any");
    expect(purposes).toContain("maskable");
  });

  it("declares a language, since the whole product is in Portuguese", () => {
    expect(value.lang).toBe("pt-BR");
  });

  it("keeps the short name short enough for a launcher to show it", () => {
    // Android truncates around twelve characters under the icon.
    expect(value.short_name?.length).toBeLessThanOrEqual(12);
  });

  it("paints a splash colour that exists in the app's own palette", () => {
    // `--canvas` in the dark theme. A colour invented for the manifest shows
    // up as a flash of something the app never displays again.
    expect(value.background_color).toBe("#0a0a0a");
  });
});
