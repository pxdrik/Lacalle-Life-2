"use client";

import Link from "next/link";

import { formatDecimal } from "@/core/format/decimal";
import { FIBER_REFERENCE_G } from "@/core/nutrition";
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
    <Card as="section" tone="hero" className="min-w-0 lg:col-span-2">
      {/* 06/09/2026 — o anel deixou de ser o centro visual sozinho da tela
          (ver `CalorieRing`); o hero inteiro encolheu para caber ao lado do
          registro de entradas, que passou a ser o bloco dominante da Home. */}
      <CalorieRing
        consumed={totals.kcal}
        target={targets.kcal}
        nothingYet={nothingYet}
      />

      {/* Secondary by construction, not just by convention: smaller size,
          past a rule, read only after the ring resolves. Three columns —
          never `MacroProgress`'s bars — because a bar argues for attention
          the same way the ring does, and this block exists to not do that. */}
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
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
          />
        ))}
      </div>

      {/* Sem "consumido" ao lado — nenhum alimento do catálogo carrega
          fibra, então mostrar um número aqui seria sempre "0 g", que
          parece dado real quando é só ausência de dado (na dúvida,
          omitir). É uma linha de texto, não um `Metric` como os três
          acima, de propósito: os três rastreiam o que foi comido contra
          uma meta calculada do perfil; isto é só um valor fixo do
          produto, igual para qualquer perfil.
          Texto sem "meta de referência" nem qualquer explicação — só o
          número (Pedro, 27/08/2026): a apresentação enxuta já basta, e
          nunca é uma recomendação médica personalizada nem comparada a
          nada. */}
      <p className="mt-2 text-xs text-ink-subtle">
        Fibra · {FIBER_REFERENCE_G} g/dia
      </p>
    </Card>
  );
}

/**
 * Half-turn, not a full one — and small enough to sit beside the number
 * instead of holding the number inside it.
 *
 * **06/09/2026, decisão de produto (Pedro), depois de comparar em mockup
 * contra a versão anterior (anel completo, 176px, número dentro).** O anel
 * cheio é a forma mais reconhecível de qualquer app de saúde — a pág. 48 do
 * brandbook já listava "anel de progresso circular tipo Apple Watch" como
 * clichê a evitar por padrão, e esta tela era a única exceção viva a essa
 * regra. O motivo documentado aqui antes (arco > barra, tamanho grande de
 * propósito) continua válido como argumento — só perdeu a votação contra o
 * pedido explícito de reduzir a leitura de "template de fitness genérico".
 *
 * Um semicírculo com marcações de escala em vez de um giro completo: o
 * `path` substitui o `circle`, e a leitura passa a ser "instrumento com
 * régua", não "relógio de bem-estar". O comprimento do arco (πr) faz o
 * mesmo papel que a circunferência fazia no `strokeDasharray`/`offset`.
 */
const GAUGE_RADIUS = 50;
const GAUGE_ARC_LENGTH = Math.PI * GAUGE_RADIUS;
const GAUGE_PATH = "M10 65 A50 50 0 0 1 110 65";

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
    <div className="flex shrink-0 items-center gap-4">
      {/* O degradê continua fora — pág. 46 do brandbook, "gradiente é recurso
          de superfície, nunca de identidade", e a lista onde ele é proibido
          nomeia barras de progresso (um arco é uma barra curvada) junto com
          botões, inputs e séries de gráfico. */}
      <svg
        aria-hidden
        viewBox="0 0 120 70"
        className="h-11 w-19 shrink-0"
        role="presentation"
      >
        {/* Trilho contínuo em todo estado — nunca tracejado num dia vazio.
            Um dia sem nada registrado não é um dia quebrado; ver o motivo
            completo na versão anterior deste comentário, preservada no
            histórico do git. */}
        <path
          d={GAUGE_PATH}
          fill="none"
          strokeWidth="9"
          className="stroke-muted"
        />
        <path
          d={GAUGE_PATH}
          fill="none"
          strokeWidth="9"
          strokeDasharray={GAUGE_ARC_LENGTH}
          strokeDashoffset={
            GAUGE_ARC_LENGTH * (1 - Math.min(Math.max(ratio, 0), 1))
          }
          className={cn(
            "transition-[stroke-dashoffset] duration-(--duration-standard) ease-out",
            over ? "stroke-warning" : "stroke-accent",
          )}
        />
        {/* Marcações de escala — início, meta (50%), fim — o traço que faz o
            arco ler como instrumento de medição em vez de anel decorativo. */}
        <g strokeWidth="2" className="stroke-ink-subtle">
          <line x1="10" y1="65" x2="15.5" y2="56.5" />
          <line x1="60" y1="15" x2="60" y2="23" />
          <line x1="110" y1="65" x2="104.5" y2="56.5" />
        </g>
      </svg>

      <div className="min-w-0">
        <p
          className={cn(
            "text-2xl font-semibold tracking-tight tabular-nums",
            over ? "text-warning" : "text-ink",
          )}
        >
          {formatDecimal(Math.abs(remaining))}
        </p>
        {/* "Restantes" implies something was eaten. On an empty day nothing
            was, and the same 2.067 is the budget rather than a remainder —
            the honest caption for the same true number. */}
        <p className="text-xs leading-tight text-ink-subtle">
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
