import { Easing, useVideoConfig } from "remotion";

// Tokens escuros do Life (src/design-system/tokens.css).
export const C = {
  deep: "#060708",
  canvas: "#0b0d0f",
  surface: "#16191d",
  ink: "#f3f4f6",
  muted: "#9aa3ae",
  accent: "#4fbe86",
  line: "#262b31",
} as const;

export const FONT = "'IBM Plex Sans', system-ui, sans-serif";

// As duas curvas do Motion System do Life: entrar (ease-out) e sair (ease-in).
export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const easeIn = Easing.bezier(0.64, 0, 0.78, 0);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// Proporção do viewport de captura (430 x 932).
export const PHONE_ASPECT = 932 / 430;
export const BEZEL = 14;

export function useLayout() {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  if (portrait) {
    const screenW = 620;
    return {
      portrait,
      width,
      height,
      screenW,
      screenH: screenW * PHONE_ASPECT,
      phoneX: (width - screenW - BEZEL * 2) / 2,
      phoneY: 520,
      textX: 90,
      textY: 190,
      textW: 930,
      h1: 88,
      body: 38,
      logoY: 84,
      logoX: 90,
    };
  }
  const screenW = 416;
  return {
    portrait,
    width,
    height,
    screenW,
    screenH: screenW * PHONE_ASPECT,
    phoneX: 1240,
    phoneY: (height - screenW * PHONE_ASPECT - BEZEL * 2) / 2,
    textX: 150,
    textY: 360,
    textW: 900,
    h1: 116,
    body: 42,
    logoY: 84,
    logoX: 150,
  };
}
