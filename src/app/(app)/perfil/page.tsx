import type { Metadata } from "next";

import { AuthDataProvider } from "@/composition/auth-data-provider";
import { ProfileScreenDataProvider } from "@/composition/data-providers";
import { AccountStatus } from "@/features/auth/components/account-status";
import { ManualSyncButton } from "@/app/(app)/(auth)/conta/manual-sync-button";
import { ProfileScreen } from "@/features/profile/components/profile-screen";
import { ICONS } from "@/design-system/icons";
import { PageHeader } from "@/design-system/components/page-header";
import { PageShell } from "@/design-system/components/page-shell";

export const metadata: Metadata = {
  title: "Perfil · LaCalle Life",
};

export default function ProfilePage() {
  return (
    // A única tela que não passava por `PageShell` — tinha suas próprias
    // margens fixas (`px-6`, sem crescer em `lg`), então num desktop largo
    // ela lia como uma coluna de celular presa no meio da página, enquanto
    // toda outra tela usa as margens responsivas de `pageShell` (16/24/48
    // da pág. 32). O formulário em si continua estreito de propósito — um
    // formulário de uma coluna só não lê melhor esticado até 1280px —, mas
    // agora dentro da margem certa (achado do Pedro, 26/08/2026).
    <PageShell>
      <PageHeader
        icon={ICONS.profile}
        title="Perfil"
        subtitle="Opcional. Preencha se quiser ver suas dietas comparadas a uma meta. Montar dieta funciona igual sem isso."
      />

      <div className="mt-8 max-w-lg space-y-6">
        {/* Composta aqui, não dentro de `ProfileScreen`: `features/profile`
            não pode importar de dentro de `features/auth` (regra do
            AGENTS.md — cada feature só expõe o próprio `index.ts`, e
            `features/auth` nunca teve um). `app/` é o único lugar que já
            tem licença para amarrar as duas. Pedido do Pedro, 26/08/2026:
            "quero uma parte na aba de perfil dizendo qual é meu e-mail,
            senha, etc" — e hoje esta é também a única tela do app que leva
            a `/entrar`/`/cadastro`, que nenhuma navegação linka. */}
        <div>
          <h2 className="text-sm font-medium text-ink">Conta</h2>
          <div className="mt-3">
            <AuthDataProvider>
              <AccountStatus />
            </AuthDataProvider>
          </div>
        </div>

        {/* Achado ao vivo contra produção (02/09/2026): o único lugar que
            disparava a sincronização do perfil era `/conta` — quem só abre
            `/perfil` (que é onde o número de kcal realmente aparece e onde
            a edição acontece) nunca via a pendência sair nem uma versão
            nova chegar. Mesmo componente de `/conta`, montado aqui também
            — dois pontos de entrada legítimos para o mesmo mecanismo, não
            duas telas competindo por ele. */}
        <ManualSyncButton />

        <ProfileScreenDataProvider>
          <ProfileScreen />
        </ProfileScreenDataProvider>
      </div>
    </PageShell>
  );
}
