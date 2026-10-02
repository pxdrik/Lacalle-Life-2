import type { Metadata } from "next";

import { ProDataProvider } from "@/composition/pro-data-provider";
import { ProShell } from "@/features/pro/components/pro/pro-shell";

export const metadata: Metadata = {
  title: "Life Pro · LaCalle Life",
  robots: { index: false, follow: false },
};

/**
 * O Life Pro (Etapas 3 e 4). Fora do grupo `(app)`, como a administração: não
 * carrega a sincronização pessoal, e os dados de paciente nunca vão para o
 * IndexedDB da profissional (`docs/visao-adm-plano.md`).
 */
export default function ProLayout({ children }: { readonly children: React.ReactNode }) {
  return (
    <ProDataProvider>
      <ProShell>{children}</ProShell>
    </ProDataProvider>
  );
}
