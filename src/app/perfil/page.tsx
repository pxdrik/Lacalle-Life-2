import type { Metadata } from "next";

import { ProfileDataProvider } from "@/composition/data-providers";
import { ProfileScreen } from "@/features/profile/components/profile-screen";
import { PageHeader } from "@/design-system/components/page-header";

export const metadata: Metadata = {
  title: "Perfil · Lacalle Life",
};

export default function ProfilePage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-10 sm:py-14">
      <PageHeader
        title="Perfil"
        subtitle="Opcional. Preencha se quiser ver suas dietas comparadas a uma meta — montar dieta funciona igual sem isso."
      />

      <div className="mt-8">
        <ProfileDataProvider>
          <ProfileScreen />
        </ProfileDataProvider>
      </div>
    </main>
  );
}
