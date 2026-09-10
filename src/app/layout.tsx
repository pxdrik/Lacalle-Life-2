import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { IBM_Plex_Sans } from "next/font/google";

import { ToastProvider } from "@/design-system/components/toast";
import { DensityProvider } from "@/design-system/density/density-provider";
import { DensityScript } from "@/design-system/density/density-script";
import { ThemeProvider } from "@/design-system/theme/theme-provider";
import { ThemeScript } from "@/design-system/theme/theme-script";

import { ServiceWorker } from "./_components/service-worker";

import "./globals.css";

/**
 * IBM Plex Sans, and it is not a preference — the Brand System V2 (10/09/2026)
 * makes it the single institutional typeface of the LaCalle family, replacing
 * Inter (which itself had replaced Geist, this app's own original choice).
 * Reason for the move away from Inter, straight from the brandbook: Inter
 * shows up, independently, as part of the "recognizable kit" of AI-generated/
 * generic product design — and none of the 14 real fintech/fitness products
 * researched for V2 uses IBM Plex, so the choice earns identity through
 * disciplined use rather than borrowing market precedent.
 *
 * Only the four weights actually used in the app (400/500/600/700 — see
 * `font-medium`/`font-semibold`/`font-bold` usage) are requested: IBM Plex
 * Sans is not shipped as a variable font on Google Fonts, so `next/font`
 * needs the static cut list instead of a single variable-weight file.
 *
 * `latin` alone is enough for pt-BR — accented characters live there, not in
 * `latin-ext`.
 */
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LaCalle Life",
  description: "Monte dietas, monte treinos, acompanhe sua evolução.",
};

export const viewport: Viewport = {
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

/**
 * Async because `headers()` is: `middleware.ts` mints a fresh nonce every
 * request and hands it down through the `x-nonce` header. It has to be read
 * here rather than generated in `middleware.ts` and passed some other way
 * because a Server Component's props cannot come from middleware directly —
 * a request header is the channel Next.js's own documented pattern for this
 * uses, and it is also how Next.js finds the same nonce again to apply to
 * the RSC bootstrap scripts it injects itself.
 */
export default async function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  return (
    /* `suppressHydrationWarning` is required, not a workaround: ThemeScript
       intentionally sets `data-theme` on this element before React hydrates,
       so the server markup and the live DOM differ by design. */
    <html lang="pt-BR" className={ibmPlexSans.variable} suppressHydrationWarning>
      <body>
        <ThemeScript nonce={nonce} />
        <DensityScript nonce={nonce} />
        <ThemeProvider>
          <DensityProvider>
            <ToastProvider>
              {/* O chrome do app — sidebar, header, tab bar — não mora mais
                  aqui. `(app)/layout.tsx` é quem o possui agora, para toda
                  rota dentro daquele grupo; a Landing em `/` fica fora dele e
                  nunca o recebe. Ver o comentário lá para o porquê: decidir
                  isto por um header de pathname quebrava em navegação
                  client-side, porque este layout nunca é remontado nela. */}
              {children}
              <ServiceWorker />
            </ToastProvider>
          </DensityProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
