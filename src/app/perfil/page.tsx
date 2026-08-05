import type { Metadata } from "next";

import { ProfileDataProvider } from "@/composition/data-providers";
import { ProfileScreen } from "@/features/profile/components/profile-screen";

export const metadata: Metadata = {
  title: "Perfil · Lacalle Life",
};

export default function ProfilePage() {
  return (
    <main className="mx-auto max-w-lg px-6 py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
      <p className="mt-1.5 text-ink-muted">
        Opcional. Preencha se quiser ver suas dietas comparadas a uma meta —
        montar dieta funciona igual sem isso.
      </p>

      <div className="mt-8">
        <ProfileDataProvider>
          <ProfileScreen />
        </ProfileDataProvider>
      </div>
    </main>
  );
}
