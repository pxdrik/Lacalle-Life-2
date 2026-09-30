"use client";

import { useRecentFoods } from "@/features/diet/hooks/use-recent-foods";
import { FoodSelectionScreen } from "@/features/foods/components/food-selection-screen";

/**
 * Junta o diário e o seletor (roadmap 7.2, 30/09/2026).
 *
 * `diet` importa `foods`, nunca o contrário, então quem sabe o que a pessoa
 * comeu (o diário) não pode ser chamado de dentro do seletor. A página é o
 * lugar que conhece os dois: pega os recentes de um e entrega ao outro.
 */
export function SelectFoodRoute() {
  const recents = useRecentFoods();
  return <FoodSelectionScreen recents={recents} />;
}
