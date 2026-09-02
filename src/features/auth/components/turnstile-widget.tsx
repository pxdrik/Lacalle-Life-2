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

  // `min-h-[65px]`: a altura fixa do widget no tamanho "normal" do Turnstile.
  // Sem isto o container nasce com altura zero e ganha os 65px de um pulo
  // assim que o script carrega e o iframe é injetado, empurrando o botão de
  // envio para baixo bem debaixo do cursor de quem já estava lendo aquela
  // linha — reservar o espaço evita o layout shift em vez de só o tema.
  return <div ref={containerRef} className="mt-1 min-h-[65px]" />;
}
