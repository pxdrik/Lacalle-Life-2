import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/design-system/components/button";
import { Dialog } from "@/design-system/components/dialog";
import { Field } from "@/design-system/components/field";
import { Input } from "@/design-system/components/input";

import type { CreatedInvite } from "../../types/care";

/**
 * Convidar paciente (protótipo aprovado em 30/09/2026): o painel gera um link
 * que a nutricionista envia como quiser. O app ainda não manda e-mail
 * próprio. O código só aparece aqui, uma vez: o banco guarda o hash dele.
 */
export function InviteDialog({
  onClose,
  onCreate,
}: {
  readonly onClose: () => void;
  readonly onCreate: (label: string) => Promise<CreatedInvite>;
}) {
  const [label, setLabel] = useState("");
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const url = created === null ? "" : `${window.location.origin}/convite/${created.token}`;

  return (
    <Dialog
      open
      title={created === null ? "Convidar paciente" : `Link para ${label.trim()}`}
      onClose={onClose}
      placement="sheet-bottom"
    >
      {created === null ? (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (label.trim() === "") {
              setError("Escreva o nome do paciente.");
              return;
            }
            setPending(true);
            setError(null);
            onCreate(label.trim())
              .then(setCreated)
              .catch(() => {
                setError("Não foi possível gerar o link. Confira a conexão e tente de novo.");
              })
              .finally(() => {
                setPending(false);
              });
          }}
        >
          <p className="text-sm text-ink-muted">
            Você gera um link e envia como preferir. O paciente entra com a própria conta do LaCalle Life e aceita.
            Você não cria senha nem vê credenciais.
          </p>
          <Field
            label="Nome do paciente"
            id="invite-label"
            error={error ?? undefined}
            hint="Só para você reconhecer o convite e o paciente na sua lista."
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                maxLength={120}
                value={label}
                onChange={(event) => {
                  setLabel(event.target.value);
                }}
              />
            )}
          </Field>
          <Button type="submit" pending={pending} className="w-full">
            Gerar link
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 rounded-md bg-muted px-3 py-2.5 text-sm break-all text-ink select-all">
              {url}
            </code>
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(url)
                  .then(() => {
                    setCopied(true);
                  })
                  .catch(() => undefined);
              }}
            >
              {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>Vale por 7 dias, para uma pessoa só.</li>
            <li>Envie por WhatsApp, e-mail ou como preferir.</li>
            <li>Até o paciente aceitar, ele aparece em Pacientes como convite esperando. Dá para cancelar lá.</li>
          </ul>
          <Button className="w-full" onClick={onClose}>
            Pronto
          </Button>
        </div>
      )}
    </Dialog>
  );
}
