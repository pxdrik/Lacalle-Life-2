import { useState } from "react";

import { Button } from "@/design-system/components/button";
import { Dialog } from "@/design-system/components/dialog";
import { Field } from "@/design-system/components/field";
import { Input } from "@/design-system/components/input";
import { Select } from "@/design-system/components/select";

import { COUNCIL_REGIONS, type ProfessionalRequestInput } from "../types/professional";

/**
 * O pedido de acesso ao Life Pro (protótipo aprovado em 30/09/2026). Só
 * nutricionista nesta versão; o resto do pedido é o que a LaCalle precisa
 * para conferir o registro no conselho.
 */
export function RequestAccessDialog({
  open,
  initial,
  onClose,
  onSubmit,
}: {
  readonly open: boolean;
  /** Na recusa, o formulário volta com o que a pessoa tinha mandado. */
  readonly initial: ProfessionalRequestInput | null;
  readonly onClose: () => void;
  readonly onSubmit: (input: ProfessionalRequestInput) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.displayName ?? "");
  const [region, setRegion] = useState(initial?.councilRegion ?? "");
  const [number, setNumber] = useState(initial?.councilNumber ?? "");
  const [declared, setDeclared] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<"name" | "region" | "number" | "send", string>>>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const digits = number.replace(/\D/g, "");
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = "Escreva o nome como está no registro do conselho.";
    if (region === "") next.region = "Escolha a região do seu CRN.";
    if (digits.length === 0 || digits.length > 8) next.number = "Use só os números do registro.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPending(true);
    try {
      await onSubmit({ displayName: name.trim(), councilRegion: region, councilNumber: digits });
      onClose();
    } catch {
      setErrors({ send: "Não foi possível enviar o pedido. Confira a conexão e tente de novo." });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} title="Pedir acesso ao Life Pro" onClose={onClose} placement="sheet-bottom">
      <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
        <p className="text-sm text-ink-muted">
          Com o Life Pro você monta planos e acompanha pacientes, usando esta mesma conta. A LaCalle confere o
          registro no conselho antes de liberar.
        </p>

        <Field label="Profissão" id="pro-profession" hint="Educador físico entra depois, com as fichas de treino.">
          {({ id, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} value="nutritionist" disabled>
              <option value="nutritionist">Nutricionista</option>
            </Select>
          )}
        </Field>

        <Field label="Nome profissional" id="pro-name" error={errors.name}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              autoComplete="name"
              maxLength={120}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          )}
        </Field>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,8rem)] gap-3">
          <Field label="Número do CRN" id="pro-number" error={errors.number}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                inputMode="numeric"
                maxLength={12}
                value={number}
                onChange={(event) => {
                  setNumber(event.target.value);
                }}
              />
            )}
          </Field>
          <Field label="Região" id="pro-region" error={errors.region}>
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                value={region}
                onChange={(event) => {
                  setRegion(event.target.value);
                }}
              >
                <option value="" disabled>
                  Escolha
                </option>
                {COUNCIL_REGIONS.map((council) => (
                  <option key={council} value={council}>
                    {council}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <label className="flex items-start gap-3 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={declared}
            onChange={(event) => {
              setDeclared(event.target.checked);
            }}
            className="mt-0.5 size-5 shrink-0 accent-(--accent)"
          />
          <span>Os dados acima são meus e estão corretos.</span>
        </label>

        {errors.send !== undefined && (
          <p role="alert" className="text-sm text-danger-text">
            {errors.send}
          </p>
        )}

        <Button type="submit" pending={pending} disabled={!declared} className="w-full">
          Enviar pedido
        </Button>
      </form>
    </Dialog>
  );
}
