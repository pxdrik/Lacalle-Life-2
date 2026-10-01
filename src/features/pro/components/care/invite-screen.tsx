"use client";

import { Check, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button, buttonClasses } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { PageHeader } from "@/design-system/components/page-header";
import { Skeleton } from "@/design-system/components/skeleton";

import { useCareRepository } from "../../data/care-repository-context";
import { useProRepository } from "../../data/pro-repository-context";
import type { InviteInfo, Sharing } from "../../types/care";
import { SharingOptions } from "./sharing-options";

type Screen =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly invite: InviteInfo; readonly signedIn: boolean }
  | { readonly status: "accepted"; readonly name: string };

/**
 * A página do convite (protótipo aprovado em 30/09/2026). Quem abre vê quem
 * convidou e escolhe o que libera; aceitar exige conta, porque o vínculo mora
 * no servidor. Sem conta, entrar ou criar conta volta para cá.
 *
 * As três opções já vêm marcadas, como no protótipo: a pessoa desmarca o que
 * não quiser. Recusar não grava nada; é só não aceitar.
 */
export function InviteScreen({ token }: { readonly token: string }) {
  const care = useCareRepository();
  const pro = useProRepository();
  const [screen, setScreen] = useState<Screen>({ status: "loading" });
  const [sharing, setSharing] = useState<Sharing>({ diary: true, body: true, profile: true });
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([care.getInvite(token), pro.getMyAccess()])
      .then(([invite, access]) => {
        if (active) setScreen({ status: "ready", invite, signedIn: access !== null });
      })
      .catch(() => {
        if (active) {
          setScreen({
            status: "ready",
            invite: { state: "invalid", professionalName: null, council: null, isOwn: false },
            signedIn: false,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [care, pro, token]);

  // "Convite" no título e o resto embaixo: "acompanhamento" sozinho é mais
  // largo que a coluna do título em 320px Confortável e empurrava a página
  // 20px para o lado (medido).
  const header = <PageHeader icon={Users} title="Convite" subtitle="Acompanhamento pelo LaCalle Life." />;

  if (screen.status === "loading") {
    return (
      <>
        {header}
        <div className="mt-8 space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-40" />
        </div>
      </>
    );
  }

  if (screen.status === "accepted") {
    return (
      <>
        {header}
        <Card className="mt-8 flex flex-col items-center gap-3 py-10 text-center">
          <Check aria-hidden className="size-8 text-accent-text" />
          <p className="text-lg font-medium text-ink">{screen.name} agora acompanha você.</p>
          <p className="max-w-sm text-sm text-ink-muted">
            Quando ela publicar seu plano, ele aparece em Dietas, separado das suas dietas. Para mudar o que ela vê ou
            encerrar, vá em Perfil.
          </p>
          <Link href="/perfil" className={buttonClasses("secondary", "sm")}>
            Ir para o Perfil
          </Link>
        </Card>
      </>
    );
  }

  const { invite, signedIn } = screen;
  const name = invite.professionalName ?? "A profissional";
  const next = `/convite/${token}`;

  if (invite.state !== "valid") {
    const message = {
      used: "Este convite já foi usado. Se precisar, peça um novo à profissional.",
      expired: "Este convite venceu. Peça um novo à profissional: cada link vale por 7 dias.",
      invalid: "Este convite não vale. Confira se o link está completo, ou peça um novo à profissional.",
    }[invite.state];
    return (
      <>
        {header}
        <Card className="mt-8 space-y-3">
          <p className="text-ink">{message}</p>
          <Link href="/hoje" className={buttonClasses("secondary", "sm")}>
            Ir para o app
          </Link>
        </Card>
      </>
    );
  }

  const who = (
    <Card className="space-y-3">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-ink-muted">
          {name
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word[0])
            .join("")}
        </span>
        <div className="min-w-0">
          <p className="font-medium break-words text-ink">{name}</p>
          <p className="text-xs text-ink-subtle">Treinador · {invite.council}</p>
        </div>
      </div>
      <p className="text-sm text-ink-muted">
        {name.split(" ")[0]} quer acompanhar você pelo LaCalle Life e montar seu plano alimentar e seu treino.
      </p>
    </Card>
  );

  if (invite.isOwn) {
    return (
      <>
        {header}
        <div className="mt-8 space-y-4">
          {who}
          <p className="text-sm text-ink-muted">Este é o seu convite. Envie o link para o paciente aceitar.</p>
        </div>
      </>
    );
  }

  if (!signedIn) {
    return (
      <>
        {header}
        <div className="mt-8 space-y-4">
          {who}
          <Card className="space-y-3">
            <p className="font-medium text-ink">Para aceitar, entre na sua conta.</p>
            <p className="text-sm text-ink-muted">
              O acompanhamento fica na sua conta, não neste aparelho. Depois de entrar, você volta para este convite.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={{ pathname: "/entrar", query: { next } }} className={buttonClasses("primary", "sm")}>
                Entrar
              </Link>
              <Link href={{ pathname: "/cadastro", query: { next } }} className={buttonClasses("secondary", "sm")}>
                Criar conta
              </Link>
            </div>
          </Card>
        </div>
      </>
    );
  }

  async function accept() {
    setPending(true);
    setFailed(false);
    try {
      await care.acceptInvite(token, sharing);
      setScreen({ status: "accepted", name });
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <>
      {header}
      <div className="mt-8 space-y-4">
        {who}
        <section>
          <h2 className="mb-2 text-xs font-medium tracking-wide text-ink-subtle uppercase">O que ela vai ver</h2>
          <Card padded={false} className="px-4">
            <SharingOptions value={sharing} onChange={setSharing} idPrefix="invite-share" />
          </Card>
          <p className="mt-2 px-1 text-xs text-ink-subtle">
            Treinos e senha ficam só com você. Dá para mudar isso ou encerrar quando quiser, em Perfil.
          </p>
        </section>
        {failed && (
          <p role="alert" className="text-sm text-danger-text">
            Não foi possível aceitar agora. Confira a conexão e tente de novo.
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Button pending={pending} onClick={() => void accept()} className="w-full">
            Aceitar
          </Button>
          <Link href="/hoje" className={buttonClasses("ghost")}>
            Agora não
          </Link>
        </div>
      </div>
    </>
  );
}
