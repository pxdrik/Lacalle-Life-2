"use client";

import { Check, Trash2 } from "lucide-react";
import { useState } from "react";

import { sumMacros } from "@/core/domain/macros";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { ConfirmButton } from "@/design-system/components/confirm-button";
import { Dialog } from "@/design-system/components/dialog";
import { Input } from "@/design-system/components/input";

import { itemMacros } from "../services/diet-macros";
import type { Meal, MealAlternative } from "../types/diet";
import { InlineText } from "./inline-text";
import { MacroSummary } from "./macro-summary";

interface Props {
  readonly meal: Meal;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onApply: (alternativeId: string) => void;
  readonly onSave: (name: string) => void;
  readonly onRename: (alternativeId: string, name: string) => void;
  readonly onRemove: (alternativeId: string) => void;
}

/**
 * A marmita's rice version beside its pasta version — saved suggestions for
 * one meal, so switching what today's plate actually is costs one tap
 * instead of re-adding every food by hand.
 *
 * Building the library and picking from it share one sheet: there is nothing
 * to switch to until at least one suggestion has been saved, so the empty
 * state and the save form have to be visible together, not behind a second
 * screen.
 */
export function MealAlternativesDialog({
  meal,
  open,
  onClose,
  onApply,
  onSave,
  onRename,
  onRemove,
}: Props) {
  const [name, setName] = useState("");
  const alternatives = meal.alternatives ?? [];

  return (
    <Dialog
      open={open}
      title={`Outras sugestões para ${meal.name}`}
      onClose={onClose}
      placement="sheet-bottom"
    >
      <div className="space-y-4">
        {alternatives.length === 0 ? (
          <p className="text-sm text-ink-subtle">
            Nenhuma sugestão salva ainda. Monte a refeição do jeito que você
            vai comer e salve abaixo — da próxima vez é só escolher, sem
            editar alimento por alimento.
          </p>
        ) : (
          <ul className="space-y-2">
            {alternatives.map((alternative) => (
              <AlternativeRow
                key={alternative.id}
                alternative={alternative}
                onApply={() => {
                  onApply(alternative.id);
                }}
                onRename={(next) => {
                  onRename(alternative.id, next);
                }}
                onRemove={() => {
                  onRemove(alternative.id);
                }}
              />
            ))}
          </ul>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim() === "") return;
            onSave(name);
            setName("");
          }}
          className="flex gap-2 border-t border-line pt-4"
        >
          <Input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            placeholder="Nome da sugestão, ex.: Marmita de arroz"
            aria-label="Nome da nova sugestão"
            autoComplete="off"
          />
          <Button
            type="submit"
            size="sm"
            className="h-(--input-h) shrink-0"
            disabled={name.trim() === "" || meal.items.length === 0}
          >
            Salvar atual
          </Button>
        </form>
      </div>
    </Dialog>
  );
}

function AlternativeRow({
  alternative,
  onApply,
  onRename,
  onRemove,
}: {
  readonly alternative: MealAlternative;
  readonly onApply: () => void;
  readonly onRename: (name: string) => void;
  readonly onRemove: () => void;
}) {
  const macros = sumMacros(alternative.items.map(itemMacros));

  return (
    <Card as="li" padded className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <InlineText
          value={alternative.name}
          onChange={onRename}
          label={`Nome da sugestão ${alternative.name}`}
          className="min-w-0 flex-1 font-medium"
        />
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={onApply}
          >
            <Check aria-hidden className="size-4" />
            Usar
          </Button>
          <ConfirmButton
            onConfirm={onRemove}
            label={`Excluir sugestão ${alternative.name}`}
            confirmLabel="Excluir?"
            className="h-8 min-w-8"
          >
            <Trash2 aria-hidden className="size-4" />
          </ConfirmButton>
        </div>
      </div>

      <p className="truncate text-xs text-ink-subtle">
        {alternative.items.map((item) => item.name).join(", ")}
      </p>

      <MacroSummary macros={macros} />
    </Card>
  );
}
