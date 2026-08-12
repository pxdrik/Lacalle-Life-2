import {
  Activity,
  Apple,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  TrendingUp,
  User,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

/**
 * One glyph per concept, in one place.
 *
 * The icons are for **recognition, not decoration** — which only works if a
 * concept is drawn the same way everywhere it appears. It was not: two of the
 * four tabs on the phone opened a screen wearing a different glyph than the
 * tab you tapped. `Hoje` was a house in the bar and a calendar on the page;
 * `Diário` was cutlery in the bar and a notebook on the page. An icon that
 * changes between the tap and the arrival is worse than no icon, because it
 * spends the reader's attention and then contradicts itself.
 *
 * Two ties had to be broken to get here.
 *
 * **Hoje is a calendar, not a house.** The screen is titled "Hoje" and
 * subtitled with the date, and the wordmark in the header already carries
 * "back to the start" — the house was answering a question nothing was asking.
 *
 * **Diário is cutlery, not a notebook.** Both readings are true — it is a
 * record, and it is food — so the tie went to the one the app was already
 * using three times over: the two cards on the home screen that link to it
 * both carry `UtensilsCrossed`. A notebook was the odd one out, not the rule.
 *
 * `Alimentos` stays an apple even though `Alimentação` is cutlery, and that is
 * not a collision: one is the ingredient database, the other is the act of
 * eating today. Different concepts earn different glyphs; the same concept
 * never gets two.
 */
export const ICONS = {
  today: CalendarDays,
  diary: UtensilsCrossed,
  workouts: Dumbbell,
  diets: ClipboardList,
  progress: TrendingUp,
  exercises: Activity,
  foods: Apple,
  profile: User,
} satisfies Record<string, LucideIcon>;
