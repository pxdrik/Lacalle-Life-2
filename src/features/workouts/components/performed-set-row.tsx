"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { formatDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";
import { Dialog } from "@/design-system/components/dialog";
import { useCollapsibleRemove } from "@/design-system/hooks/use-collapsible-remove";

import type { PerformedSetChanges } from "../services/edit-session";
import type { PerformedSet } from "../types/session";
import { DurationField } from "./duration-field";
import { RpeSelect } from "./rpe-select";
import { WeightField } from "./weight-field";

interface Props {
  readonly set: PerformedSet;
  readonly index: number;
  readonly exerciseName: string;
  /**
   * The next set to do. Highlighted and scrolled to, never focus-stolen.
   *
   * "Focus Transition" — the brandbook names it, the roadmap left it
   * without a trigger until now: attention moving to a new set as the
   * previous one is confirmed. The mechanism is the same 3px accent bar
   * `Card`'s `hero` tone already uses for "this is the one" (page 24), not
   * a new gimmick — reserved at 3px transparent even when not next, so the
   * bar arriving is a colour transition, never a layout shift.
   */
  readonly isNext: boolean;
  /** Whether this exercise is measured by time rather than reps × weight. */
  readonly isCardio: boolean;
  readonly onChange: (changes: PerformedSetChanges) => void;
  readonly onToggleComplete: () => void;
  readonly onRemove: () => void;
}

/**
 * O campo não declara mais largura: a coluna da grade declara (`set-grid`,
 * `globals.css`), e o campo ocupa a coluna inteira.
 *
 * Isto substitui a largura fixa de 17/09/2026, que existia para fugir de um
 * `w-full` dentro de `flex-1` medido renderizando a 21,86px. A causa real
 * daquele número era a porcentagem resolvida contra uma largura que o
 * `flex-grow` calculava, num elemento com `zoom` próprio. Dentro de uma
 * coluna de grade não há nada disso: a faixa tem largura definida antes do
 * conteúdo, e o contra-zoom agora é do contêiner, não do campo.
 */
const FIELD =
  "relative h-11 w-full rounded-md border bg-surface px-1.5 text-center text-base tabular-nums transition-colors duration-150 ease-out";

export function PerformedSetRow({
  set,
  index,
  exerciseName,
  isNext,
  isCardio,
  onChange,
  onToggleComplete,
  onRemove,
}: Props) {
  const row = useRef<HTMLLIElement>(null);
  const number = index + 1;

  // How many times *this* button has been pressed in this mount. Only used to
  // key the check so the confirmation replays per tap — never read as data.
  const [taps, setTaps] = useState(0);
  const [showingActions, setShowingActions] = useState(false);

  const { requestRemove, collapseProps } = useCollapsibleRemove(onRemove);

  useEffect(() => {
    // Scrolled into view, but never focused. Focusing would open the phone
    // keyboard over the rest timer every time a set is marked — the number is
    // usually already right, and typing is the exception.
    if (isNext)
      row.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [isNext]);

  return (
    // "Delete/Collapse" — the li is the shrinking grid track
    // (`useCollapsibleRemove`); the visual row underneath is a separate,
    // unclipped element so its own highlight transition (background/border,
    // `--duration-micro`) keeps its own timing instead of fighting the
    // slower `--duration-standard` collapse.
    <li
      ref={row}
      className="grid transition-[grid-template-rows] duration-(--duration-standard) ease-out"
      {...collapseProps}
    >
      <div className="overflow-hidden">
        <div
          className={cn(
            // Sem `px-1`: ele era o outro lado do offset que o cabeçalho
            // copiava para compensar 7px de desalinhamento. Com a grade, os
            // dois lados começam na mesma coluna sem ninguém compensar nada.
            "group rounded-sm border border-l-[3px] border-transparent py-1.5",
            // `--duration-standard`, não `--duration-micro` — achado real,
            // 17/09/2026: a barra de foco chegando em 150ms lia como "sem
            // animação" mesmo com `prefers-reduced-motion` confirmadamente
            // desligado. `--duration-micro` continua certo pra hover/toggle
            // comum (pág. 38); atenção migrando de série pra série pede o
            // tier de baixo, o mesmo que cards/modais já usam.
            "transition-[background-color,border-color] duration-(--duration-standard) ease-out",
            isNext && "border-l-accent bg-muted",
            // Surface and border, not colour and not opacity. `opacity-60` used
            // to be the *only* effect of a finished set — which faded the check
            // button's own accent fill along with everything else, dimming the
            // one signal the row exists to give. A done row now gets the same
            // settled, framed surface a finished `Card` gets elsewhere in the
            // app: `bg-muted` plus a hairline border, permanent rather than a
            // hover state — recognisable mid-workout without a second saturated
            // colour anywhere on the line.
            set.isCompleted && "border-line bg-muted",
          )}
        >
          {/* `set-grid` declara as colunas a partir do `--set-cols` que o card
              define uma vez; esta linha não sabe largura nenhuma. `items-start`
              (na própria utilidade) porque os campos carregam a legenda
              "planejado" abaixo (`<Planned>`) e o bloco deles é mais alto que
              os botões: alinhar pelo topo põe campo e botão começando na mesma
              linha, e só o número da série, que não tem legenda, pede
              `self-center` de volta. */}
          <div className="set-grid">
            {/* O número é o gatilho das ações da série, e não custa uma coluna
                a mais: ele já era a primeira coluna. O X dedicado saiu daqui em
                26/09/2026 porque seis alvos da classe 44px não cabem em 360px,
                que é largura obrigatória — a conta não fecha com ou sem grade.
                Mesma decisão estrutural que a dieta tomou em `meal-item-row`,
                onde as ações por alimento foram para trás de um `⋮` pelo mesmo
                motivo medido. `touch-44` dá o alvo de 44px sem ocupar layout. */}
            <button
              type="button"
              onClick={() => {
                setShowingActions(true);
              }}
              aria-label={`Ações da série ${String(number)} de ${exerciseName}`}
              className="flex h-6 w-full items-center justify-center touch-44 self-center rounded-md text-sm tabular-nums text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
            >
              {number}
            </button>

            {/* What was planned, sitting under the field it refers to — a target you
              have to remember is a target you ignore. */}
            {isCardio ? (
              <div>
                <DurationField
                  value={set.durationSeconds}
                  label={`Duração da série ${String(number)} de ${exerciseName}, em minutos`}
                  onChange={(durationSeconds) => {
                    onChange({ durationSeconds });
                  }}
                  className={cn(
                    FIELD,
                    set.isCompleted ? "border-line" : "border-line-strong",
                  )}
                />
                <Planned
                  value={
                    set.planned?.durationSeconds === undefined ||
                    set.planned.durationSeconds === null
                      ? null
                      : set.planned.durationSeconds / 60
                  }
                  suffix="min"
                />
              </div>
            ) : (
              <>
                {/* Peso primeiro, Repetição em segundo (17/09/2026, pedido do
                    Pedro) — mesma ordem em `session-exercise-card.tsx`,
                    `planned-set-row.tsx` e `routine-exercise-card.tsx`, pra
                    planejar e executar o treino não discordarem sobre qual
                    coluna vem primeiro. */}
                <div>
                  <WeightField
                    value={set.weightKg}
                    label={`Peso da série ${String(number)} de ${exerciseName}`}
                    onChange={(weightKg) => {
                      onChange({ weightKg });
                    }}
                    className={cn(
                      FIELD,
                      set.isCompleted ? "border-line" : "border-line-strong",
                    )}
                  />
                  <Planned value={set.planned?.weightKg ?? null} suffix="kg" />
                </div>

                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={set.reps === null ? "" : String(set.reps)}
                    aria-label={`Repetições da série ${String(number)} de ${exerciseName}`}
                    placeholder="—"
                    onChange={(event) => {
                      onChange({ reps: toWholeNumber(event.target.value) });
                    }}
                    className={cn(
                      FIELD,
                      set.isCompleted ? "border-line" : "border-line-strong",
                    )}
                  />
                  <Planned value={set.planned?.reps ?? null} suffix="reps" />
                </div>
              </>
            )}

            {/* RPE reports effort against a rep/weight target — a treadmill has
                neither, so there is nothing here for it to rate. */}
            {!isCardio && (
              <div>
                {/* `w-full`, não `size-11`: 44px aqui seria a largura da
                    coluna escrita uma segunda vez, que é precisamente o que
                    esta fase existe para acabar. A altura continua sendo
                    `h-11`, a mesma de `FIELD` — altura de controle é do
                    controle, largura é da coluna. O mostrador é um meio
                    círculo e largo-e-baixo achatava o arco, então a coluna é
                    quadrada de propósito. */}
                <RpeSelect
                  value={set.rpe}
                  label={`RPE da série ${String(number)} de ${exerciseName}`}
                  onChange={(rpe) => {
                    onChange({ rpe });
                  }}
                  className="h-11 w-full"
                />
                <Planned value={set.planned?.rpe ?? null} suffix="RPE" />
              </div>
            )}

            {/* 44px, the comfortable one-handed target, and the only large button in
              the row — it is the action repeated dozens of times per workout. */}
            <button
              type="button"
              onClick={() => {
                setTaps((count) => count + 1);
                onToggleComplete();
              }}
              aria-pressed={set.isCompleted}
              aria-label={
                set.isCompleted
                  ? `Desmarcar série ${String(number)} de ${exerciseName}`
                  : `Concluir série ${String(number)} de ${exerciseName}`
              }
              className={cn(
                "flex h-11 w-full items-center justify-center rounded-lg border",
                // The scale-on-press itself is now the same global
                // `--press-scale` every `<button>` in the app gets
                // (`globals.css`, 17/09/2026) — this class used to hand-carry
                // its own 90%, which the global rule would have silently
                // overridden anyway (higher specificity), so it stayed as
                // dead code lying about the real number.
                "transition-colors duration-150 ease-out",
                set.isCompleted
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line-strong text-ink-subtle hover:border-accent hover:text-ink",
              )}
            >
              {/* Keyed by the tap counter, not by `isCompleted`: remounting is
                  what replays the animation, and keying it off the state would set
                  every check on screen off at once when a finished workout is
                  reopened. `taps > 0` is the same guarantee said twice — nothing
                  animates until this particular button has been pressed.

                  `motion-reduce:animate-none` rather than a hook: the global rule
                  collapses animation to 0.01ms, which would land the check at its
                  0.6 starting scale and leave it there. */}
              <Check
                key={taps}
                aria-hidden
                className={cn(
                  "size-5",
                  taps > 0 &&
                    set.isCompleted &&
                    "animate-pop motion-reduce:animate-none",
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Mesma folha que a dieta usa para as ações por alimento. Sem
          `ConfirmButton`: remover uma série nunca pediu confirmação aqui, e
          esta fase move a ação de lugar, não muda o que ela faz. O desfazer
          continua sendo o "Série extra" logo abaixo. */}
      <Dialog
        open={showingActions}
        title={`Série ${String(number)} de ${exerciseName}`}
        onClose={() => {
          setShowingActions(false);
        }}
        placement="sheet-bottom"
      >
        <button
          type="button"
          onClick={() => {
            setShowingActions(false);
            requestRemove();
          }}
          aria-label={`Remover série ${String(number)} de ${exerciseName}`}
          className="flex h-11 w-full items-center rounded-md px-3 text-sm text-danger transition-colors duration-150 ease-out hover:bg-danger/10"
        >
          Remover série
        </button>
      </Dialog>
    </li>
  );
}

function Planned({
  value,
  suffix,
}: {
  readonly value: number | null;
  readonly suffix: string;
}) {
  return (
    <p className="mt-1 h-4 text-center text-xs tabular-nums text-ink-subtle">
      {value === null ? "" : `${formatDecimal(value)} ${suffix}`}
    </p>
  );
}

function toWholeNumber(input: string): number | null {
  const digits = input.replace(/\D/g, "");
  if (digits === "") return null;

  return Math.min(Number(digits), 1000);
}
