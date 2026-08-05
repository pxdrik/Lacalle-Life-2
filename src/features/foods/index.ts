/**
 * What the foods feature offers to the rest of the app.
 *
 * Everything not listed here is private. The ESLint boundary blocks deeper
 * imports, so this file is the whole contract — adding to it is a decision,
 * not an accident.
 */
export { FoodPicker } from "./components/food-picker";
export {
  FOOD_CATEGORY_LABELS,
  type Food,
  type FoodCategory,
} from "./types/food";
