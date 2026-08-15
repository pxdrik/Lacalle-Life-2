"use client";

import type { Route } from "next";
import { Menu, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/design-system/cn";
import { Dialog } from "@/design-system/components/dialog";
import { ICONS } from "@/design-system/icons";

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
  { href: "/", label: "Hoje", icon: ICONS.today },
  { href: "/diario", label: "Diário", icon: ICONS.diary },
  { href: "/treinos", label: "Treinos", icon: ICONS.workouts },
  { href: "/evolucao", label: "Evolução", icon: ICONS.progress },
];

/**
 * The icons are the same ones the tabs use, from the same table — and until
 * now this list had none at all. Four destinations that carry a glyph on their
 * own header, in the tab bar, and on the home screen arrived here as two lines
 * of text, so the one place where somebody is *hunting* for a screen was the
 * one place the glyphs were missing.
 */
const REST: readonly {
  href: Route;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    href: "/dietas",
    label: "Dietas",
    hint: "Seus planos alimentares",
    icon: ICONS.diets,
  },
  {
    href: "/exercicios",
    label: "Exercícios",
    hint: "Catálogo e personalizados",
    icon: ICONS.exercises,
  },
  {
    href: "/alimentos",
    label: "Alimentos",
    hint: "Banco de alimentos",
    icon: ICONS.foods,
  },
  {
    href: "/perfil",
    label: "Perfil",
    hint: "Metas e dados",
    icon: ICONS.profile,
  },
];

/**
 * A barra de abas do celular — quatro destinos e "Mais", que é o teto de cinco
 * itens da pág. 32.
 *
 * Vai até 768 px, não até 640. É a tabela da pág. 32: abaixo de 768 a navegação
 * é tab bar, entre 768 e 1023 é drawer sobreposto, e de 1024 em diante é a
 * sidebar fixa. A faixa do meio mostrava uma fileira de links que rolava de
 * lado, escondendo destinos atrás de um gesto que ninguém executa.
 *
 * ## O ícone preenchido do item ativo, e por que ele não está aqui
 *
 * A pág. 32 pede que "o ativo use ícone preenchido + acento", e a pág. 28 abre
 * para isso a **única** exceção do sistema à regra de ícones lineares. Não dá
 * para cumprir: o app usa Lucide, que é uma biblioteca linear sem família
 * preenchida, e `fill="currentColor"` só funciona nos glifos fechados —
 * `TrendingUp` é uma polilinha aberta e `UtensilsCrossed` são dois traços
 * cruzados, e preencher os dois produz borrão, não ícone. A saída de buscar os
 * preenchidos em outra biblioteca é justamente o que a pág. 28 proíbe: "usar
 * biblioteca diferente por produto".
 *
 * O que o item ativo faz no lugar é o tratamento que a **pág. 31** dá ao item
 * ativo da sidebar — acento sobre a superfície do acento — o que entrega o que
 * a regra do preenchimento existe para entregar: distinção por **forma** além
 * de cor, que é o que a pág. 48 exige de todo estado. Registrado em
 * `docs/brandbook.md`.
 */
/**
 * O rótulo é 11 px SemiBold, que é o estilo Label da pág. 17.
 *
 * Era 10 px. A pág. 48 fixa 12 px como piso de texto e a pág. 17 define o Label
 * em 11 — as duas páginas discordam, e entre elas 10 px não está em nenhuma
 * leitura. Um rótulo de aba é um label, então vale o estilo do label; o piso de
 * 12 px é sobre conteúdo, que é a coisa que a pág. 32 proíbe encolher "para
 * caber".
 */
const TAB = cn(
  "flex flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold leading-none",
  "transition-colors duration-(--duration-micro) ease-out",
);

const IDLE = "text-ink-subtle hover:text-ink";

/** A pílula do item ativo: raio full, que a pág. 23 reserva a pills e toggles. */
const GLYPH =
  "flex h-6 w-11 items-center justify-center rounded-full transition-colors duration-(--duration-micro) ease-out";

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
          "bg-canvas/95 backdrop-blur md:hidden",
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
              className={cn(TAB, active ? "text-accent-text" : IDLE)}
            >
              <span className={cn(GLYPH, active && "bg-accent-surface")}>
                <Icon aria-hidden className="size-5" />
              </span>
              {label}
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
          className={cn(TAB, inRest ? "text-accent-text" : IDLE)}
        >
          <span className={cn(GLYPH, inRest && "bg-accent-surface")}>
            <Menu aria-hidden className="size-5" />
          </span>
          Mais
        </button>
      </nav>

      {/* A sheet rather than a sixth, seventh and eighth tab: these are opened
          deliberately, not tapped between sets, and a bar of eight icons on a
          360px screen is a row of targets too small to hit. */}
      <Dialog
        open={more}
        title="Mais"
        placement="sheet-bottom"
        onClose={() => {
          setMore(false);
        }}
      >
        <ul className="space-y-1">
          {REST.map(({ href, label, hint, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => {
                  setMore(false);
                }}
                aria-current={pathname.startsWith(href) ? "page" : undefined}
                className="group flex items-center gap-3 rounded-md px-3 py-3 transition-colors duration-(--duration-micro) ease-out hover:bg-muted aria-[current=page]:bg-accent-surface aria-[current=page]:text-accent-text"
              >
                <Icon aria-hidden className="size-5 shrink-0 text-ink-subtle" />
                <span className="min-w-0">
                  <span className="block">{label}</span>
                  {/* `ink-muted` e não `ink-subtle`: sobre `muted` no hover o
                      terciário mede 4,39:1, e a troca é a saída que a paleta do
                      brandbook deixa — ver a nota em `tokens.css`. */}
                  <span className="mt-1 block text-xs text-ink-subtle group-hover:text-ink-muted">
                    {hint}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
