"use client";

import { useEffect } from "react";

/**
 * The one boundary above `error.tsx` — for a throw inside `RootLayout`
 * itself (`src/app/layout.tsx`), which `error.tsx` cannot catch precisely
 * because it renders inside that same layout. Next.js requires this file to
 * render its own complete `<html>`/`<body>`, since it replaces the root
 * layout entirely when it fires.
 *
 * Deliberately plain: no design-system import, no theme, no font. If the
 * root layout itself failed, the safest assumption is that whatever it was
 * setting up — theme tokens, the font variable, a provider — is exactly
 * what cannot be trusted to still work here.
 */
export default function GlobalError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    // See the note in `error.tsx` — this is the last line of defence.
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          padding: "5rem 1.5rem",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          textAlign: "center",
          background: "#0b0d0f",
          color: "#f2f4f2",
        }}
      >
        <p
          style={{
            fontSize: "0.875rem",
            letterSpacing: "0.03em",
            textTransform: "uppercase",
            color: "#9aa39c",
            margin: 0,
          }}
        >
          Algo deu errado
        </p>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 500, margin: "0.75rem 0" }}>
          O LaCalle Life não carregou.
        </h1>
        <p
          style={{
            color: "#9aa39c",
            maxWidth: "28rem",
            margin: "0.75rem auto 0",
          }}
        >
          Nada foi perdido — seus dados continuam no aparelho. Tentar de novo
          às vezes resolve.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "2rem",
            padding: "0.625rem 1.5rem",
            borderRadius: "0.5rem",
            border: "none",
            background: "#10b981",
            color: "#06251a",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Tentar de novo
        </button>
      </body>
    </html>
  );
}
