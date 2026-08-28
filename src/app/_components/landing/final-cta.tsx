import Link from "next/link";

import { buttonClasses } from "@/design-system/components/button";

export function FinalCta() {
  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-(--content-max) px-4 py-20 text-center md:px-6 md:py-28 lg:px-12">
        <h2 className="text-h2 font-bold text-ink">Pronto para começar?</h2>

        <div className="mt-7 flex flex-col items-center gap-4">
          <Link href="/cadastro" className={buttonClasses("primary", "lg")}>
            Criar minha conta
          </Link>

          <Link
            href="/entrar"
            className="text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            Já tenho uma conta, entrar
          </Link>

          <Link
            href="/hoje"
            className="mt-2 text-sm text-ink-subtle underline underline-offset-4 hover:text-ink-muted"
          >
            Ou experimente sem criar uma conta
          </Link>
        </div>
      </div>
    </section>
  );
}
