"use client";

import type { TurnstileState } from "../hooks/use-turnstile";

/**
 * O widget do Cloudflare Turnstile — só existe na tela quando
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` está definida. Sem ela, `captcha.siteKey`
 * é `undefined` e este componente não renderiza nada: o formulário que o usa
 * continua exatamente como sem CAPTCHA nenhum, o mesmo comportamento do
 * LaCalle Finance quando a variável não está configurada.
 */
export function TurnstileWidget({
  captcha,
}: {
  readonly captcha: TurnstileState;
}) {
  const { siteKey, containerRef } = captcha;

  if (siteKey === undefined) return null;

  return <div ref={containerRef} className="mt-1" />;
}
