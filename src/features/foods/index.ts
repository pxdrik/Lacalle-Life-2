/**
 * What the foods feature offers to the rest of the app.
 *
 * Everything not listed here is private. The ESLint boundary blocks deeper
 * imports, so this file is the whole contract — adding to it is a decision,
 * not an accident.
 */
export { FoodPicker } from "./components/food-picker";
export { useFoodRepository } from "./data/food-repository-context";
export { useFoodCatalogue } from "./hooks/use-food-catalogue";
export { createCustomFood } from "./services/create-food";
export {
  FOOD_CATEGORIES,
  FOOD_CATEGORY_LABELS,
  type Food,
  type FoodCategory,
  type FoodUnit,
  type PracticalUnit,
} from "./types/food";
export { customFoodSchema, type CustomFoodInput } from "./validation/food-schema";
