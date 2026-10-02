import { useState } from "react";

import { Button } from "@/design-system/components/button";
import { Dialog } from "@/design-system/components/dialog";
import { Field } from "@/design-system/components/field";
import { Input } from "@/design-system/components/input";
import { Select } from "@/design-system/components/select";

import { CREF_REGIONS, CRN_REGIONS, type ProfessionalRequestInput } from "../types/professional";

type ErrorKey = "name" | "councils" | "crnNumber" | "crnRegion" | "crefNumber" | "crefRegion" | "send";

/** "012345-G", "012345g" ou "012345 G" viram "012345-G"; o resto, `null`. */
export function normalizeCref(value: string): string | null {
  const match = /^(\d{6})\s*-?\s*([GP])$/.exec(value.trim().toUpperCase());
  return match === null ? null : `${match[1]!}-${match[2]!}`;
}

/**
 * O pedido de acesso ao Life Pro (protótipo aprovado em 30/09/2026; os dois
 * registros, 01/10/2026). A profissão é uma só, treinador, que monta dieta e
 * treino. O pedido guarda o CREF e o CRN, cada um opcional, pelo menos um: é
 * o que a LaCalle precisa para conferir cada registro no conselho dele.
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
  const crn0 = initial?.registrations.crn ?? null;
  const cref0 = initial?.registrations.cref ?? null;
  const [name, setName] = useState(initial?.displayName ?? "");
  const [hasCref, setHasCref] = useState(initial === null || cref0 !== null);
  const [crefNumber, setCrefNumber] = useState(cref0?.number ?? "");
  const [crefRegion, setCrefRegion] = useState(cref0?.region ?? "");
  const [hasCrn, setHasCrn] = useState(crn0 !== null);
  const [crnNumber, setCrnNumber] = useState(crn0?.number ?? "");
  const [crnRegion, setCrnRegion] = useState(crn0?.region ?? "");
  const [declared, setDeclared] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<ErrorKey, string>>>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const crnDigits = crnNumber.replace(/\D/g, "");
    const cref = normalizeCref(crefNumber);
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = "Escreva o nome como está no registro do conselho.";
    if (!hasCref && !hasCrn) next.councils = "Marque pelo menos um registro.";
    if (hasCref && cref === null) next.crefNumber = "Use os 6 números e a letra, como na carteira: 012345-G.";
    if (hasCref && crefRegion === "") next.crefRegion = "Escolha a UF do seu CREF.";
    if (hasCrn && (crnDigits.length === 0 || crnDigits.length > 8)) next.crnNumber = "Use só os números do registro.";
    if (hasCrn && crnRegion === "") next.crnRegion = "Escolha a região do seu CRN.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPending(true);
    try {
      await onSubmit({
        displayName: name.trim(),
        registrations: {
          crn: hasCrn ? { region: crnRegion, number: crnDigits } : null,
          cref: hasCref && cref !== null ? { number: cref, region: crefRegion } : null,
        },
      });
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
          Com o Life Pro você monta plano alimentar e treino para os seus pacientes, usando esta mesma conta. A
          LaCalle confere cada registro no conselho antes de liberar.
        </p>

        <Field label="Profissão" id="pro-profession">
          {({ id, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} value="trainer" disabled>
              <option value="trainer">Treinador</option>
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

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-ink">Seus registros</legend>
          <p className="text-xs text-ink-subtle">Marque os que você tem. Pelo menos um.</p>

          <Registration id="pro-cref" label="Tenho CREF" hint="Conselho de Educação Física" checked={hasCref} onCheck={setHasCref}>
            <Field label="Número do CREF" id="pro-cref-number" error={errors.crefNumber}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  placeholder="012345-G"
                  autoCapitalize="characters"
                  maxLength={10}
                  value={crefNumber}
                  onChange={(event) => {
                    setCrefNumber(event.target.value);
                  }}
                />
              )}
            </Field>
            <Field label="UF" id="pro-cref-region" error={errors.crefRegion}>
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  value={crefRegion}
                  onChange={(event) => {
                    setCrefRegion(event.target.value);
                  }}
                >
                  <option value="" disabled>
                    Escolha
                  </option>
                  {CREF_REGIONS.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </Registration>

          <Registration id="pro-crn" label="Tenho CRN" hint="Conselho de Nutricionistas" checked={hasCrn} onCheck={setHasCrn}>
            <Field label="Número do CRN" id="pro-crn-number" error={errors.crnNumber}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  inputMode="numeric"
                  maxLength={12}
                  value={crnNumber}
                  onChange={(event) => {
                    setCrnNumber(event.target.value);
                  }}
                />
              )}
            </Field>
            <Field label="Região" id="pro-crn-region" error={errors.crnRegion}>
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  value={crnRegion}
                  onChange={(event) => {
                    setCrnRegion(event.target.value);
                  }}
                >
                  <option value="" disabled>
                    Escolha
                  </option>
                  {CRN_REGIONS.map((council) => (
                    <option key={council} value={council}>
                      {council}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </Registration>

          {errors.councils !== undefined && (
            <p role="alert" className="text-sm text-danger-text">
              {errors.councils}
            </p>
          )}
        </fieldset>

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

/** Um registro: a caixa "Tenho ..." e, marcada, número e região lado a lado. */
function Registration({
  id,
  label,
  hint,
  checked,
  onCheck,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly checked: boolean;
  readonly onCheck: (checked: boolean) => void;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-line p-3">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => {
            onCheck(event.target.checked);
          }}
          className="mt-0.5 size-5 shrink-0 accent-(--accent)"
        />
        <span>
          <span className="block text-sm font-medium text-ink">{label}</span>
          <span className="block text-xs text-ink-subtle">{hint}</span>
        </span>
      </label>
      {/* Container query, não viewport: a densidade muda a largura útil, e a
          caixa com borda dentro da folha é mais estreita que a tela. Lado a
          lado quando cabe, um embaixo do outro quando não. */}
      {checked && (
        <div className="@container">
          <div className="grid gap-3 @[19rem]:grid-cols-[minmax(0,1fr)_minmax(0,7rem)]">{children}</div>
        </div>
      )}
    </div>
  );
}
