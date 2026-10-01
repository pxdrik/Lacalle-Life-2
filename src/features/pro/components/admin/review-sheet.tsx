import { Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/design-system/components/button";
import { Dialog } from "@/design-system/components/dialog";

import {
  REJECTION_REASON_LABELS,
  REJECTION_REASON_MESSAGES,
  REJECTION_REASONS,
  type ProfessionalRecord,
  type RejectionReason,
} from "../../types/professional";
import { formatWhen } from "./format";

/**
 * Conferir um pedido (protótipo aprovado em 01/10/2026): os dados, o número
 * para procurar no site do conselho, e a confirmação. **Aprovar só liga
 * depois da marcação "o registro existe, está ativo e o nome confere"**, para
 * ninguém ser aprovado sem conferência. Recusar pede o motivo e mostra o
 * texto que a pessoa vai ler.
 */
export function ReviewSheet({
  record,
  onClose,
  onApprove,
  onReject,
}: {
  readonly record: ProfessionalRecord;
  readonly onClose: () => void;
  readonly onApprove: () => Promise<void>;
  readonly onReject: (reason: RejectionReason) => Promise<void>;
}) {
  const [checked, setChecked] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<RejectionReason>("council_not_found");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function run(action: () => Promise<void>) {
    setPending(true);
    setFailed(false);
    try {
      await action();
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  const failure = failed && (
    <p role="alert" className="text-sm text-danger-text">
      Não foi possível salvar a decisão. Confira a conexão e tente de novo.
    </p>
  );

  if (rejecting) {
    return (
      <Dialog open title={`Recusar o pedido de ${record.displayName}`} onClose={onClose} placement="sheet-bottom">
        <div className="space-y-4">
          <fieldset className="space-y-1">
            <legend className="mb-2 text-sm font-medium text-ink">Motivo</legend>
            {REJECTION_REASONS.map((option) => (
              <label
                key={option}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm text-ink hover:bg-muted"
              >
                <input
                  type="radio"
                  name="reason"
                  value={option}
                  checked={reason === option}
                  onChange={() => {
                    setReason(option);
                  }}
                  className="size-4 accent-(--accent)"
                />
                {REJECTION_REASON_LABELS[option]}
              </label>
            ))}
          </fieldset>
          <div className="rounded-r-md border-l-2 border-line-strong bg-muted px-3 py-2 text-sm text-ink-muted">
            <p className="text-[0.6875rem] font-semibold tracking-wide text-ink-subtle uppercase">
              A pessoa vai ler no Perfil
            </p>
            <p className="mt-1">{REJECTION_REASON_MESSAGES[reason]}</p>
          </div>
          {failure}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setRejecting(false);
              }}
            >
              Voltar
            </Button>
            <Button variant="danger" pending={pending} onClick={() => void run(() => onReject(reason))}>
              Recusar pedido
            </Button>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open title={`Pedido de ${record.displayName}`} onClose={onClose} placement="sheet-bottom">
      <div className="space-y-4">
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
          <dt className="text-ink-subtle">Profissão</dt>
          <dd className="font-medium text-ink">Nutricionista</dd>
          <dt className="text-ink-subtle">Registro</dt>
          <dd className="font-medium text-ink tabular-nums">
            {record.councilRegion} · {record.councilNumber}
          </dd>
          <dt className="text-ink-subtle">Conta</dt>
          <dd className="font-medium break-all text-ink">{record.email}</dd>
          <dt className="text-ink-subtle">Pedido em</dt>
          <dd className="font-medium text-ink tabular-nums">{formatWhen(record.requestedAt)}</dd>
        </dl>

        <section className="space-y-2 rounded-lg border border-line p-4">
          <h3 className="text-sm font-semibold text-ink">1. Confira no conselho</h3>
          <p className="text-sm text-ink-muted">
            Procure o número no site do {record.councilRegion}, na consulta de profissionais inscritos.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-muted px-3 py-2 font-semibold text-ink tabular-nums select-all">
              {record.councilNumber}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                // Copiar pode ser recusado (permissão, navegador antigo); o
                // número continua selecionável ao lado.
                navigator.clipboard
                  ?.writeText(record.councilNumber)
                  .then(() => {
                    setCopied(true);
                  })
                  .catch(() => undefined);
              }}
            >
              <Copy aria-hidden className="size-4" />
              {copied ? "Copiado" : "Copiar número"}
            </Button>
          </div>
        </section>

        <section className="space-y-2 rounded-lg border border-line p-4">
          <h3 className="text-sm font-semibold text-ink">2. Confirme</h3>
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => {
                setChecked(event.target.checked);
              }}
              className="mt-0.5 size-5 shrink-0 accent-(--accent)"
            />
            <span>O registro existe, está ativo e o nome confere com o do pedido.</span>
          </label>
        </section>

        {failure}

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setRejecting(true);
            }}
          >
            Recusar
          </Button>
          <Button disabled={!checked} pending={pending} onClick={() => void run(onApprove)}>
            Aprovar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
