import type { Metadata } from "next";

import { ProDataProvider } from "@/composition/pro-data-provider";
import { AdminShell } from "@/features/pro/components/admin/admin-shell";

export const metadata: Metadata = {
  title: "Administração · LaCalle Life",
  robots: { index: false, follow: false },
};

/**
 * A administração do LaCalle (Life Pro, Etapa 2). Fora do grupo `(app)`: não
 * carrega a sincronização pessoal nem a navegação do app, e tem a casca larga
 * das áreas de trabalho. Quem protege é o banco (migração 0033); a casca só
 * não mostra nada a quem não administra.
 */
export default function AdminLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <ProDataProvider>
      <AdminShell>{children}</AdminShell>
    </ProDataProvider>
  );
}
