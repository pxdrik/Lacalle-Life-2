/**
 * How the body moves, independent of the tool.
 *
 * This is what a balance check keys off — "your week has four pushes and no
 * hinge". Without it that analysis would need the catalogue remodelled.
 */
export const MOVEMENT_PATTERNS = [
  "horizontal-push",
  "vertical-push",
  "horizontal-pull",
  "vertical-pull",
  "squat",
  "hinge",
  "lunge",
  "carry",
  "isolation",
  "core",
  "cardio",
] as const;

export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export const MOVEMENT_PATTERN_LABELS: Readonly<Record<MovementPattern, string>> = {
  "horizontal-push": "Empurrar horizontal",
  "vertical-push": "Empurrar vertical",
  "horizontal-pull": "Puxar horizontal",
  "vertical-pull": "Puxar vertical",
  squat: "Agachar",
  hinge: "Dobradiça de quadril",
  lunge: "Avanço",
  carry: "Carregar",
  isolation: "Isolado",
  core: "Core",
  cardio: "Cardio",
};

/**
 * Anatomical planes of motion.
 *
 * A list rather than a single value: most exercises are dominantly one plane,
 * but some are genuinely multi-planar — a Turkish get-up or a wood chop are not
 * describable by picking one. A single-element list is the common case, and
 * omitting the field entirely is the honest answer when it is unclear.
 */
export const MOVEMENT_PLANES = ["sagittal", "frontal", "transverse"] as const;

export type MovementPlane = (typeof MOVEMENT_PLANES)[number];

export const MOVEMENT_PLANE_LABELS: Readonly<Record<MovementPlane, string>> = {
  sagittal: "Sagital",
  frontal: "Frontal",
  transverse: "Transversal",
};

/**
 * How much technique is required before the movement can be loaded safely.
 *
 * **Not** how hard it feels. A leg press taken to failure is exhausting and
 * still `beginner`, because nothing about it has to be learned first. A pistol
 * squat is `advanced` at bodyweight.
 *
 * Perceived effort is RPE, recorded per set — a different axis entirely.
 */
export const TECHNICAL_DIFFICULTIES = [
  "beginner",
  "intermediate",
  "advanced",
] as const;

export type TechnicalDifficulty = (typeof TECHNICAL_DIFFICULTIES)[number];

export const TECHNICAL_DIFFICULTY_LABELS: Readonly<
  Record<TechnicalDifficulty, string>
> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};
