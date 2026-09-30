import { formatDecimal } from "@/core/format/decimal";
import {
  ACTIVITY_LABELS,
  GOAL_LABELS,
  SEX_LABELS,
  type NutritionProfile,
} from "@/core/nutrition";

/**
 * "Seus dados" (roadmap 9.1, 30/09/2026): o que a pessoa informou, à vista.
 *
 * Com o perfil preenchido a tela mostrava as metas e escondia os dados que
 * as geraram atrás de "Editar dados". O handoff da aba pede que a pessoa
 * entenda que os números do plano saem daqui, e distinga o obrigatório do
 * opcional: os dois opcionais ganham a etiqueta, e o que ficou em branco diz
 * "Não informado", nunca um zero.
 */
export function ProfileDataSummary({ profile }: { readonly profile: NutritionProfile }) {
  const rows: readonly {
    readonly label: string;
    readonly value: string | null;
    readonly optional?: boolean;
  }[] = [
    { label: "Sexo", value: SEX_LABELS[profile.sex] },
    { label: "Idade", value: `${formatDecimal(profile.ageYears)} anos` },
    { label: "Altura", value: `${formatDecimal(profile.heightCm)} cm` },
    { label: "Peso", value: `${formatDecimal(profile.weightKg)} kg` },
    // Só a parte antes da vírgula ("Moderado"): o rótulo inteiro ("Moderado,
    // 3 a 5 treinos por semana") é o do formulário, onde se escolhe; aqui
    // ele quebraria a linha.
    { label: "Atividade", value: ACTIVITY_LABELS[profile.activityLevel].split(",")[0] ?? "" },
    { label: "Objetivo", value: GOAL_LABELS[profile.goal] },
    {
      label: "Gordura corporal",
      value: profile.bodyFatPercent == null ? null : `${formatDecimal(profile.bodyFatPercent)}%`,
      optional: true,
    },
    // Manter não tem ritmo: o formulário desabilita o campo, e o resumo o omite.
    ...(profile.goal === "maintain"
      ? []
      : [
          {
            label: "Ritmo",
            value:
              profile.weeklyChangeKg == null ? null : `${formatDecimal(profile.weeklyChangeKg)} kg/semana`,
            optional: true,
          },
        ]),
  ];

  return (
    <dl className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm"
        >
          {/* `flex-wrap` + `ml-auto`: em 320px a linha mais comprida
              ("Gordura corporal · opcional · Não informado") passava 17px da
              borda. Sem espaço, o valor desce e continua à direita. */}
          <dt className="flex items-center gap-1.5 whitespace-nowrap text-ink-muted">
            {row.label}
            {row.optional === true && (
              <span className="rounded-full border border-line px-1.5 text-[0.6875rem] text-ink-subtle">
                opcional
              </span>
            )}
          </dt>
          <dd
            className={
              row.value === null
                ? "ml-auto text-right text-ink-subtle"
                : "ml-auto text-right font-medium tabular-nums text-ink"
            }
          >
            {row.value ?? "Não informado"}
          </dd>
        </div>
      ))}
    </dl>
  );
}
