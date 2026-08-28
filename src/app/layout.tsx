import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";

import { ToastProvider } from "@/design-system/components/toast";
import { DensityProvider } from "@/design-system/density/density-provider";
import { DensityScript } from "@/design-system/density/density-script";
import { ThemeProvider } from "@/design-system/theme/theme-provider";
import { ThemeScript } from "@/design-system/theme/theme-script";

import { AppNav } from "./_components/app-nav";
import { ServiceWorker } from "./_components/service-worker";
import { Sidebar } from "./_components/sidebar";

import "./globals.css";

/**
 * Inter, and it is not a preference — page 16 of the brand system makes it the
 * single institutional typeface of LaCalle, "em marca, produto, apresentação e
 * documento". It replaces Geist, which was this app's own choice.
 *
 * Variable rather than a fixed set of weights: the type scale on page 17 uses
 * 400, 500, 600, 700 and 900, and shipping five static files to honour a rule
 * that also says "máximo de três pesos por tela" would be paying for the whole
 * range at every request.
 *
 * `latin` alone is enough for pt-BR — accented characters live there, not in
 * `latin-ext`.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
  // A Landing Page pública em `/` é a única rota sem o chrome do app —
  // sidebar, header, tab bar. Ela tem a própria navegação, do jeito que uma
  // página voltada para quem ainda não usa o produto deveria. Toda outra
  // rota, inclusive `(auth)`, continua exatamente como estava.
  const isLandingPage = requestHeaders.get("x-pathname") === "/";

  return (
    /* `suppressHydrationWarning` is required, not a workaround: ThemeScript
       intentionally sets `data-theme` on this element before React hydrates,
       so the server markup and the live DOM differ by design. */
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body>
        <ThemeScript nonce={nonce} />
        <DensityScript nonce={nonce} />
        <ThemeProvider>
          <DensityProvider>
            <ToastProvider>
              {isLandingPage ? (
                children
              ) : (
                <>
                  {/* Two navigations, one at a time. `Sidebar` owns `lg` and up;
                      below that it is not rendered and `AppNav` carries the header
                      and the phone's tab bar. The padding is what keeps content
                      clear of the fixed column, and it lives here rather than on
                      each of eleven pages. */}
                  <Sidebar />
                  <div className="lg:pl-(--sidebar-w)">
                    <AppNav />
                    {children}
                  </div>
                </>
              )}
              <ServiceWorker />
            </ToastProvider>
          </DensityProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
