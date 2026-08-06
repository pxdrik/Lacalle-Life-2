/**
 * What the exercise is loaded with.
 *
 * A list per exercise, because one movement can admit more than one tool when
 * the load is comparable — a rosca direta is the same lift on a straight bar or
 * a W bar. When the load does *not* transfer, they are separate entries
 * instead. See the granularity rule in `docs/catalogo-exercicios.md`.
 */
export const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "smith",
  "kettlebell",
  "band",
  "bodyweight",
  "plate",
  "trx",
  "cardio-machine",
] as const;

export type Equipment = (typeof EQUIPMENT)[number];

export const EQUIPMENT_LABELS: Readonly<Record<Equipment, string>> = {
  barbell: "Barra",
  dumbbell: "Halteres",
  machine: "Máquina",
  cable: "Polia",
  smith: "Smith",
  kettlebell: "Kettlebell",
  band: "Elástico",
  bodyweight: "Peso corporal",
  plate: "Anilha",
  trx: "TRX",
  "cardio-machine": "Aparelho de cardio",
};
