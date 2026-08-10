"use client";

import type { Route } from "next";
import {
  Dumbbell,
  Home,
  Menu,
  TrendingUp,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/design-system/cn";
import { Dialog } from "@/design-system/components/dialog";

/**
 * The four screens a phone opens during the day, in the order the day uses
 * them: how am I doing, what did I eat, am I training, is it working.
 *
 * Everything else is setup. A diet is written once a month, the exercise and
 * food libraries are browsed while planning, and the profile is filled in
 * once — none of them belong in a thumb's reach, and putting seven items in a
 * bar 360px wide would give each of them 51px.
 */
const TABS: readonly { href: Route; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Hoje", icon: Home },
  { href: "/diario", label: "Diário", icon: UtensilsCrossed },
  { href: "/treinos", label: "Treinos", icon: Dumbbell },
  { href: "/evolucao", label: "Evolução", icon: TrendingUp },
];

const REST: readonly { href: Route; label: string; hint: string }[] = [
  { href: "/dietas", label: "Dietas", hint: "Seus planos alimentares" },
  {
    href: "/exercicios",
    label: "Exercícios",
    hint: "Catálogo e personalizados",
  },
  { href: "/alimentos", label: "Alimentos", hint: "Banco de alimentos" },
  { href: "/perfil", label: "Perfil", hint: "Metas e dados" },
];

/**
 * Tab bar for phones.
 *
 * The header's link list scrolls sideways below `sm` — seven items do not fit
 * 360px — which hides destinations behind a gesture nobody performs, at the
 * top of the screen, where a thumb holding a phone at the gym cannot reach.
 *
 * Hidden from `sm` up, where the header shows every link at once.
 */
export function BottomNav() {
  const pathname = usePathname();
  const [more, setMore] = useState(false);

  const inRest = REST.some((item) => pathname.startsWith(item.href));

  return (
    <>
      <nav
        aria-label="Principal"
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line",
          "bg-canvas/95 backdrop-blur sm:hidden",
          "h-(--bottom-nav-h) pb-[env(safe-area-inset-bottom)]",
        )}
      >
        {TABS.map(({ href, label, icon: Icon }) => {
          // The home route is a prefix of every other one, so it is the single
          // case that has to match exactly.
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5",
                "transition-colors duration-150 ease-out",
                active ? "text-accent-text" : "text-ink-subtle hover:text-ink",
              )}
            >
              <Icon aria-hidden className="size-5" />
              <span className="text-[0.625rem] leading-none">{label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={() => {
            setMore(true);
          }}
          aria-haspopup="dialog"
          aria-expanded={more}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5",
            "transition-colors duration-150 ease-out",
            inRest ? "text-accent-text" : "text-ink-subtle hover:text-ink",
          )}
        >
          <Menu aria-hidden className="size-5" />
          <span className="text-[0.625rem] leading-none">Mais</span>
        </button>
      </nav>

      {/* A sheet rather than a sixth, seventh and eighth tab: these are opened
          deliberately, not tapped between sets, and a bar of eight icons on a
          360px screen is a row of targets too small to hit. */}
      <Dialog
        open={more}
        title="Mais"
        onClose={() => {
          setMore(false);
        }}
        className="m-0 mt-auto w-full max-w-none rounded-t-2xl rounded-b-none border-x-0 border-b-0"
      >
        <ul className="space-y-1">
          {REST.map(({ href, label, hint }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => {
                  setMore(false);
                }}
                aria-current={pathname.startsWith(href) ? "page" : undefined}
                className="flex flex-col rounded-lg px-3 py-3 transition-colors duration-150 ease-out hover:bg-muted aria-[current=page]:bg-muted"
              >
                <span className="text-ink">{label}</span>
                <span className="mt-0.5 text-xs text-ink-subtle">{hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
