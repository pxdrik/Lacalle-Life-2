"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { Field } from "@/design-system/components/field";
import { Input } from "@/design-system/components/input";
import { useToast } from "@/design-system/components/toast";

import { NO_DRAFT } from "../../data/plan-repository";

/**
 * O fim do editor de um plano ou de um treino: o editor grava o rascunho
 * sozinho, a cada mudança, e o paciente só vê o que for publicado aqui.
 * Publicar cria uma versão nova; a anterior nunca muda (0035, 0038).
 */
export function PublishPanel({
  current,
  patientHref,
  onPublish,
}: {
  /** A versão que o paciente vê hoje; `0` quando nada foi publicado. */
  readonly current: number;
  readonly patientHref: Route;
  readonly onPublish: (changeNote: string) => Promise<number>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = current + 1;

  return (
    <Card className="mt-8 space-y-4">
      <div>
        <h2 className="font-semibold text-ink">Publicar para o paciente</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {current === 0
            ? "As mudanças ficam salvas como rascunho. O paciente só vê depois que você publicar."
            : `As mudanças ficam salvas como rascunho. O paciente continua vendo a versão ${String(current)} até você publicar.`}
        </p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setPending(true);
          setError(null);
          onPublish(note.trim())
            .then((version) => {
              toast(`Versão ${String(version)} publicada.`);
              router.push(patientHref);
            })
            .catch((reason: unknown) => {
              setPending(false);
              setError(
                reason instanceof Error && reason.message.includes(NO_DRAFT)
                  ? `Nada mudou desde a versão ${String(current)}.`
                  : "Não foi possível publicar. Confira a conexão e tente de novo.",
              );
            });
        }}
      >
        <Field
          label="O que mudou (opcional)"
          id="publish-change-note"
          error={error ?? undefined}
          hint="Aparece para o paciente junto com a versão nova."
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              maxLength={500}
              value={note}
              onChange={(event) => {
                setNote(event.target.value);
              }}
            />
          )}
        </Field>
        <Button type="submit" pending={pending} className="w-full sm:w-auto">
          Publicar versão {next}
        </Button>
      </form>
    </Card>
  );
}
