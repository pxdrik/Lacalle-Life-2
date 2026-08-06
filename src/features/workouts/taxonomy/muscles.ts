/**
 * Muscle groups, at the granularity people actually program by.
 *
 * Order is anatomical, not alphabetical: it is the order the filter renders in,
 * and a list that runs abdominais → adutores → antebraços reads as a database
 * dump rather than as a body.
 *
 * Changing this list is a schema change — entries reference it — so it is
 * deliberately hard to add to. Adding an *exercise* is not.
 */
export const MUSCLE_GROUPS = [
  "chest",
  "lats",
  "upper-back",
  "traps",
  "front-delts",
  "side-delts",
  "rear-delts",
  "biceps",
  "triceps",
  "forearms",
  "abs",
  "obliques",
  "lower-back",
  "glutes",
  "quads",
  "hamstrings",
  "adductors",
  "abductors",
  "calves",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_LABELS: Readonly<Record<MuscleGroup, string>> = {
  chest: "Peito",
  lats: "Dorsais",
  "upper-back": "Costas superiores",
  traps: "Trapézio",
  "front-delts": "Deltoide anterior",
  "side-delts": "Deltoide lateral",
  "rear-delts": "Deltoide posterior",
  biceps: "Bíceps",
  triceps: "Tríceps",
  forearms: "Antebraços",
  abs: "Abdômen",
  obliques: "Oblíquos",
  "lower-back": "Lombar",
  glutes: "Glúteos",
  quads: "Quadríceps",
  hamstrings: "Posterior de coxa",
  adductors: "Adutores",
  abductors: "Abdutores",
  calves: "Panturrilhas",
};

/**
 * Which catalogue file an exercise belongs in.
 *
 * The split exists so a 200-entry catalogue stays reviewable, and it is *not*
 * a second source of truth: a test checks that every entry sits in the region
 * its primary muscle maps to here.
 */
export const REGIONS = [
  "peito",
  "costas",
  "ombros",
  "bracos",
  "pernas",
  "core",
  "cardio",
] as const;

export type Region = (typeof REGIONS)[number];

export const MUSCLE_REGION: Readonly<Record<MuscleGroup, Region>> = {
  chest: "peito",
  lats: "costas",
  "upper-back": "costas",
  traps: "costas",
  "front-delts": "ombros",
  "side-delts": "ombros",
  "rear-delts": "ombros",
  biceps: "bracos",
  triceps: "bracos",
  forearms: "bracos",
  abs: "core",
  obliques: "core",
  "lower-back": "core",
  glutes: "pernas",
  quads: "pernas",
  hamstrings: "pernas",
  adductors: "pernas",
  abductors: "pernas",
  calves: "pernas",
};
