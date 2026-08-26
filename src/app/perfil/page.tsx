import type { Metadata } from "next";

import { ProfileScreenDataProvider } from "@/composition/data-providers";
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

      <div className="mt-8 max-w-lg">
        <ProfileScreenDataProvider>
          <ProfileScreen />
        </ProfileScreenDataProvider>
      </div>
    </PageShell>
  );
}
