"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

import { cn } from "@/design-system/cn";
import { ThemeToggle } from "@/design-system/theme/theme-toggle";

/**
 * Only routes that exist. Diet and workouts join this list when they are real
 * screens — a nav item that leads to a placeholder teaches people the app is
 * unfinished, which is worse than a short menu.
 */
const LINKS: readonly { href: Route; label: string }[] = [
  // The diary sits first because it is the one opened daily; the diet behind
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
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-3.5">
        {/* `shrink-0` and no wrapping: the wordmark broke onto two lines the
            moment a seventh link was added, which shoved the whole header
            taller on a screen that was merely narrow. */}
        <Link
          href="/"
          className="shrink-0 text-sm font-semibold tracking-tight whitespace-nowrap"
        >
          Lacalle Life
        </Link>

        {/* Home is reached through the wordmark, so it is not repeated here.
            The list scrolls sideways instead of wrapping: seven links do not
            fit a phone, and a header that grows a second row pushes the
            content down on every screen. */}
        <nav
          aria-label="Principal"
          className="-mx-1 min-w-0 flex-1 overflow-x-auto px-1"
        >
          <ul className="flex w-max gap-1">
            {LINKS.map((link) => {
              const active = pathname.startsWith(link.href);

              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap",
                      "transition-colors duration-150 ease-out",
                      active
                        ? "bg-muted text-ink"
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
    </header>
  );
}
