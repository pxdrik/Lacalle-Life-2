import { Mark } from "@/design-system/brand/signature";
import { cn } from "@/design-system/cn";

/**
 * Cobre a tela enquanto uma sincronização de rede está em andamento.
 *
 * `Button`'s `pending` normal (ver a doc lá) apaga e trava de propósito, sem
 * spinner — pensado para uma escrita local, que termina num piscar de olhos.
 * Um round-trip de verdade contra o Supabase leva segundos, e nesse tempo um
 * botão só apagado lê como "não aconteceu nada" — achado do Pedro clicando
 * em "Sincronizar dados" e vendo a tela parada por alguns segundos. Isto é
 * para esse caso: uma tela de carregamento curta, com a marca do produto
 * pulsando, para o tempo de espera parecer intencional em vez de quebrado.
 */
export function SyncingOverlay({
  label = "Sincronizando seus dados…",
}: {
  readonly label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center gap-4",
        "bg-canvas/90 backdrop-blur-sm",
      )}
    >
      {/* Decorativo — o texto ao lado já é o que a tela lê em voz alta, e um
          `title` aqui também duplicaria o anúncio (mesma regra que a doc de
          `Mark` já explica para o símbolo isolado). */}
      <Mark className="h-12 w-auto animate-pulse-soft text-accent" />
      <p className="text-sm text-ink-muted">{label}</p>
    </div>
  );
}
