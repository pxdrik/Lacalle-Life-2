import Link from "next/link";

/**
 * O resumo do Aviso de Saúde na landing (roadmap 8.4, 30/09/2026): a pessoa
 * vê isso antes de criar conta ou de experimentar sem conta. Curto, no fim
 * da página e no tom do rodapé, não um bloco jurídico; o texto inteiro fica
 * em `/aviso-de-saude`.
 */
export function HealthNotice() {
  return (
    <section aria-labelledby="aviso-de-saude" className="border-t border-line">
      <div className="mx-auto max-w-2xl px-4 py-10 text-center md:px-6">
        <h2 id="aviso-de-saude" className="text-sm font-semibold text-ink">
          Aviso de saúde
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          O LaCalle Life é uma ferramenta de organização e acompanhamento pessoal. Cálculos,
          metas e indicadores do aplicativo não substituem avaliação ou orientação de
          profissionais de saúde.
        </p>
        <Link
          href="/aviso-de-saude"
          className="mt-3 inline-block text-sm text-ink underline underline-offset-4 hover:text-ink-muted"
        >
          Leia o aviso completo
        </Link>
      </div>
    </section>
  );
}
