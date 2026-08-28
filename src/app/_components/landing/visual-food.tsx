import { cardSurface } from "@/design-system/components/card";

/**
 * O painel de "Hoje" em miniatura: mesmo raio, mesma borda, mesmas cores de
 * macro (`text-protein-text`/`text-carbs-text`/`text-fat-text`) que o app de
 * verdade usa em `TodayEnergy`. Números fixos, para uma tela pública que
 * ninguém logou ainda ter algo para mostrar — nunca um valor inventado como
 * se fosse consumo real, só a forma real do painel.
 */
export function VisualFood() {
  return (
    <div className={cardSurface("hero")}>
      <p className="text-xs text-ink-subtle">Hoje</p>
      <p className="mt-1 text-metric font-bold tabular-nums text-ink">
        1.840 <span className="text-sm font-normal text-ink-subtle">kcal para hoje</span>
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center">
        <div>
          <p className="text-sm font-semibold tabular-nums text-protein-text">128 g</p>
          <p className="text-xs text-ink-subtle">Prot</p>
        </div>
        <div>
          <p className="text-sm font-semibold tabular-nums text-carbs-text">190 g</p>
          <p className="text-xs text-ink-subtle">Carb</p>
        </div>
        <div>
          <p className="text-sm font-semibold tabular-nums text-fat-text">52 g</p>
          <p className="text-xs text-ink-subtle">Gord</p>
        </div>
      </div>

      <p className="mt-3 text-xs text-ink-subtle">Fibra · 35 g/dia</p>
    </div>
  );
}
