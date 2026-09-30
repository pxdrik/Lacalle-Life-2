import Link from "next/link";

import { LandingFooter } from "../landing/landing-footer";
import { LandingHeader } from "../landing/landing-header";
import { LEGAL_LINKS } from "./legal-links";

/**
 * Os três documentos legais (roadmap 8.4, 30/09/2026) e o que eles
 * compartilham: a versão, o contato, e uma página editorial simples com o
 * cabeçalho e o rodapé da landing. Públicos, sem login: a navegação do app
 * só existe dentro de `(app)`.
 *
 * Texto a partir dos rascunhos que o Pedro fez com o ChatGPT, ajustado ao
 * que o app faz de verdade nesta data. **Nada aqui afirma um recurso que não
 * existe**: quando o app mudar (analytics, modo profissional, exclusão de
 * conta pela tela), o documento muda junto, com data nova.
 */

/** Data da versão vigente dos três documentos. */
export const LEGAL_UPDATED_AT = "30 de setembro de 2026";

/**
 * O canal oficial para contato e para os pedidos de titular (LGPD), criado
 * pelo Pedro em 30/09/2026. Mudar aqui atualiza os três documentos; `null`
 * volta a dizer que o canal ainda será publicado, nunca um e-mail inventado.
 */
export const LEGAL_CONTACT_EMAIL: string | null = "lacallepm@gmail.com";

export interface LegalSection {
  readonly heading: string;
  readonly body: readonly React.ReactNode[];
}

export function LegalDocument({
  title,
  intro,
  sections,
}: {
  readonly title: string;
  readonly intro: string;
  readonly sections: readonly LegalSection[];
}) {
  return (
    <>
      <LandingHeader />
      <main className="mx-auto w-full max-w-2xl px-4 py-10 md:px-6 md:py-14">
        <article>
          <h1 className="text-h1 font-bold text-ink">{title}</h1>
          <p className="mt-2 text-sm text-ink-subtle">Atualizado em {LEGAL_UPDATED_AT}.</p>
          <p className="mt-6 text-ink-muted">{intro}</p>

          {sections.map((section) => (
            <section key={section.heading} className="mt-8">
              <h2 className="text-h3 font-semibold text-ink">{section.heading}</h2>
              {section.body.map((paragraph, index) => (
                <p key={index} className="mt-3 leading-relaxed text-ink-muted">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}

          <nav aria-label="Outros documentos" className="mt-12 border-t border-line pt-6">
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {LEGAL_LINKS.filter((link) => link.label !== title).map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-ink-muted underline underline-offset-4 hover:text-ink">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </article>
      </main>
      <LandingFooter />
    </>
  );
}

/** A frase de contato, com o e-mail quando existir. */
export function ContactLine({ subject }: { readonly subject: string }) {
  if (LEGAL_CONTACT_EMAIL === null) {
    return (
      <>O canal oficial para {subject} ainda será publicado nesta página.</>
    );
  }
  return (
    <>
      Para {subject}, escreva para{" "}
      <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="text-ink underline underline-offset-4">
        {LEGAL_CONTACT_EMAIL}
      </a>
      .
    </>
  );
}
