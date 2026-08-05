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
  { href: "/", label: "Início" },
  { href: "/alimentos", label: "Alimentos" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-3xl items-center gap-6 px-6 py-3.5">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Lacalle Life
        </Link>

        <nav aria-label="Principal" className="flex-1">
          <ul className="flex gap-1">
            {LINKS.filter((link) => link.href !== "/").map((link) => {
              const active = pathname.startsWith(link.href);

              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-sm transition-colors duration-150 ease-out",
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
