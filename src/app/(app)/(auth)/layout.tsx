import { AuthDataProvider } from "@/composition/auth-data-provider";
import { PageShell } from "@/design-system/components/page-shell";

/**
 * Layout de segmento — só as rotas de auth passam por `AuthDataProvider`.
 * Nenhuma tela existente (Perfil, Treinos, Dietas...) é tocada: elas
 * continuam fora deste grupo de rotas, sem o provider e sem depender dele.
 *
 * **O contêiner passou a ser `PageShell`, como toda outra rota.** Achado de
 * auditoria de design (02/09/2026): um `<main>` próprio limitado a
 * `max-w-sm` (384 px) fazia "Entrar"/"Criar conta" flutuarem como uma ilha
 * centralizada numa página inteira preta — a única dupla de telas do app que
 * não seguia a largura de conteúdo de 1280 px que a pág. 21 do brandbook
 * define para tudo o mais (Hoje, Treinos, Dietas...). Trocar para
 * `PageShell` alinha o título e a margem esquerda do formulário com onde
 * todo outro cabeçalho de página começa; o formulário em si continua
 * estreito — um card de dois campos não deveria esticar até 1280 px — só
 * não fica mais sozinho, centralizado, num contêiner que ninguém mais usa.
 */
export default function AuthLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <AuthDataProvider>
      <PageShell padding="roomy">
        <div className="max-w-sm">{children}</div>
      </PageShell>
    </AuthDataProvider>
  );
}
