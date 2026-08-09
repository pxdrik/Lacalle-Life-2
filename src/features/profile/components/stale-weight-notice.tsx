"use client";

import { formatDay } from "@/core/format/day";
import { formatDecimal } from "@/core/format/decimal";
import type { NutritionProfile } from "@/core/nutrition";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { useLatestWeighIn } from "@/features/body";

/**
 * How far the two numbers have to drift before it is worth interrupting.
 *
 * A kilo. Below that it is the scale and the hour of day talking — body weight
 * swings that much between morning and evening — and a prompt that fires on
 * noise gets dismissed without being read, which is how a real one gets missed
 * later.
 */
const WORTH_MENTIONING_KG = 1;

interface Props {
  readonly profile: NutritionProfile;
  readonly onApply: (weightKg: number) => void;
  readonly pending: boolean;
}

/**
 * Says when the profile has gone stale, and offers to fix it.
 *
 * The body log and the profile are independent on purpose: the profile's
 * weight is an **input** to the calorie target, and the log is the **history**.
 * Syncing them would make the history quietly rewrite the plan, and a weight
 * recorded on a bad morning would move somebody's calories without them asking.
 *
 * So this offers rather than acts. What it prevents is the silent case: a
 * profile left at 84 kg while the scale has been saying 80 for a month is not
 * a wrong number on a screen, it is a calorie target that has been wrong every
 * day since, with nothing anywhere saying so.
 */
export function StaleWeightNotice({ profile, onApply, pending }: Props) {
  const latest = useLatestWeighIn();

  if (latest === null) return null;

  const difference = latest.weightKg - profile.weightKg;
  if (Math.abs(difference) < WORTH_MENTIONING_KG) return null;

  return (
    <Card as="section" className="border-accent/40">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-ink">
            Sua meta usa{" "}
            <strong className="font-mono tabular-nums">
              {formatDecimal(profile.weightKg)} kg
            </strong>
            , mas sua última pesagem, de {formatDay(latest.day)}, diz{" "}
            <strong className="font-mono tabular-nums">
              {formatDecimal(latest.weightKg)} kg
            </strong>
            .
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {difference < 0 ? "Você perdeu" : "Você ganhou"}{" "}
            {formatDecimal(Math.abs(difference))} kg desde então — atualizar
            recalcula suas metas.
          </p>
        </div>

        <Button
          size="sm"
          pending={pending}
          onClick={() => {
            onApply(latest.weightKg);
          }}
        >
          Usar {formatDecimal(latest.weightKg)} kg
        </Button>
      </div>
    </Card>
  );
}
