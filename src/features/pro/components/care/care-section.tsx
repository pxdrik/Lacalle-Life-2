"use client";

import { useEffect, useState } from "react";

import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { ConfirmButton } from "@/design-system/components/confirm-button";
import { Dialog } from "@/design-system/components/dialog";
import { Section } from "@/design-system/components/section";

import { useCareRepository } from "../../data/care-repository-context";
import { describeSharing, type MyCareLink, type Sharing } from "../../types/care";
import { SharingOptions } from "./sharing-options";

const DATE = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * "Acompanhamento" no Perfil (protótipo aprovado em 30/09/2026): quem
 * acompanha, o que vê, mudar o que vê e encerrar. Só aparece para quem tem ou
 * teve um vínculo. Encerrar pede um segundo toque, como os outros botões de
 * apagar do app, e não apaga nada.
 */
export function CareSection() {
  const care = useCareRepository();
  const [links, setLinks] = useState<readonly MyCareLink[] | null>(null);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<MyCareLink | null>(null);

  useEffect(() => {
    let active = true;
    care
      .listMyLinks()
      .then((list) => {
        if (active) setLinks(list);
      })
      .catch(() => {
        if (active) setLinks([]);
      });
    return () => {
      active = false;
    };
  }, [care, version]);

  const reload = () => {
    setVersion((current) => current + 1);
  };

  if (links === null || links.length === 0) return null;
  // O encerrado aparece até haver outro vínculo com a mesma profissional.
  const shown = links.filter(
    (link) =>
      link.status === "active" ||
      !links.some((other) => other.status === "active" && other.professionalName === link.professionalName),
  );

  return (
    <Section title="Acompanhamento">
      <div className="space-y-3">
        {shown.map((link) => (
          <Card key={link.linkId} className="space-y-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-ink-muted"
              >
                {link.professionalName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((word) => word[0])
                  .join("")}
              </span>
              <div className="min-w-0">
                <p className="font-medium break-words text-ink">{link.professionalName}</p>
                <p className="text-xs text-ink-subtle">
                  Nutricionista ·{" "}
                  {link.status === "active"
                    ? `desde ${DATE.format(new Date(link.createdAt))}`
                    : `encerrado em ${DATE.format(new Date(link.endedAt ?? link.createdAt))}`}
                </p>
              </div>
            </div>

            {link.status === "active" ? (
              <>
                <div>
                  <p className="text-xs text-ink-subtle">Ela vê</p>
                  <p className="text-sm text-ink">{describeSharing(link.sharing)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditing(link);
                    }}
                  >
                    Mudar o que ela vê
                  </Button>
                  <ConfirmButton
                    label={`Encerrar acompanhamento com ${link.professionalName}`}
                    confirmLabel="Encerrar mesmo?"
                    onConfirm={() => {
                      void care.endLink(link.linkId).then(reload);
                    }}
                    className="h-(--control-h-sm) px-3 text-[0.8125rem]"
                  >
                    Encerrar
                  </ConfirmButton>
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-muted">
                Ela não vê mais seu diário, sua evolução nem seu perfil. Nada foi apagado.
              </p>
            )}
          </Card>
        ))}
      </div>

      {editing !== null && (
        <SharingSheet
          key={editing.linkId}
          link={editing}
          onClose={() => {
            setEditing(null);
          }}
          onSave={async (sharing) => {
            await care.updateSharing(editing.linkId, sharing);
            reload();
          }}
        />
      )}
    </Section>
  );
}

function SharingSheet({
  link,
  onClose,
  onSave,
}: {
  readonly link: MyCareLink;
  readonly onClose: () => void;
  readonly onSave: (sharing: Sharing) => Promise<void>;
}) {
  const [sharing, setSharing] = useState(link.sharing);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <Dialog open title={`O que ${link.professionalName.split(" ")[0]} vê`} onClose={onClose} placement="sheet-bottom">
      <div className="space-y-4">
        <SharingOptions value={sharing} onChange={setSharing} idPrefix={`edit-share-${link.linkId}`} />
        {failed && (
          <p role="alert" className="text-sm text-danger-text">
            Não foi possível salvar. Confira a conexão e tente de novo.
          </p>
        )}
        <Button
          pending={pending}
          className="w-full"
          onClick={() => {
            setPending(true);
            setFailed(false);
            onSave(sharing)
              .then(onClose)
              .catch(() => {
                setFailed(true);
                setPending(false);
              });
          }}
        >
          Salvar
        </Button>
      </div>
    </Dialog>
  );
}
