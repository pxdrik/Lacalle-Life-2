"use client";

import type { LucideIcon } from "lucide-react";
import { useRef } from "react";

import { cn } from "@/design-system/cn";

export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly icon?: LucideIcon | undefined;
}

interface Props {
  readonly items: readonly TabItem[];
  readonly value: string;
  readonly onChange: (id: string) => void;
  /** Keeps id/aria-controls pairs unique when more than one `Tabs` renders on the same page. */
  readonly idPrefix: string;
  readonly className?: string;
}

function tabId(prefix: string, id: string): string {
  return `${prefix}-tab-${id}`;
}

export function tabPanelId(prefix: string, id: string): string {
  return `${prefix}-panel-${id}`;
}

/**
 * `role="tablist"`/`"tab"` com `aria-selected`, `aria-controls` e roving
 * tabindex — a semântica que faltava nos dois produtos (brandbook, seção
 * 43). O mais perto que existia era o visual do `.nav-tab` do Finance —
 * ícone + rótulo, fundo tingido no ativo, sublinhado que entra sozinho —
 * sem papel ARIA nenhum: um leitor de tela ouvia "botão, Transações" igual
 * a qualquer outro botão da tela, nunca "aba 2 de 6, selecionada". Este
 * componente parte daquele visual e acrescenta o contrato de acessibilidade
 * que ele nunca teve.
 *
 * **Foco por teclado é roving tabindex**, o padrão WAI-ARIA de Tabs: só a
 * aba ativa entra no tab order (`tabIndex 0`); ←/→ movem a seleção entre
 * abas e a levam com o foco, Home/End vão para as pontas — Tab sai da lista
 * pro conteúdo, nunca percorre aba por aba.
 */
export function Tabs({ items, value, onChange, idPrefix, className }: Props) {
  const buttonsRef = useRef(new Map<string, HTMLButtonElement>());

  function focus(id: string): void {
    buttonsRef.current.get(id)?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const index = items.findIndex((item) => item.id === value);
    if (index === -1) return;

    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;

    if (next === null) return;

    event.preventDefault();
    const nextItem = items[next];
    if (nextItem === undefined) return;

    onChange(nextItem.id);
    focus(nextItem.id);
  }

  return (
    <div
      role="tablist"
      className={cn("flex gap-1", className)}
      onKeyDown={handleKeyDown}
    >
      {items.map((item) => {
        const active = item.id === value;
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            ref={(el) => {
              if (el === null) buttonsRef.current.delete(item.id);
              else buttonsRef.current.set(item.id, el);
            }}
            id={tabId(idPrefix, item.id)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={tabPanelId(idPrefix, item.id)}
            tabIndex={active ? 0 : -1}
            onClick={() => {
              onChange(item.id);
            }}
            className={cn(
              "relative flex touch-44 items-center gap-1.5 rounded-md px-3 text-sm font-medium",
              "transition-colors duration-(--duration-micro) ease-out",
              active
                ? "bg-accent-surface text-accent-text"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {Icon !== undefined && <Icon aria-hidden className="size-4" />}
            {item.label}
            {/* Só existe na árvore enquanto a aba está ativa — sai e volta a
                cada troca, então a animação de entrada roda de novo toda vez
                que esta aba é selecionada, não só na primeira. */}
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-2 bottom-0 h-0.5 rounded-t-full bg-accent [animation:var(--animate-tab-indicator)]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

interface PanelProps {
  readonly id: string;
  readonly idPrefix: string;
  readonly className?: string;
  readonly children: React.ReactNode;
}

/** The tab's content — `aria-labelledby` ties it back to the button that opened it. */
export function TabPanel({ id, idPrefix, className, children }: PanelProps) {
  return (
    <div
      role="tabpanel"
      id={tabPanelId(idPrefix, id)}
      aria-labelledby={tabId(idPrefix, id)}
      className={className}
    >
      {children}
    </div>
  );
}
