import { Lock } from "lucide-react";

import { SHARING_OPTIONS, type Sharing } from "../../types/care";

/**
 * O que o paciente libera para quem o acompanha (protótipo aprovado em
 * 30/09/2026): diário, evolução e dados do perfil, cada um com a explicação,
 * e uma linha fixa dizendo o que sempre vai junto. Usada no aceite do convite
 * e em "Mudar o que ela vê" no Perfil.
 */
export function SharingOptions({
  value,
  onChange,
  idPrefix,
}: {
  readonly value: Sharing;
  readonly onChange: (next: Sharing) => void;
  readonly idPrefix: string;
}) {
  return (
    <div className="divide-y divide-line">
      {SHARING_OPTIONS.map((option) => {
        const id = `${idPrefix}-${option.key}`;
        return (
          <label key={option.key} htmlFor={id} className="flex cursor-pointer items-start gap-3 py-3">
            <input
              id={id}
              type="checkbox"
              checked={value[option.key]}
              onChange={(event) => {
                onChange({ ...value, [option.key]: event.target.checked });
              }}
              className="mt-0.5 size-5 shrink-0 accent-(--accent)"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{option.label}</span>
              <span className="block text-xs text-ink-subtle">{option.hint}</span>
            </span>
          </label>
        );
      })}
      <div className="flex items-start gap-3 py-3">
        <Lock aria-hidden className="mt-0.5 size-5 shrink-0 p-0.5 text-ink-subtle" />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink">O nome que ela deu ao convite</span>
          <span className="block text-xs text-ink-subtle">É assim que você aparece na lista dela. Seu e-mail não aparece.</span>
        </span>
      </div>
    </div>
  );
}
