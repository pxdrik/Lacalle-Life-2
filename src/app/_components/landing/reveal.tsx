"use client";

import { cn } from "@/design-system/cn";
import { useReveal } from "./use-reveal";

interface Props {
  readonly children: React.ReactNode;
  readonly className?: string;
  /**
   * Posição no grupo, para o atraso entre irmãos — 0 é o primeiro, sem
   * atraso. Multiplica `--duration-stagger` em vez de um valor solto, mesmo
   * token que o resumo de treino e o card recém-adicionado da rotina usam.
   */
  readonly index?: number;
}

/**
 * Entrada de seção ao rolar a tela — Level 2/Interface do Motion System v1
 * (`docs/roadmap.md`, 09/09/2026): cartão e seção entrando, não dado
 * assentando. `--duration-standard` e `--ease-out`, as mesmas duas curvas
 * oficiais do resto do app — nada de física de mola aqui também, a decisão
 * já fechada na pesquisa vale igual dentro e fora do produto.
 */
export function Reveal({ children, className, index = 0 }: Props) {
  const { ref, revealed } = useReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={cn(
        "transition-[opacity,translate] duration-(--duration-standard) ease-out motion-reduce:transition-none",
        revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
        className,
      )}
      style={
        index > 0
          ? { transitionDelay: `calc(var(--duration-stagger) * ${String(index)})` }
          : undefined
      }
    >
      {children}
    </div>
  );
}
