import { AuthDataProvider } from "@/composition/auth-data-provider";

/**
 * Layout de segmento — só as rotas de auth passam por `AuthDataProvider`.
 * Nenhuma tela existente (Perfil, Treinos, Dietas...) é tocada: elas
 * continuam fora deste grupo de rotas, sem o provider e sem depender dele.
 */
export default function AuthLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <AuthDataProvider>
      <main className="mx-auto max-w-sm px-6 py-14 sm:py-20">{children}</main>
    </AuthDataProvider>
  );
}
