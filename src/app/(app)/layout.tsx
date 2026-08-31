import { AnonymousDataFoundPrompt } from "../_components/anonymous-data-found-prompt";
import { AppNav } from "../_components/app-nav";
import { Sidebar } from "../_components/sidebar";

/**
 * O dono do chrome do aplicativo — sidebar, header, tab bar.
 *
 * Existe como grupo de rotas, e não como um `if (pathname === "/")` dentro do
 * `RootLayout`, porque um Server Component lido de um header de requisição
 * nunca é remontado numa navegação client-side: `router.replace`/`<Link>`
 * saindo da Landing para `/hoje` trocava o conteúdo mas deixava o layout
 * acreditando que ainda estava em `/`, e a sidebar sumia. Um grupo de rotas
 * resolve isso pela própria mecânica do App Router — entrar ou sair de
 * `(app)` é uma mudança real na árvore de layouts, então o Next.js monta e
 * desmonta este arquivo corretamente em toda navegação, client-side inclusa.
 *
 * `(auth)` — login, cadastro, conta, recuperação de senha — vive dentro
 * deste grupo, não fora: já recebia este mesmo chrome antes da separação, e
 * a intenção era preservar exatamente esse comportamento.
 */
export default function AppLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <>
      {/* Two navigations, one at a time. `Sidebar` owns `lg` and up;
          below that it is not rendered and `AppNav` carries the header
          and the phone's tab bar. The padding is what keeps content
          clear of the fixed column, and it lives here rather than on
          each of eleven pages. */}
      <Sidebar />
      <div className="lg:pl-(--sidebar-w)">
        <AppNav />
        {children}
      </div>
      <AnonymousDataFoundPrompt />
    </>
  );
}
