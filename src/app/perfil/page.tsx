import type { Metadata } from "next";

import { ProfileScreenDataProvider } from "@/composition/data-providers";
import { ProfileScreen } from "@/features/profile/components/profile-screen";
import { ICONS } from "@/design-system/icons";
import { PageHeader } from "@/design-system/components/page-header";

export const metadata: Metadata = {
  title: "Perfil · LaCalle Life",
};

export default function ProfilePage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-10 sm:py-14">
      <PageHeader
        icon={ICONS.profile}
        title="Perfil"
        subtitle="Opcional. Preencha se quiser ver suas dietas comparadas a uma meta. Montar dieta funciona igual sem isso."
      />

      <div className="mt-8">
        <ProfileScreenDataProvider>
          <ProfileScreen />
        </ProfileScreenDataProvider>
      </div>
    </main>
  );
}
