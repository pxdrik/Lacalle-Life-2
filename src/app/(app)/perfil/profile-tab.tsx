"use client";

import Link from "next/link";

import { ManualSyncButton } from "@/app/(app)/(auth)/conta/manual-sync-button";
import { Section } from "@/design-system/components/section";
import { AccountStatus } from "@/features/auth/components/account-status";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { ProAccessSections } from "@/features/pro/components/pro-access-sections";
import { ProfileScreen } from "@/features/profile/components/profile-screen";

import { LEGAL_LINKS } from "../../_components/legal/legal-links";

/**
 * A aba Perfil composta (roadmap 9.1, 30/09/2026). Mora em `app/` porque
 * junta duas features que não podem se importar: a conta (`features/auth`)
 * e o perfil (`features/profile`).
 *
 * Decide duas coisas que só quem enxerga as duas sabe: sem conta, a conta
 * vem antes de tudo; e "Sincronizar dados" só existe com conta, porque sem
 * ela não há para onde sincronizar.
 *
 * Com conta, "Área profissional" e "Administração" (Life Pro, Etapa 2) vêm
 * logo depois da conta: são dela, não do aparelho.
 */
export function ProfileTab() {
  const { state } = useAuth();
  const anonymous = state.status === "anonymous";

  return (
    <>
      <ProfileScreen
        accountFirst={anonymous}
        account={
          <>
            <Section title="Conta e sincronização">
              <div className="space-y-4">
                <AccountStatus />
                {state.status === "authenticated" && <ManualSyncButton />}
              </div>
            </Section>
            {state.status === "authenticated" && <ProAccessSections />}
          </>
        }
      />

      {/* O fim de "Dados e privacidade": os documentos que dizem o que o app
          faz com esses dados. */}
      <nav aria-label="Documentos legais" className="mt-6">
        <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
          {LEGAL_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="text-ink-muted underline underline-offset-4 hover:text-ink">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
