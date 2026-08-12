"use client";

import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/design-system/cn";
import { ICONS } from "@/design-system/icons";
import { ThemeToggle } from "@/design-system/theme/theme-toggle";

/**
 * Every destination, with its glyph, in one column.
 *
 * The header could only ever show labels: eight links in a row leave no width
 * for icons, which is why the desktop navigation had none while the phone's
 * tab bar did. A column has the opposite constraint — vertical space is what
 * a sidebar has most of — so the same eight links arrive here with the marks
 * from `ICONS`, and the app finally draws each concept the same way in all
 * three places it appears.
 */
const LINKS: readonly { href: Route; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Hoje", icon: ICONS.today },
  { href: "/diario", label: "Diário", icon: ICONS.diary },
  { href: "/dietas", label: "Dietas", icon: ICONS.diets },
  { href: "/treinos", label: "Treinos", icon: ICONS.workouts },
  { href: "/evolucao", label: "Evolução", icon: ICONS.progress },
  { href: "/exercicios", label: "Exercícios", icon: ICONS.exercises },
  { href: "/alimentos", label: "Alimentos", icon: ICONS.foods },
  { href: "/perfil", label: "Perfil", icon: ICONS.profile },
];

/**
 * The desktop navigation, as a column.
 *
 * **This is V1's shape coming back.** The redesign brief names V1 as the
 * visual reference, and the thing V1 did that this version never had is a
 * sidebar: a single tall block that holds the whole map of the app, so no
 * destination is one level down behind a menu. The header it replaces fit its
 * eight links only by dropping their icons and shrinking the type until the
 * navigation read as a row of small grey words.
 *
 * `lg` and up, not `sm`. Below that the phone's tab bar is the navigation and
 * a 256px column would eat most of a 390px screen.
 *
 * Fixed rather than scrolling with the page: the map should not move while
 * you read what it points at, and the app has screens — the exercise catalogue
 * is 183 rows — where scrolling the navigation off the top means scrolling
 * back up to leave.
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
      <div className="border-b border-line px-5 py-5">
        <Link href="/" className="text-base tracking-tight whitespace-nowrap">
          <span className="font-semibold text-ink">LaCalle</span>{" "}
          <span className="font-medium text-accent-text">Life</span>
        </Link>
      </div>

      <nav aria-label="Principal" className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {LINKS.map(({ href, label, icon: Icon }) => {
            // The home route is a prefix of every other one, so it is the
            // single case that has to match exactly.
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);

            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                    "transition-colors duration-150 ease-out",
                    // Solid emerald for the current screen, as in V1, where the
                    // active item is one of the few large blocks of brand
                    // colour on screen. A muted pill says "selected" accurately
                    // and says nothing about whose app this is.
                    active
                      ? "bg-accent font-medium text-accent-ink"
                      : "text-ink-muted hover:bg-muted hover:text-ink",
                  )}
                >
                  <Icon aria-hidden className="size-[1.125rem] shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line p-3">
        <ThemeToggle />
      </div>
    </aside>
  );
}
