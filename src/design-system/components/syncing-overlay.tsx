import { Mark } from "@/design-system/brand/signature";
import { cn } from "@/design-system/cn";
import { Button } from "./button";

/**
 * Cobre a tela enquanto uma sincronização de rede está em andamento.
 *
 * `Button`'s `pending` normal (ver a doc lá) apaga e trava de propósito, sem
 * spinner — pensado para uma escrita local, que termina num piscar de olhos.
 * Um round-trip de verdade contra o Supabase leva segundos, e nesse tempo um
 * botão só apagado lê como "não aconteceu nada" — achado do Pedro clicando
 * em "Sincronizar dados" e vendo a tela parada por alguns segundos. Isto é
 * para esse caso: uma tela de carregamento com a marca do produto pulsando,
 * para o tempo de espera parecer intencional em vez de quebrado.
 *
 * Fica em pé até quem chamou decidir que terminou — não só quando a rede
 * responde, mas até o resultado realmente aparecer na tela (ver
 * `ManualSyncButton`/`notifyProfileChanged`), o que pode ser mais alguns
 * instantes. Sem `onCancel` não há teto de tempo nenhum embutido aqui, então
 * quem usa isto sem uma saída manual está prometendo que a promessa que
 * segura `pending` sempre resolve — `ManualSyncButton` é o único uso hoje, e
 * sempre passa `onCancel` por causa exatamente disso: uma rede que nunca
 * responde não pode prender a pessoa atrás desta tela para sempre.
 */
export function SyncingOverlay({
  label = "Sincronizando seus dados…",
  onCancel,
}: {
  readonly label?: string;
  readonly onCancel?: () => void;
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
      {onCancel !== undefined && (
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      )}
    </div>
  );
}
