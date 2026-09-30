import type { Viewport } from "next";

/**
 * O `viewport` do app, decidido por quem pede a página.
 *
 * `maximumScale: 1` só em iOS (roadmap 8.6, decisão do Pedro em
 * 29/09/2026). O iPhone amplia a tela ao focar um campo, mesmo com fonte de
 * 16px e na densidade Compacto, e a causa não foi identificada: não dá para
 * inspecionar o Safari do aparelho sem um Mac. `maximum-scale=1` impede esse
 * zoom, e no iOS a Apple ignora a linha para a pinça, que continua. No
 * Android o Chrome respeitaria a linha e **tiraria a pinça**, por isso ele
 * fica de fora.
 *
 * Chrome e Firefox no iPhone também entram: por baixo são o mesmo WebKit, e
 * o agente continua dizendo "iPhone". Limite: iPad com iPadOS se apresenta
 * como Mac e não é detectado.
 */
export function viewportFor(userAgent: string | null): Viewport {
  const base: Viewport = {
    width: "device-width",
    initialScale: 1,
    // Lets content reach into the safe areas on notched phones — the workout
    // screen wants every pixel.
    viewportFit: "cover",
    // Matches `--canvas` in each theme, so the mobile browser chrome blends
    // into the page instead of framing it. Both are brand system values — the
    // Background of page 18 and the dark canvas of page 33 — and the light one
    // was white here, which framed every card against a paler chrome.
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
      { media: "(prefers-color-scheme: dark)", color: "#0b0d0f" },
    ],
  };

  return isIos(userAgent) ? { ...base, maximumScale: 1 } : base;
}

function isIos(userAgent: string | null): boolean {
  return userAgent !== null && /\b(iPhone|iPad|iPod)\b/.test(userAgent);
}
