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
 * Entrada de seção ao rolar a tela — Level 3, deliberadamente mais expressivo
 * que o Level 2 do resto do app: pedido explícito do Pedro de mais
 * intensidade na Landing, que a pág. 38 já reserva um tier pra isso
 * ("signature: LaCalle Reveal, troca de módulo, transições de identidade") —
 * a Landing sendo sempre a primeira tela de todo mundo agora é exatamente
 * esse tipo de momento. `--duration-signature` e `--ease-out`, ainda as duas
 * curvas oficiais — mais peso vem de distância e de escala, nunca de uma
 * curva nova ou de física de mola.
 */
export function Reveal({ children, className, index = 0 }: Props) {
  const { ref, revealed } = useReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={cn(
        "transition-[opacity,translate,scale] duration-(--duration-signature) ease-out motion-reduce:transition-none",
        revealed ? "scale-100 opacity-100 translate-y-0" : "scale-[0.97] opacity-0 translate-y-6",
        className,
      )}
      style={
        index > 0
          ? { transitionDelay: `calc(var(--duration-stagger) * ${String(index * 2)})` }
          : undefined
      }
    >
      {children}
    </div>
  );
}
