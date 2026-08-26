"use client";

import Link from "next/link";

import { formatDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";
import { Card } from "@/design-system/components/card";
import { Metric } from "@/design-system/components/metric";
import { Skeleton } from "@/design-system/components/skeleton";
import { MACRO_CODING } from "@/design-system/macros";
import { useNutritionTargets } from "@/features/profile";

import { useFoodLogDay } from "../hooks/use-food-log";
import { dietMacros } from "../services/diet-macros";
import { MacroSummary } from "./macro-summary";

/**
 * How much of the day is left, in calories — the hero of `/`.
 *
 * The first question anyone opens a diet app to ask, and the reason the home
 * screen exists at all. It reads the diary rather than keeping a second copy
 * of the day: the numbers here and the numbers in `/diario` are the same
 * numbers, computed the same way, or they would drift apart within a week.
 *
 * **One hero, not two cards of equal weight.** They used to be siblings — a
 * ring in one card, macros in another, competing for the same rank on the
 * screen. Sprint 8 puts them in the one piece the page exists to show: the
 * ring stays the only shape the app draws nowhere else, and the three macros
 * sit underneath it, smaller, past a rule — read *after* the ring, not beside
 * it. The `Abrir diário` / `Registrar` link that used to live on the macro
 * card's own header is gone from here: `TodayMeals` right below already
 * carries it, and printing it twice was the split card's own symptom.
 *
 * The whole card works without a profile — the ring needs a target and simply
 * does not appear without one, leaving the totals, which are true either way.
 * A screen that demanded a profile to say anything would contradict the rule
 * the rest of the app is built on.
 */
export function TodayEnergy({ day }: { readonly day: string }) {
  const { state } = useFoodLogDay(day);
  const targets = useNutritionTargets();

  if (state.status === "loading") {
    return <Skeleton className="h-72 w-full rounded-lg lg:col-span-2" />;
  }

  if (state.status === "error") {
    return (
      <Card role="alert" tone="hero" className="min-w-0 lg:col-span-2">
        <p className="text-ink">Não foi possível ler o dia de hoje.</p>
        <p className="mt-1.5 text-sm text-ink-muted">{state.message}</p>
      </Card>
    );
  }

  const totals = dietMacros(state.log);
  const nothingYet = totals.kcal === 0;

  if (targets === null) {
    // No profile means no ring, so this branch is the whole hero. The way
    // into the diary has to live here too: without a target *and* without a
    // way to record, the screen would state a problem and offer nothing. A
    // test holds this — it caught the link going missing when the shared
    // header was removed.
    return (
      <Card as="section" tone="hero" className="min-w-0 text-center lg:col-span-2">
        <MacroSummary macros={totals} size="lg" />
        <p className="mt-3 text-xs text-ink-subtle">
          Sem meta para comparar.{" "}
          <Link
            href="/perfil"
            className="underline underline-offset-4 hover:text-ink"
          >
            Preencha o perfil
          </Link>{" "}
          se quiser ver quanto ainda cabe no dia.
        </p>
        <Link
          href="/diario"
          className="mt-4 inline-block text-sm text-ink-muted underline underline-offset-4 transition-colors duration-150 ease-out hover:text-ink"
        >
          {nothingYet ? "Registrar" : "Abrir diário"}
        </Link>
      </Card>
    );
  }

  return (
    <Card
      as="section"
      tone="hero"
      className="flex min-w-0 flex-col items-center lg:col-span-2"
    >
      <div className="flex w-full flex-1 items-center justify-center py-4">
        <CalorieRing
          consumed={totals.kcal}
          target={targets.kcal}
          nothingYet={nothingYet}
        />
      </div>

      {/* Secondary by construction, not just by convention: smaller size,
          past a rule, read only after the ring resolves. Three columns —
          never `MacroProgress`'s bars — because a bar argues for attention
          the same way the ring does, and this block exists to not do that. */}
      <div className="mt-2 grid w-full max-w-xs grid-cols-3 gap-2 border-t border-line pt-4">
        {MACRO_CODING.map(({ key, short, text }) => (
          <Metric
            key={key}
            // "Consumido / meta" responde de imediato "quanto falta?" — o
            // número sozinho exigia lembrar a meta de cor ou abrir o
            // perfil. Só aparece aqui porque este ramo já garantiu
            // `targets !== null`; nunca inventa uma meta que não existe.
            value={`${formatDecimal(totals[key])} / ${formatDecimal(targets[key])}`}
            unit="g"
            label={short}
            size="sm"
            tone={text}
            align="center"
          />
        ))}
      </div>
    </Card>
  );
}

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Calories as one shape.
 *
 * The single figure that gets a graphic instead of a bar, because it is the
 * one people check without reading — and because a ring reads as "how much of
 * the day is spent" in a way a horizontal bar does not.
 *
 * The arc is capped at a full turn while the colour carries the overshoot: a
 * ring that wrapped past its own start would draw 110% and 10% identically.
 *
 * `aria-hidden` on the drawing, with the same facts as real text beside it.
 * The transition is neutralised for `prefers-reduced-motion` by the global
 * rule in `globals.css`, so it needs nothing of its own here.
 */
function CalorieRing({
  consumed,
  target,
  nothingYet,
}: {
  readonly consumed: number;
  readonly target: number;
  readonly nothingYet: boolean;
}) {
  const ratio = target === 0 ? 0 : consumed / target;
  const over = consumed > target;
  const remaining = target - consumed;

  return (
    <div className="relative shrink-0">
      {/* Sized up from 128px flat. This is the figure the screen exists to
          show — the one people open the app to read and then close it — and at
          the old size it was merely one of several things in the card. */}
      <svg
        aria-hidden
        viewBox="0 0 128 128"
        className="size-36 -rotate-90 sm:size-44"
        role="presentation"
      >
        {/* **O degradê do anel saiu, e a decisão é do brandbook.**

            Ele era a assinatura desta tela: a rampa da marca correndo ao longo
            do arco, do stop mais claro onde o progresso começa até o mais fundo
            conforme avança. A pág. 46 desfaz isso em uma linha — gradiente é
            "recurso de superfície, nunca de identidade", e a lista de onde ele
            é proibido nomeia **barras de progresso** junto com botões, inputs e
            séries de gráfico. Um anel é uma barra de progresso curvada.

            O teste que a mesma página propõe é o que decide: "remova todos os
            gradientes da peça — se ela deixar de funcionar, o problema não era
            a falta de gradiente". O anel continua sendo a coisa mais visível da
            tela pelo tamanho, pela posição e por ser a única forma saturada em
            vista. Ele não dependia da rampa.

            O que se perde é uma sutileza que quase ninguém via: a rampa
            espelhava de volta depois dos 50%, porque SVG não tem gradiente
            cônico e a aproximação linear só acompanha o arco na primeira
            metade. Era uma limitação assumida; agora é uma limitação que não
            existe mais. */}

        {/* **One continuous track, in every state.**
            It used to go dashed on an empty day — the app's own word for
            absence, applied to the track and never to the progress. The
            mechanism was right and the reading was not: three independent
            readers described the result as broken rather than as empty, which
            is what a dashed ring says when it is the only dashed ring in
            sight. A solid neutral track still invents no progress — the arc
            below simply has nothing to draw — and it says "not yet" without
            saying "faulty".

            `nothingYet` survives in the caption, which is where the empty day
            is now stated in words. */}
        <circle
          cx="64"
          cy="64"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          className="stroke-muted"
        />
        <circle
          cx="64"
          cy="64"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={
            CIRCUMFERENCE * (1 - Math.min(Math.max(ratio, 0), 1))
          }
          // Amber past the target, not red: going over is worth noticing and
          // is not a fault, and red is what this app says when something
          // actually broke. See the same reasoning in `MacroProgress`.
          //
          // 250 ms porque isto é **atualização de valor**, que é o tempo que a
          // pág. 37 dá a ela. Os 900 ms da mesma tabela são do anel *crescendo
          // do zero* na chegada à tela, que é outro momento — e um dia inteiro
          // de registro faz esta transição disparar dezenas de vezes.
          className={cn(
            "transition-[stroke-dashoffset] duration-(--duration-standard) ease-out",
            over ? "stroke-warning" : "stroke-accent",
          )}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p
          className={cn(
            "text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl",
            over ? "text-warning" : "text-ink",
          )}
        >
          {formatDecimal(Math.abs(remaining))}
        </p>
        {/* "Restantes" implies something was eaten. On an empty day nothing
            was, and the same 2.067 is the budget rather than a remainder —
            the honest caption for the same true number. */}
        <p className="mt-1 max-w-24 text-xs leading-tight text-ink-subtle">
          {over
            ? "kcal acima da meta"
            : nothingYet
              ? "kcal para hoje"
              : "kcal restantes"}
        </p>
      </div>
    </div>
  );
}
