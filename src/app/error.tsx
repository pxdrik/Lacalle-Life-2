"use client";

import Link from "next/link";
import { useEffect } from "react";

import { buttonClasses } from "@/design-system/components/button";
import { PageShell } from "@/design-system/components/page-shell";

/**
 * The safety net every route below the root layout falls into.
 *
 * Found 26/08/2026, by an external audit: `(auth)/layout.tsx` creates the
 * Supabase client during render, inside `useState(fn)` — outside any
 * `try/catch` — and with no `error.tsx` anywhere in the app, a missing
 * environment variable there didn't fail into a message. It failed into the
 * browser's own "This page didn't load" screen, with nothing the app could
 * say and nothing the person could do.
 *
 * This file is the fix for the *shape* of that failure, not for the
 * Supabase misconfiguration itself (a production environment variable,
 * fixed at the host). Any other render-time throw anywhere under the root
 * layout lands here too, from now on — that is the point of putting it at
 * this level rather than only inside `(auth)/`.
 */
export default function Error({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    // No error-reporting service wired up yet — losing this with nothing
    // else logging it would be worse than a line in the browser console.
    console.error(error);
  }, [error]);

  return (
    <PageShell className="py-20 text-center sm:py-28">
      <p className="text-sm tracking-wide text-ink-subtle uppercase">
        Algo deu errado
      </p>

      <h1 className="mt-3 text-3xl font-medium tracking-normal text-balance">
        Essa tela não carregou.
      </h1>

      <p className="mx-auto mt-3 max-w-md text-ink-muted">
        Nada foi perdido — seus dados continuam no aparelho. Tentar de novo
        às vezes resolve; se continuar, o resto do app funciona normalmente.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className={buttonClasses()}>
          Tentar de novo
        </button>
        <Link href="/" className={buttonClasses("secondary")}>
          Ir para Hoje
        </Link>
      </div>
    </PageShell>
  );
}
