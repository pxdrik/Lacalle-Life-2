/**
 * What the workouts feature offers to the rest of the app.
 *
 * `ExerciseBrowser` is the whole exercise-picking surface, and it is exported
 * because the workout builder will mount it with `onSelect` rather than grow a
 * second, divergent list.
 */
export { ExerciseBrowser } from "./components/exercise-browser";
export { EQUIPMENT_LABELS, type Equipment } from "./taxonomy/equipment";
export {
  MOVEMENT_PATTERN_LABELS,
  TECHNICAL_DIFFICULTY_LABELS,
  type MovementPattern,
  type TechnicalDifficulty,
} from "./taxonomy/movement";
export { MUSCLE_LABELS, type MuscleGroup } from "./taxonomy/muscles";
export { type Exercise } from "./types/exercise";
