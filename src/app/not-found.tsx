import type { Metadata } from "next";
import Link from "next/link";

import { buttonClasses } from "@/design-system/components/button";
import { PageShell } from "@/design-system/components/page-shell";

export const metadata: Metadata = {
  title: "Página não encontrada · LaCalle Life",
};

/**
 * Where a wrong address lands.
 *
 * Next's built-in page is unstyled and has no way back — it does not even
 * carry the app's own navigation, so a mistyped URL or a bookmark to a deleted
 * diet was a dead end. That is a plausible arrival here rather than an exotic
 * one: ids live only in this browser, so a link shared, restored from another
 * device, or kept after a deletion points at nothing.
 *
 * The wording says that rather than blaming the address. "Página não
 * encontrada" is true of a typo and of a diet somebody deleted last week, and
 * the reader has no way to tell which — so it does not guess.
 */
export default function NotFound() {
  return (
    <PageShell className="py-20 text-center sm:py-28">
      <p className="text-sm tracking-wide text-ink-subtle uppercase">404</p>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance">
        Esta página não existe.
      </h1>

      <p className="mx-auto mt-3 max-w-md text-ink-muted">
        O endereço pode estar errado, ou o que estava aqui — uma dieta, um
        treino — pode ter sido apagado. Seus dados continuam no aparelho, como
        sempre.
      </p>

      {/* Links, not buttons: these change the address, and a middle click
          should open them in a tab like any other link. */}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonClasses()}>
          Ir para Hoje
        </Link>
        <Link href="/treinos" className={buttonClasses("secondary")}>
          Ver treinos
        </Link>
      </div>
    </PageShell>
  );
}
