"use client";

import { cn } from "@/design-system/cn";
import { noticeClasses } from "@/design-system/components/notice";
import { PAGE_SHELL_BLEED } from "@/design-system/components/page-shell";
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { dayKey, formatDay } from "@/core/format/day";
import { Button, buttonClasses } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { DateField } from "@/design-system/components/date-field";
import {
  SortableItem,
  SortableList,
} from "@/design-system/components/sortable-list";
import { Skeleton } from "@/design-system/components/skeleton";
import { useNutritionTargets } from "@/features/profile";

import { useApplyPickedFood } from "../hooks/use-apply-picked-food";
import { useDietList } from "../hooks/use-diet-list";
import { useFoodLogDay } from "../hooks/use-food-log";
import { dietForWeekday, weekdayOf } from "../services/diet-schedule";
import {
  addMeal,
  copyItemToMeal,
  duplicateMeal,
  moveItemToMeal,
  moveMeal,
  removeItem,
  removeMeal,
  reorderMealItems,
  reorderMeals,
  setItemGrams,
  setItemUnit,
  updateMeal,
} from "../services/edit-diet";
import {
  checkMeal,
  closeMeal,
  eatenMacros,
  isMealLogged,
  mealCheckState,
  openMeal,
  toggleLoggedMeal,
} from "../services/meal-execution";
import { startDayFromDiet } from "../services/start-day";
import type { Diet, Meal } from "../types/diet";
import type { FoodLog } from "../types/food-log";
import { MacroProgress } from "./macro-progress";
import { MacroSummary } from "./macro-summary";
import { MealCard } from "./meal-card";

/** Shifts a `YYYY-MM-DD` day by whole days, without dragging a clock along. */
function shiftDay(day: string, offset: number): string {
  const [year, month, date] = day.split("-").map(Number);
  if (year === undefined || month === undefined || date === undefined)
    return day;

  return dayKey(new Date(year, month - 1, date + offset));
}

/** The same local-parts construction `shiftDay` uses, for reading a weekday
 * out of a `YYYY-MM-DD` string without `new Date(string)`'s UTC parsing —
 * that would read 21:00 in São Paulo as the next calendar day. */
function parseDayLocal(day: string): Date | null {
  const [year, month, date] = day.split("-").map(Number);
  if (year === undefined || month === undefined || date === undefined)
    return null;

  return new Date(year, month - 1, date);
}

/**
 * What was eaten on one day.
 *
 * The screen the app was missing. Everything below the date bar is the diet
 * editor's own machinery — `MealCard`, the meal operations, the totals — which
 * is the whole reason the meal functions were widened from `Diet` to
 * `MealOwner`. A second implementation of meal editing would have drifted from
 * the first within a month.
 */
export function FoodLogScreen({ day }: { readonly day: string }) {
  const router = useRouter();
  const { state, saveError, hasConflict, apply, replace, reload } =
    useFoodLogDay(day);
  const { state: dietList } = useDietList();
  // `null` whenever no profile is filled in, which is the normal case.
  const targets = useNutritionTargets();
  const [picking, setPicking] = useState(false);
  useApplyPickedFood(apply);

  const today = dayKey(new Date());

  // The diet scheduled for this weekday, if any — `undefined` while diets
  // are still loading, same as "no link" for the empty state's purposes.
  const parsedDay = parseDayLocal(day);
  const linkedDiet =
    dietList.status === "ready" && parsedDay !== null
      ? dietForWeekday(dietList.diets, weekdayOf(parsedDay))
      : undefined;

  /**
   * Days are a query parameter, not a route segment, so the default can be
   * resolved on the client. The server has no idea what day it is where the
   * reader is standing, and a redirect computed there would be wrong for
   * anyone west of it after 21:00.
   */
  const goToDay = (next: string) => {
    router.push(next === today ? "/diario" : `/diario?dia=${next}`);
  };

  return (
    <div>
      <nav className="flex items-center gap-2" aria-label="Dia">
        <DayStep
          label="Dia anterior"
          onClick={() => {
            goToDay(shiftDay(day, -1));
          }}
        >
          <ChevronLeft aria-hidden className="size-4" />
        </DayStep>

        {/* Dias futuros deixaram de ser bloqueados aqui — a dieta vinculada
            a um dia da semana (`dietForWeekday`) só pode ser conferida
            andando pra frente no calendário, e um dia sem nada registrado
            ainda é um convite válido a planejar, não um erro. O que
            continua sendo verdade é que o Diário nunca inventa dado: nada
            é escrito num dia futuro sem alguém clicar "Começar de X" ou
            "Adicionar refeição", exatamente como hoje. */}
        <DateField
          value={day}
          label="Dia do registro"
          onChange={goToDay}
          className="h-(--control-h) rounded-md border border-line bg-surface px-3 text-ink transition-colors duration-150 ease-out hover:border-line-strong"
        />

        <DayStep
          label="Próximo dia"
          onClick={() => {
            goToDay(shiftDay(day, 1));
          }}
        >
          <ChevronRight aria-hidden className="size-4" />
        </DayStep>

        {day !== today && (
          <button
            type="button"
            onClick={() => {
              goToDay(today);
            }}
            className="text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            Hoje
          </button>
        )}
      </nav>

      {state.status === "loading" && (
        <div aria-hidden className="mt-6 space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      )}

      {state.status === "error" && (
        <div
          role="alert"
          className={cn("mt-6", noticeClasses("danger", "block"))}
        >
          <p className="text-ink">Não foi possível abrir este dia.</p>
          <p className="mt-1.5 text-sm text-ink-muted">{state.message}</p>
        </div>
      )}

      {state.status === "ready" && (
        <>
          {/* Sticky, because the totals are the reason the screen exists:
              every portion typed is a question about them. */}
          <div
            className={cn(
              PAGE_SHELL_BLEED,
              "sticky top-0 z-10 mt-4 border-b border-line bg-canvas/90 py-3 backdrop-blur",
            )}
          >
            {targets === null ? (
              <MacroSummary macros={eatenMacros(state.log)} size="lg" />
            ) : (
              <MacroProgress
                totals={eatenMacros(state.log)}
                targets={targets}
              />
            )}
          </div>

          {saveError !== null && (
            <div role="alert" className={cn("mt-4", noticeClasses())}>
              <p>{saveError}</p>
              {hasConflict && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={reload}
                >
                  Recarregar dados
                </Button>
              )}
            </div>
          )}

          {/* O check mora aqui, não na tela da Dieta — é o Diário que se
              usa todo dia, e ir até Dietas só para marcar "comi isto" era
              o passo extra que sobrava. Mostra só o que falta: uma vez
              marcada, a refeição sai daqui e aparece na lista abaixo, como
              qualquer outra do dia. */}
          {linkedDiet !== undefined && (
            <PlannedMeals
              diet={linkedDiet}
              log={state.log}
              onCheck={(meal) => {
                apply((current) => checkMeal(current, linkedDiet, meal));
              }}
              onOpen={(meal) => {
                apply((current) => openMeal(current, linkedDiet, meal));
              }}
            />
          )}

          {state.log.meals.length === 0 ? (
            <EmptyDay
              day={day}
              diets={dietList.status === "ready" ? dietList.diets : []}
              linkedDiet={linkedDiet}
              picking={picking}
              onPick={(diet) => {
                replace(startDayFromDiet(diet, day));
                setPicking(false);
              }}
              onOpenPicker={() => {
                setPicking(true);
              }}
              onAddMeal={() => {
                apply(addMeal);
              }}
            />
          ) : (
            <SortableList
              ids={state.log.meals.map((meal) => meal.id)}
              describe={(id) =>
                state.log.meals.find((meal) => meal.id === id)?.name ??
                "refeição"
              }
              onReorder={(activeId, overId) => {
                apply((current) => reorderMeals(current, activeId, overId));
              }}
            >
              <div className="mt-5 space-y-3">
                {state.log.meals.map((meal, index) => {
                  // Calculado uma vez, reaproveitado pelo check e pelo
                  // "Fechar" no ⋮ abaixo — os dois só existem numa refeição
                  // vinda da dieta (`sourceDietId`/`sourceMealId`), e
                  // `checkState` já é a forma certa de perguntar "está
                  // comida?" sem ler `meal.eaten` direto aqui (ver a nota em
                  // `meal-execution.ts`: só aquele arquivo lê o campo cru).
                  const sourceDietId = meal.sourceDietId;
                  const sourceMealId = meal.sourceMealId;
                  const checkState =
                    sourceDietId !== undefined && sourceMealId !== undefined
                      ? mealCheckState(state.log, sourceDietId, sourceMealId)
                      : undefined;

                  return (
                  <SortableItem key={meal.id} id={meal.id}>
                    {(dragHandle) => (
                      <MealCard
                        meal={meal}
                        position={index}
                        total={state.log.meals.length}
                        dragHandle={dragHandle}
                        onChange={(changes) => {
                          apply((current) =>
                            updateMeal(current, meal.id, changes),
                          );
                        }}
                        onRemove={() => {
                          apply((current) => removeMeal(current, meal.id));
                        }}
                        onDuplicate={() => {
                          apply((current) => duplicateMeal(current, meal.id));
                        }}
                        onMove={(offset) => {
                          apply((current) =>
                            moveMeal(current, meal.id, offset),
                          );
                        }}
                        otherMeals={state.log.meals
                          .filter((other) => other.id !== meal.id)
                          .map((other) => ({ id: other.id, name: other.name }))}
                        onSendItem={(itemId, targetMealId, mode) => {
                          apply((current) =>
                            mode === "copy"
                              ? copyItemToMeal(
                                  current,
                                  meal.id,
                                  itemId,
                                  targetMealId,
                                )
                              : moveItemToMeal(
                                  current,
                                  meal.id,
                                  itemId,
                                  targetMealId,
                                ),
                          );
                        }}
                        onReorderItems={(activeId, overId) => {
                          apply((current) =>
                            reorderMealItems(
                              current,
                              meal.id,
                              activeId,
                              overId,
                            ),
                          );
                        }}
                        onAddFoodClick={() => {
                          const returnTo = encodeURIComponent(
                            day === today ? "/diario" : `/diario?dia=${day}`,
                          );
                          router.push(
                            `/alimentos/selecionar?returnTo=${returnTo}&mealId=${meal.id}`,
                          );
                        }}
                        onItemGramsChange={(itemId, grams) => {
                          apply((current) =>
                            setItemGrams(current, meal.id, itemId, grams),
                          );
                        }}
                        onItemUnitChange={(itemId, unit) => {
                          apply((current) =>
                            setItemUnit(current, meal.id, itemId, unit),
                          );
                        }}
                        onRemoveItem={(itemId) => {
                          apply((current) =>
                            removeItem(current, meal.id, itemId),
                          );
                        }}
                        // Só aparece numa refeição que veio da dieta — de um
                        // check individual ou de "Começar de X" — uma
                        // refeição montada aqui à mão não tem
                        // `sourceDietId`/`sourceMealId`, então não há nada
                        // para o check representar. Pode ser "unchecked"
                        // sim: "Começar de X" entra com todas as refeições
                        // do dia já visíveis, mas ainda por comer.
                        checkState={checkState}
                        onToggleChecked={
                          sourceDietId !== undefined &&
                          sourceMealId !== undefined
                            ? () => {
                                apply((current) =>
                                  toggleLoggedMeal(
                                    current,
                                    sourceDietId,
                                    sourceMealId,
                                  ),
                                );
                              }
                            : undefined
                        }
                        // "Fechar" no ⋮ — mesma proveniência do check acima,
                        // mas só quando ainda não comida: fechar uma
                        // refeição já registrada apagaria um registro real,
                        // e `closeMeal` já se recusa a fazer isso sozinho —
                        // aqui a checagem evita nem oferecer a opção.
                        onClose={
                          sourceDietId !== undefined &&
                          sourceMealId !== undefined &&
                          checkState === "unchecked"
                            ? () => {
                                apply((current) =>
                                  closeMeal(
                                    current,
                                    sourceDietId,
                                    sourceMealId,
                                  ),
                                );
                              }
                            : undefined
                        }
                      />
                    )}
                  </SortableItem>
                  );
                })}
              </div>
            </SortableList>
          )}

          {state.log.meals.length > 0 && (
            <button
              type="button"
              onClick={() => {
                apply(addMeal);
              }}
              className="mt-3 inline-flex h-(--control-h-lg) w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line text-sm text-ink-muted transition-colors duration-150 ease-out hover:border-line-strong hover:text-ink"
            >
              <Plus aria-hidden className="size-4" />
              Adicionar refeição
            </button>
          )}
        </>
      )}
    </div>
  );
}

function DayStep({
  label,
  onClick,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-(--control-h) items-center justify-center rounded-lg border border-line text-ink-muted transition-colors duration-150 ease-out hover:border-line-strong hover:text-ink"
    >
      {children}
    </button>
  );
}

/**
 * The first thing on an unrecorded day.
 *
 * Starting from a diet is the primary action because it is the common case:
 * somebody who built a plan eats roughly that plan, and copying it turns
 * logging into adjusting a few numbers instead of building the day twice.
 */
function EmptyDay({
  day,
  diets,
  linkedDiet,
  picking,
  onPick,
  onOpenPicker,
  onAddMeal,
}: {
  readonly day: string;
  readonly diets: readonly Diet[];
  /** The diet scheduled for this weekday, if any — see `dietForWeekday`. */
  readonly linkedDiet: Diet | undefined;
  readonly picking: boolean;
  readonly onPick: (diet: Diet) => void;
  readonly onOpenPicker: () => void;
  readonly onAddMeal: () => void;
}) {
  return (
    // Quiet: an empty day is an invitation, not a result. Raising a card that
    // reports nothing gives the most presence on the screen to the absence of
    // content.
    <Card tone="quiet" className="mt-6 text-center">
      <p className="text-ink">Nada registrado em {formatDay(day)}.</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-subtle">
        {linkedDiet !== undefined
          ? // A dieta vinculada ao dia da semana já é a resposta pronta —
            // continua sendo um convite, não uma escrita automática: alguém
            // ainda escolhe o botão.
            `"${linkedDiet.name}" está vinculada a este dia da semana.`
          : "Comece de uma dieta que você já montou e ajuste o que mudou, ou monte o dia do zero."}
      </p>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {linkedDiet !== undefined ? (
          <Button
            onClick={() => {
              onPick(linkedDiet);
            }}
          >
            Começar de &quot;{linkedDiet.name}&quot;
          </Button>
        ) : (
          diets.length > 0 &&
          !picking && (
            <Button onClick={onOpenPicker}>Começar de uma dieta</Button>
          )
        )}
        {linkedDiet !== undefined && diets.length > 1 && !picking && (
          <Button variant="secondary" onClick={onOpenPicker}>
            Escolher outra dieta
          </Button>
        )}
        <Button variant="secondary" onClick={onAddMeal}>
          <Plus aria-hidden className="size-4" />
          Adicionar refeição
        </Button>
        {/* Quem percebe aqui que precisa se organizar não deveria ter que
            descobrir sozinho o caminho Diário → Dietas → criar. Leva direto
            para o formulário de criação que já existe no topo de `/dietas`
            (`DietList`) — sem um segundo fluxo de criação. */}
        <Link href="/dietas" className={buttonClasses("secondary")}>
          Criar uma dieta
        </Link>
      </div>

      {picking && (
        <ul className="mx-auto mt-4 max-w-sm space-y-1.5 text-left">
          {diets.map((diet) => (
            <li key={diet.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(diet);
                }}
                className="w-full rounded-md border border-line px-4 py-2.5 text-sm text-ink transition-colors duration-150 ease-out hover:border-line-strong hover:bg-muted"
              >
                {diet.name === "" ? "Dieta sem nome" : diet.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * The linked diet's meals that have never been pulled into today's log at
 * all — not "unchecked", which since `startDayFromDiet` stopped
 * pre-checking everything is also true of most of a freshly started day's
 * meals, already shown in full below. This list is only for the gap before
 * that: a day with nothing (or only a hand-made meal) yet, where checking
 * one off here is the lighter alternative to "Começar de X" for logging
 * just one meal. Checking here moves the meal out of this compact list and
 * into the full one below, same as ever — it just no longer disappears
 * again if unchecked afterwards, which is the whole point of `isMealLogged`
 * (once-in, stays-in) instead of `mealCheckState` here.
 *
 * The food names sit on their own line (17/09/2026: before this, only the
 * meal's name showed, and deciding whether to log "Almoço" meant opening the
 * full diet to remember what was actually in it) — one truncated line, the
 * same shape `MealAlternativesDialog` already uses for a saved suggestion's
 * contents.
 *
 * Two ways in, both landing on the same full `MealCard` below (17/09/2026):
 * tapping the check pulls the meal in **eaten** — the one-tap path for "yes,
 * exactly this" — while tapping the row itself calls `onOpen` and pulls it
 * in **unchecked**, the same state `startDayFromDiet` already seeds a whole
 * day in. That is what makes looking at or adjusting a planned meal not
 * require first claiming it was eaten — the row used to be a dead end with
 * only the check as a way out, and opening it meant answering a question
 * ("did you eat this?") the person was not ready to answer yet.
 */
function PlannedMeals({
  diet,
  log,
  onCheck,
  onOpen,
}: {
  readonly diet: Diet;
  readonly log: FoodLog;
  readonly onCheck: (meal: Meal) => void;
  readonly onOpen: (meal: Meal) => void;
}) {
  const pending = diet.meals.filter(
    (meal) => !isMealLogged(log, diet.id, meal.id),
  );

  if (pending.length === 0) return null;

  return (
    <div className="mt-4">
      <h2 className="text-xs font-medium tracking-wide text-ink-subtle uppercase">
        Planejado para {formatDay(log.day)}
      </h2>
      <ul className="mt-2 space-y-1.5">
        {pending.map((meal) => (
          <li
            key={meal.id}
            className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2"
          >
            <button
              type="button"
              onClick={() => {
                onOpen(meal);
              }}
              aria-label={`Abrir ${meal.name}`}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-sm text-ink">{meal.name}</p>
              {meal.items.length > 0 && (
                <p className="mt-0.5 truncate text-xs text-ink-subtle">
                  {meal.items.map((item) => item.name).join(", ")}
                </p>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                onCheck(meal);
              }}
              aria-label={`Marcar ${meal.name} como comida`}
              className="flex size-8 shrink-0 items-center justify-center touch-44 rounded-md border border-line-strong text-ink-subtle transition-colors duration-150 ease-out hover:border-accent hover:text-ink"
            >
              <Check aria-hidden className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
