"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getTurnstileSiteKey } from "@/core/auth/env";

/**
 * O CAPTCHA (Cloudflare Turnstile) de cadastro/login/recuperação de senha —
 * mesma arquitetura do LaCalle Finance: um script carregado à mão (sem
 * biblioteca de wrapper), token repassado ao Supabase, e a validação de
 * verdade acontece dentro do próprio Supabase (Attack Protection), nunca
 * aqui. Este hook só monta o widget e devolve o token que ele emite — não
 * decide se esse token é válido.
 */
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

interface TurnstileGlobal {
  render(
    container: HTMLElement,
    options: {
      readonly sitekey: string;
      readonly callback: (token: string) => void;
      readonly "expired-callback"?: () => void;
      readonly "error-callback"?: () => void;
    },
  ): string;
  reset(widgetId?: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileGlobal;
  }
}

export interface TurnstileState {
  /**
   * `undefined` quando `NEXT_PUBLIC_TURNSTILE_SITE_KEY` não está definida —
   * nenhum widget é montado, e o formulário que usa isto continua
   * funcionando exatamente como sem CAPTCHA nenhum.
   */
  readonly siteKey: string | undefined;
  readonly containerRef: React.RefObject<HTMLDivElement | null>;
  readonly token: string;
  /**
   * Limpa o token e recarrega o desafio. Chamado depois de toda tentativa de
   * envio — sucesso ou falha — para nunca reaproveitar o mesmo token numa
   * segunda tentativa.
   */
  reset(): void;
}

export function useTurnstile(): TurnstileState {
  const siteKey = getTurnstileSiteKey();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    if (siteKey === undefined) return;
    const key = siteKey;
    let cancelled = false;

    function render() {
      if (
        cancelled ||
        containerRef.current === null ||
        window.turnstile === undefined
      ) {
        return;
      }

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: key,
        callback: setToken,
        "expired-callback": () => {
          setToken("");
        },
        "error-callback": () => {
          setToken("");
        },
      });
    }

    if (window.turnstile !== undefined) {
      render();
    } else {
      const existing = document.querySelector(
        `script[src="${SCRIPT_SRC}"]`,
      );
      if (existing === null) {
        const script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        script.onload = render;
        document.head.appendChild(script);
      } else {
        existing.addEventListener("load", render);
      }
    }

    return () => {
      cancelled = true;
      if (window.turnstile !== undefined && widgetIdRef.current !== null) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Já removido — nada a fazer.
        }
      }
    };
  }, [siteKey]);

  const reset = useCallback(() => {
    setToken("");
    if (window.turnstile !== undefined && widgetIdRef.current !== null) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        // Widget ainda não montado — nada a resetar.
      }
    }
  }, []);

  return { siteKey, containerRef, token, reset };
}
