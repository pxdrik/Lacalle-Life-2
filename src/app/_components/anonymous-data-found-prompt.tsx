"use client";

import { useEffect, useState } from "react";

import {
  anonymousDataExists,
  currentIdentityHasData,
} from "@/composition/backup";
import { getCurrentIdentity } from "@/composition/identity";
import { migrateAnonymousDataToCurrentIdentity } from "@/composition/migrate-anonymous-data";
import { isSupabaseConfigured } from "@/core/auth/env";
import { Button } from "@/design-system/components/button";
import { Dialog } from "@/design-system/components/dialog";
import { Notice } from "@/design-system/components/notice";

function offeredKey(uid: string): string {
  return `lacalle-life.migration-offered.${uid}`;
}

function alreadyOffered(uid: string): boolean {
  try {
    return window.localStorage.getItem(offeredKey(uid)) === "1";
  } catch {
    return false;
  }
}

function markOffered(uid: string): void {
  try {
    window.localStorage.setItem(offeredKey(uid), "1");
  } catch {
    // Sem armazenamento disponível: o diálogo pode aparecer de novo na
    // próxima visita, o que é inofensivo — só repete a pergunta.
  }
}

/**
 * "Encontramos dados salvos neste dispositivo" — Fase 3 da correção de
 * isolamento de identidade. Só aparece quando as duas coisas são
 * verdadeiras ao mesmo tempo: a conta que acabou de logar nunca teve dados
 * próprios neste aparelho, e o banco anônimo (`lacalle-life`) tem algo que
 * uma pessoa realmente registrou.
 *
 * Montado perto da raiz do app (`RootLayout`, ramo autenticado), mesmo
 * lugar que `LandingRedirect` ocupa na Landing Page — não bloqueia a
 * primeira renderização, só decide depois de montado.
 */
export function AnonymousDataFoundPrompt() {
  const [uid, setUid] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let active = true;

    void (async () => {
      const identity = await getCurrentIdentity();
      if (!active || identity.kind !== "authenticated") return;
      if (alreadyOffered(identity.uid)) return;

      const [hasOwnData, hasAnonymousData] = await Promise.all([
        currentIdentityHasData(),
        anonymousDataExists(),
      ]);
      if (!active) return;

      if (hasOwnData || !hasAnonymousData) {
        markOffered(identity.uid);
        return;
      }

      setUid(identity.uid);
      setOpen(true);
    })();

    return () => {
      active = false;
    };
  }, []);

  function dismiss() {
    if (uid !== null) markOffered(uid);
    setOpen(false);
  }

  async function handleAdd() {
    setPending(true);
    setError(null);

    try {
      const result = await migrateAnonymousDataToCurrentIdentity();
      if (!result.ok) {
        setError("Não foi possível ler os dados deste dispositivo.");
        setPending(false);
        return;
      }

      if (uid !== null) markOffered(uid);
      // Recarrega para toda tela reler o IndexedDB — as mesmas telas já
      // montadas não voltam a buscar dados sozinhas só porque o banco
      // mudou por baixo.
      window.location.reload();
    } catch {
      setError("Não foi possível adicionar os dados à sua conta.");
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      title="Encontramos dados salvos neste dispositivo"
      onClose={dismiss}
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          Você já tem informações salvas aqui, de antes de entrar nesta
          conta. Quer adicioná-las à sua conta?
        </p>

        {error !== null && <Notice>{error}</Notice>}

        <div className="flex flex-wrap gap-2">
          <Button pending={pending} onClick={() => void handleAdd()}>
            Adicionar meus dados
          </Button>
          <Button variant="secondary" disabled={pending} onClick={dismiss}>
            Começar do zero
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
