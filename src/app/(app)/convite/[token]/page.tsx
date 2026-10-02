import type { Metadata } from "next";

import { ProDataProvider } from "@/composition/pro-data-provider";
import { PageShell } from "@/design-system/components/page-shell";
import { InviteScreen } from "@/features/pro/components/care/invite-screen";

export const metadata: Metadata = {
  title: "Convite · LaCalle Life",
  robots: { index: false, follow: false },
};

/**
 * O link que a nutricionista envia (Life Pro, Etapa 4). Dentro do app, com a
 * navegação de sempre: quem abre é o paciente, no app dele.
 */
export default async function InvitePage({ params }: { readonly params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <PageShell>
      <div className="max-w-lg">
        <ProDataProvider>
          <InviteScreen token={token} />
        </ProDataProvider>
      </div>
    </PageShell>
  );
}
