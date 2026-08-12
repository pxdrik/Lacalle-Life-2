import type { MetadataRoute } from "next";

/**
 * What the phone needs to treat this as an app rather than a page.
 *
 * Installing matters here more than it does for most sites: the app is
 * local-first, so once the shell is cached it works with no network at all —
 * and the place it gets used is a gym basement.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LaCalle Life",
    // Under the icon on a home screen, where a long name is truncated by the
    // launcher rather than wrapped.
    short_name: "LaCalle",
    description: "Monte dietas, monte treinos, acompanhe sua evolução.",
    lang: "pt-BR",

    start_url: "/",
    display: "standalone",

    /**
     * Painted during launch, before any of our CSS runs — so it cannot follow
     * the theme the way `themeColor` in the layout does. Dark, to match the
     * icon and because a white flash at 6am in a gym is worse than a dark one
     * in daylight.
     */
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",

    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
