import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { refreshSupabaseSession } from "@/core/auth/supabase-middleware";

/**
 * Sets the Content-Security-Policy header, with a fresh nonce per request.
 *
 * CSP is the one security header that cannot live in `next.config.ts`'s
 * static `headers()` — see that file for the rest (`X-Frame-Options`,
 * `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`), which
 * are the same on every response and belong there instead.
 *
 * **Why a nonce, not a bare allowlist.** This app renders two inline
 * `<script>` tags of its own — `ThemeScript` and `DensityScript`, which set
 * the theme and density before first paint so there is no flash of the
 * wrong one — and the App Router injects its own inline bootstrap scripts on
 * every page (the RSC hydration payload, `self.__next_f.push(...)`), whose
 * *content* differs per request. A hash-based CSP can cover the first two,
 * whose source is a build-time constant, but not the second: there is no
 * fixed set of hashes to allow. `'nonce-<random>'` covers both — Next.js
 * reads the nonce back out of this exact header (see
 * `getScriptNonceFromHeader` in its own source) and threads it onto every
 * script *it* injects automatically; `RootLayout` passes the same nonce to
 * `ThemeScript`/`DensityScript` explicitly, by reading `x-nonce` off
 * `headers()`. No `'unsafe-inline'` for scripts anywhere.
 *
 * `style-src` keeps `'unsafe-inline'` — nine components set a dynamic
 * `style={{ width: ... }}` for things a nonce cannot reach (a CSS custom
 * property computed per render, not a string known at build time), and
 * there is no equivalent nonce mechanism for style *attributes*. The
 * trade-off is deliberate: inline-style injection is a real hardening gap,
 * but a much smaller one than inline-script injection, which is what the
 * nonce closes completely.
 *
 * Every image the app shows — the exercise photos from jsDelivr/wger
 * included — is proxied same-origin through `/_next/image` (see
 * `images.remotePatterns` in `next.config.ts`), so `img-src` needs nothing
 * beyond `'self'`. The same is true for fonts: `next/font/google` bakes
 * Inter into the build and serves it from this origin, never from Google's
 * CDN at runtime.
 *
 * **Known trade-off, evaluated and accepted, not overlooked.** `RootLayout`
 * calling `headers()` to read the nonce this file sets is a Next.js
 * request-time API, and using one in a Server Component that every route
 * renders under opts the whole app out of static generation — every page
 * moved from prerendered/edge-cached to server-rendered per request (visible
 * as `ƒ` instead of `○` in `next build`'s route summary, and as
 * `Cache-Control: private, no-cache, no-store` instead of `public,
 * max-age=0, must-revalidate` on the response). The 2026-08-24 pre-deploy
 * review flagged this as an undisclosed side effect and asked for an
 * explicit decision rather than either silently keeping or silently
 * "optimising" it away.
 *
 * **Decision: accept the trade-off.** This app's server renders the shell
 * and touches no *domain* data — the dynamic render is a small shell, not a
 * query against anything that grows. What is lost is edge-cache latency and
 * Vercel compute cost on that shell; what is gained is a CSP with no
 * `'unsafe-inline'` on `script-src` anywhere, closing inline-script
 * injection completely rather than partially. For an app whose domain data
 * stays local-first, that is the right side to take without measurement
 * forcing the question — there is no per-user traffic data backing this
 * decision, only the architecture itself, and a future profiling pass with
 * real numbers is what would justify revisiting it, not a hash-based CSP
 * built ahead of any evidence it is worth the added complexity (a nonce
 * still covers the RSC bootstrap scripts, which change content per request
 * and have no fixed hash to allow — see above).
 *
 * **Updated 24/08/2026 for the Auth sprint** — `refreshSupabaseSession`
 * below does read and write one thing: the Supabase session cookie, so a
 * long-lived tab never silently expires. That is `auth.users`, never a
 * domain table — see `docs/arquitetura-sincronizacao.md` for the boundary
 * this sprint deliberately does not cross yet. `connect-src` grows the
 * Supabase project's own origin for the same reason: the browser client
 * calls it directly for sign-in/sign-up, and a bare `'self'` would block
 * that under this CSP.
 */
export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data:`,
    `font-src 'self'`,
    `connect-src 'self' https://challenges.cloudflare.com${supabaseUrl === undefined ? "" : ` ${supabaseUrl}`}`,
    // Só o Turnstile — mesmo CAPTCHA do LaCalle Finance, que também precisa
    // desta diretiva (o widget "Managed" roda num iframe, nunca inline).
    // Sem `frame-src` nenhum antes disto, a diretiva caía em `default-src
    // 'self'`, que bloquearia qualquer iframe de outra origem.
    `frame-src https://challenges.cloudflare.com`,
    `worker-src 'self'`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    // Só em produção — achado testando pelo IP da rede local (25/08/2026).
    // Essa diretiva manda o navegador trocar todo `http://` por `https://`
    // sozinho, inclusive nos assets (`_next/static/*`). Em `next dev`,
    // servido só por HTTP, isso fazia o navegador tentar buscar cada asset
    // por HTTPS e receber 503 de tudo — a tela carregava sem nenhum CSS/JS
    // ao abrir pelo IP da rede (nunca reproduzia em `localhost`, que o
    // navegador já trata como seguro e não tenta trocar).
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  await refreshSupabaseSession(request, response);

  return response;
}

export const config = {
  matcher: [
    /**
     * Every page and Server Action — anything that can render or re-render
     * the two inline scripts. Static assets and the image optimizer are
     * excluded: they never render a script, and the nonce would just be a
     * cache-buster on an otherwise-immutable URL for no benefit.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-maskable.svg|sw.js|manifest.webmanifest).*)",
  ],
};
