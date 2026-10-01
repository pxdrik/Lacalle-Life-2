"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Signature } from "@/design-system/brand/signature";
import { cn } from "@/design-system/cn";
import { ThemeToggle } from "@/design-system/theme/theme-toggle";

import { Badge } from "./badge";

export interface WorkspaceLink {
  readonly href: Route;
  readonly label: string;
  readonly icon: LucideIcon;
  /** Um número ao lado do rótulo (pedidos esperando, por exemplo). Zero some. */
  readonly count?: number | undefined;
}

/**
 * A casca das áreas de trabalho: Administração agora, Life Pro depois
 * (protótipos aprovados em 28/09 e 01/10/2026). É a mesma anatomia da barra
 * lateral do app, com outra lista e uma etiqueta ("Admin", "Pro") ao lado da
 * assinatura, para nunca parecer que se está no app pessoal.
 *
 * - A partir de `lg`: barra lateral fixa, conteúdo até `--content-max`, que
 *   `data-area="pro"` sobe para 1600px (`tokens.css`, regra de tela larga do
 *   `docs/brandbook.md`, só nestas áreas).
 * - Abaixo de `lg`: cabeçalho no topo, com a mesma lista em linha que rola
 *   para o lado se não couber (como o protótipo v3).
 *
 * "Voltar para o app" fica sempre à mão: é a mesma conta, e a pessoa alterna
 * entre a própria dieta e o trabalho.
 */
export function WorkspaceShell({
  badge,
  title,
  links,
  children,
}: {
  readonly badge: string;
  /** O nome da navegação, para leitor de tela ("Administração"). */
  readonly title: string;
  readonly links: readonly WorkspaceLink[];
  readonly children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = (href: string) =>
    // O primeiro item é a raiz da área ("/admin"): só ele exige igualdade.
    href === links[0]?.href ? pathname === href : pathname.startsWith(href);

  return (
    <div data-area="pro" className="min-h-dvh bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-(--sidebar-w) flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-(--header-h) shrink-0 items-center gap-2 border-b border-line px-4">
          <Link href="/hoje" aria-label="LaCalle Life, voltar para o app">
            <Signature />
          </Link>
          <Badge state="atencao">{badge}</Badge>
        </div>
        <nav aria-label={title} className="flex-1 overflow-y-auto p-3">
          <h2 className="px-4 pb-2 text-[0.625rem] font-bold text-ink-subtle uppercase [letter-spacing:0.12em]">
            {title}
          </h2>
          <ul className="space-y-1">
            {links.map((link) => (
              <li key={link.href}>
                <WorkspaceNavLink link={link} active={active(link.href)} wide />
              </li>
            ))}
          </ul>
        </nav>
        <div className="shrink-0 space-y-2 border-t border-line p-3">
          <BackToApp />
          <div className="px-1">
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-line bg-surface lg:hidden">
        <div className="flex h-(--header-h) items-center gap-2 px-4">
          <Link href="/hoje" aria-label="LaCalle Life, voltar para o app">
            <Signature />
          </Link>
          <Badge state="atencao">{badge}</Badge>
          <div className="ml-auto">
            <BackToApp compact />
          </div>
        </div>
        <nav aria-label={title} className="overflow-x-auto px-3 pb-2">
          <ul className="flex gap-1">
            {links.map((link) => (
              <li key={link.href} className="shrink-0">
                <WorkspaceNavLink link={link} active={active(link.href)} />
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <div className="lg:pl-(--sidebar-w)">
        <main className="mx-auto max-w-(--content-max) px-4 pt-6 pb-16 md:px-6 lg:px-12 lg:pt-10">{children}</main>
      </div>
    </div>
  );
}

function WorkspaceNavLink({
  link,
  active,
  wide = false,
}: {
  readonly link: WorkspaceLink;
  readonly active: boolean;
  readonly wide?: boolean;
}) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-10 items-center gap-3 rounded-md text-sm transition-colors duration-(--duration-micro) ease-out",
        wide ? "pr-3 pl-4" : "px-3",
        active ? "bg-accent-surface font-medium text-accent-text" : "text-ink-muted hover:bg-muted hover:text-ink",
      )}
    >
      {active && wide && (
        <span aria-hidden className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-accent" />
      )}
      {wide && <Icon aria-hidden className="size-5 shrink-0" />}
      <span className="whitespace-nowrap">{link.label}</span>
      {link.count !== undefined && link.count > 0 && (
        <span
          className={cn(
            "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs font-semibold tabular-nums",
            wide && "ml-auto",
            "bg-warning-surface text-warning-text",
          )}
        >
          {link.count}
        </span>
      )}
    </Link>
  );
}

/**
 * No cabeçalho estreito, só o ícone: em 320px Confortável o rótulo "App" ao
 * lado da assinatura e da etiqueta passava 21px da tela (medido). O nome
 * continua para leitor de tela.
 */
function BackToApp({ compact = false }: { readonly compact?: boolean }) {
  return (
    <Link
      href="/hoje"
      aria-label={compact ? "Voltar para o app" : undefined}
      className={cn(
        "flex h-10 items-center gap-2 rounded-md text-sm text-ink-muted transition-colors duration-(--duration-micro) ease-out hover:bg-muted hover:text-ink",
        compact ? "w-10 justify-center" : "px-3",
      )}
    >
      <ChevronLeft aria-hidden className="size-4 shrink-0" />
      {!compact && "Voltar para o app"}
    </Link>
  );
}
