import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";

import { ThemeProvider } from "@/design-system/theme/theme-provider";
import { ThemeScript } from "@/design-system/theme/theme-script";

import { AppNav } from "./_components/app-nav";

import "./globals.css";

export const metadata: Metadata = {
  title: "Lacalle Life",
  description: "Monte dietas, monte treinos, acompanhe sua evolução.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets content reach into the safe areas on notched phones — the workout
  // screen wants every pixel.
  viewportFit: "cover",
  // Matches `--canvas` in each theme, so the mobile browser chrome blends
  // into the page instead of framing it.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    /* `suppressHydrationWarning` is required, not a workaround: ThemeScript
       intentionally sets `data-theme` on this element before React hydrates,
       so the server markup and the live DOM differ by design. */
    <html
      lang="pt-BR"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeScript />
        <ThemeProvider>
          <AppNav />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
