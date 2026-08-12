import type { Macros } from "@/core/domain/macros";

/**
 * The three macronutrients, and how the app draws them.
 *
 * **One table, because there were six.** Protein, carbohydrate and fat were
 * spelled out with their own label and their own colour in `macro-progress`,
 * `macro-summary`, `plan-summary`, `meal-item-row`, `food-row` and
 * `custom-food-form` — six chances to disagree, and they already did: the
 * custom food form, the one screen where a person *types* these three numbers,
 * carried no colour at all. Everywhere else protein is blue; there it was ink
 * like everything else.
 *
 * That is the failure this exists to prevent. A colour code is only a code if
 * it holds on every screen — one that lapses teaches the reader it means
 * nothing, and then it is decoration that happens to cost contrast.
 *
 * **Two labels, not one.** A meal header has room for `Prot` and a profile
 * summary has room for `Proteína`, and forcing either to use the other's is
 * how a table like this gets abandoned. Both live here so the pair cannot
 * drift apart the way the colours did.
 *
 * **Calories are deliberately absent.** They are not a macro, they carry no
 * hue anywhere in the app, and the screens that show them beside these three
 * each have their own reason for how — the ring on the home screen, the lead
 * figure in a summary, the plain total on a row. See `MacroProgress`, which
 * prepends its own calorie bar in `bg-ink`.
 *
 * The hues themselves, and why blue/amber/violet rather than the obvious
 * green/red pair, are argued in `tokens.css`.
 */
export type MacroKey = Exclude<keyof Macros, "kcal">;

export interface MacroCoding {
  readonly key: MacroKey;
  /** For a dense row: a meal header, a food list, a progress label. */
  readonly short: string;
  /** Where there is room to say it: a plan summary, a form field. */
  readonly long: string;
  /**
   * The value drawn as text, which answers to 4.5:1 rather than the 3:1 a bar
   * owes — a distinction `tokens.css` argues, and that carbohydrate was
   * failing on five screens before these were split.
   */
  readonly text: string;
  /** The value drawn as an area — a bar, a dot, a swatch. */
  readonly fill: string;
}

export const MACRO_CODING: readonly MacroCoding[] = [
  {
    key: "proteinG",
    short: "Prot",
    long: "Proteína",
    text: "text-protein-text",
    fill: "bg-protein",
  },
  {
    key: "carbsG",
    short: "Carb",
    long: "Carboidrato",
    text: "text-carbs-text",
    fill: "bg-carbs",
  },
  {
    key: "fatG",
    short: "Gord",
    long: "Gordura",
    text: "text-fat-text",
    fill: "bg-fat",
  },
];
