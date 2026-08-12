"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

import { cn } from "@/design-system/cn";
import { ThemeToggle } from "@/design-system/theme/theme-toggle";

import { BottomNav } from "./bottom-nav";

/**
 * Only routes that exist. Diet and workouts join this list when they are real
 * screens — a nav item that leads to a placeholder teaches people the app is
 * unfinished, which is worse than a short menu.
 */
const LINKS: readonly { href: Route; label: string }[] = [
  /**
   * "Hoje" is listed even though the wordmark also points at `/`.
   *
   * It used to be left out on the grounds that a logo linking home is a
   * convention everyone knows. Then a design audit spent a session in the app,
   * tried `/hoje`, got a 404, and reported that the whole dashboard was
   * missing on desktop. The screen was there the entire time. A convention
   * that a careful reviewer misses is not discoverable enough for the screen
   * the product is supposed to open on.
   */
  { href: "/", label: "Hoje" },
  // The diary sits next because it is the one opened daily; the diet behind
  // it is edited once a month.
  { href: "/diario", label: "Diário" },
  { href: "/treinos", label: "Treinos" },
  { href: "/dietas", label: "Dietas" },
  { href: "/evolucao", label: "Evolução" },
  { href: "/exercicios", label: "Exercícios" },
  { href: "/alimentos", label: "Alimentos" },
  { href: "/perfil", label: "Perfil" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    /* Hidden from `lg`, where `Sidebar` is the navigation. `BottomNav` renders
       from inside here and carries its own `sm:hidden`, so the phone keeps its
       tab bar either way. */
    <header className="border-b border-line lg:hidden">
      {/* `justify-between` on a phone, where the links are gone and the
          wordmark would otherwise sit next to the theme toggle with a gap the
          size of the screen between them and the edge. */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5 sm:justify-start">
        {/* `shrink-0` and no wrapping: the wordmark broke onto two lines the
            moment a seventh link was added, which shoved the whole header
            taller on a screen that was merely narrow. */}
        {/* Two-tone, as the logo sets it: "LaCalle" in ink and "Life" in the
            emerald, with `Life` a step lighter. The mark does the same thing —
            the name is the weight and the green is what makes it the brand's
            name rather than a title. `accent-text`, not `accent`: this is type,
            and the fill green does not clear 4.5:1 at this size. */}
        <Link
          href="/"
          className="shrink-0 text-sm tracking-tight whitespace-nowrap"
        >
          <span className="font-semibold text-ink">LaCalle</span>{" "}
          <span className="font-medium text-accent-text">Life</span>
        </Link>

        {/* Home is reached through the wordmark, so it is not repeated here.
            Hidden on phones, where `BottomNav` carries navigation: seven links
            do not fit 360px, and the sideways scroll this used to fall back on
            hid destinations behind a gesture nobody performs — at the top of
            the screen, which is the hardest place to reach one-handed. */}
        <nav
          aria-label="Principal"
          className="-mx-1 hidden min-w-0 flex-1 overflow-x-auto px-1 sm:block"
        >
          <ul className="flex w-max gap-1">
            {LINKS.map((link) => {
              // `/` prefixes every route, so it is the one that has to match
              // exactly — otherwise "Hoje" lights up on every screen.
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);

              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap",
                      "transition-colors duration-150 ease-out",
                      // Solid emerald, as in V1, where the active item is one
                      // of the few large blocks of brand colour on screen.
                      // A muted pill said "selected" accurately and said
                      // nothing about whose app this is.
                      active
                        ? "bg-accent font-medium text-accent-ink"
                        : "text-ink-muted hover:text-ink",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <ThemeToggle />
      </div>

      <BottomNav />
    </header>
  );
}
