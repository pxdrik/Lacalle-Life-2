import type { Metadata } from "next";

import { PageTransition } from "@/design-system/components/page-transition";

import { AccountSection } from "./_components/landing/account-section";
import { Features } from "./_components/landing/features";
import { FinalCta } from "./_components/landing/final-cta";
import { Hero } from "./_components/landing/hero";
import { LandingFooter } from "./_components/landing/landing-footer";
import { LandingHeader } from "./_components/landing/landing-header";
import { Pillars } from "./_components/landing/pillars";

export const metadata: Metadata = {
  title: "LaCalle Life",
  description:
    "Monte suas dietas, registre seus treinos e acompanhe sua evolução num só lugar. Comece sem conta ou crie uma para sincronizar entre dispositivos.",
  openGraph: {
    title: "LaCalle Life",
    description:
      "Monte suas dietas, registre seus treinos e acompanhe sua evolução num só lugar.",
    locale: "pt_BR",
    type: "website",
  },
};

/**
 * A Landing Page pública em `/`. Server Component por padrão, para o
 * primeiro conteúdo chegar já renderizado.
 *
 * **09/09/2026 — sempre aparece, para todo mundo.** Pedido do Pedro: nada de
 * pular direto para `/hoje` para quem já usou o app ou já tem sessão. Havia
 * um `LandingRedirect` que fazia exatamente isso, lendo uma marca em
 * `localStorage` (`app/_lib/entered-app.ts`) e a sessão do Supabase —
 * removido, não só desligado, porque a decisão é o oposto: esta é agora a
 * porta de entrada de sempre, não só da primeira visita.
 *
 * `PageTransition` aplicado direto aqui, não por um `template.tsx` — esta
 * página não tem uma pasta própria para hospedar um, sendo `page.tsx` na
 * raiz. Sem risco do problema que isso resolveu em `(app)`: nada aqui é
 * `position: fixed` (o cabeçalho é `sticky`), então o novo *containing
 * block* que o `translate` da animação cria não tem nada de errado para
 * capturar.
 */
export default function LandingPage() {
  return (
    <PageTransition>
      <LandingHeader />
      <main>
        <Hero />
        <Pillars />
        <Features />
        <AccountSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </PageTransition>
  );
}
