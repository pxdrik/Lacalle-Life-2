import type { Metadata } from "next";

import { AuthDataProvider } from "@/composition/auth-data-provider";
import { ProfileScreenDataProvider } from "@/composition/data-providers";
import { ICONS } from "@/design-system/icons";
import { PageHeader } from "@/design-system/components/page-header";
import { PageShell } from "@/design-system/components/page-shell";

import { ProfileTab } from "./profile-tab";

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
        subtitle="Seus dados, suas metas e as preferências do app. Só você vê."
      />

      {/* A ordem das seções, e onde a conta entra, mora em `ProfileTab`
          (roadmap 9.1, 30/09/2026). */}
      <div className="mt-8 max-w-lg">
        <AuthDataProvider>
          <ProfileScreenDataProvider>
            <ProfileTab />
          </ProfileScreenDataProvider>
        </AuthDataProvider>
      </div>
    </PageShell>
  );
}
