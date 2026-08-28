import type { Metadata } from "next";

import { AccountSection } from "./_components/landing/account-section";
import { Features } from "./_components/landing/features";
import { FinalCta } from "./_components/landing/final-cta";
import { Hero } from "./_components/landing/hero";
import { LandingFooter } from "./_components/landing/landing-footer";
import { LandingHeader } from "./_components/landing/landing-header";
import { LandingRedirect } from "./_components/landing/landing-redirect";
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
 * primeiro conteúdo chegar já renderizado: só `LandingRedirect` roda no
 * cliente, e só para tirar quem já entrou (localStorage) ou está autenticado
 * (sessão Supabase) daqui para `/hoje`, sem bloquear o primeiro parágrafo
 * de quem está vendo o produto pela primeira vez.
 */
export default function LandingPage() {
  return (
    <>
      <LandingRedirect />
      <LandingHeader />
      <main>
        <Hero />
        <Pillars />
        <Features />
        <AccountSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </>
  );
}
