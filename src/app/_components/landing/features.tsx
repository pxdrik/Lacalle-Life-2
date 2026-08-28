import { ICONS } from "@/design-system/icons";

import { FeatureRow } from "./feature-row";
import { VisualEvolution } from "./visual-evolution";
import { VisualFood } from "./visual-food";
import { VisualWorkout } from "./visual-workout";

/**
 * As três seções de funcionalidade, uma por pilar. Só o que existe: nada de
 * sugestão automática de refeição nem de ajuste por IA, que a regra 2 e 3 de
 * `AGENTS.md` tiram de escopo do produto inteiro, não só desta tela.
 */
export function Features() {
  return (
    <div className="mx-auto max-w-(--content-max) space-y-24 px-4 py-20 md:space-y-28 md:px-6 md:py-28 lg:px-12">
      <FeatureRow
        icon={ICONS.diary}
        title="Alimentação"
        text="Registre o que comeu, monte suas dietas com calma e acompanhe o quanto ainda cabe no dia."
        bullets={[
          "Registrar refeições, com um banco de mais de 500 alimentos",
          "Montar dietas do zero, sem depender de sugestão pronta",
          "Acompanhar calorias, proteína, carboidrato e gordura",
          "Fibra como referência diária, ao lado dos outros macros",
        ]}
        visual={<VisualFood />}
      />

      <FeatureRow
        icon={ICONS.workouts}
        title="Treinos"
        text="Crie seus treinos, escolha os exercícios do catálogo e registre cada série como ela realmente aconteceu."
        bullets={[
          "Criar treinos com os exercícios que você escolher",
          "Catálogo de exercícios com foto de referência",
          "Registrar peso, repetições e RPE série por série",
          "Histórico completo de cada treino já concluído",
        ]}
        visual={<VisualWorkout />}
        reverse
      />

      <FeatureRow
        icon={ICONS.progress}
        title="Evolução"
        text="Peso, volume de treino e progresso ao longo do tempo, em gráficos que usam os dados que você já registrou."
        bullets={[
          "Gráfico de peso corporal ao longo do tempo",
          "Volume de treino por semana e por mês",
          "Recordes por exercício, com a melhor estimativa de carga",
        ]}
        visual={<VisualEvolution />}
      />
    </div>
  );
}
