"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getTurnstileSiteKey } from "@/core/auth/env";
import { useTheme } from "@/design-system/theme/theme-provider";

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
      readonly theme?: "light" | "dark" | "auto";
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
  // Achado de auditoria de design (02/09/2026): o widget sempre renderizava
  // no tema claro padrão da Cloudflare — cinza-claro, com o logotipo laranja
  // — quebrando a identidade visual exatamente nas telas de Entrar/Criar
  // conta. `resolved` é o mesmo tema que já pinta o resto da página
  // (`ThemeToggle` usa a mesma fonte), então o widget passa a segui-lo em vez
  // de vir com o próprio tema embutido.
  const { resolved: theme } = useTheme();

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
        theme,
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
        // Um widget removido (troca de tema, por exemplo) leva o token dele
        // junto — reaproveitar um token de um desafio que não existe mais na
        // tela seria pior que pedir para resolver de novo.
        setToken("");
      }
    };
  }, [siteKey, theme]);

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
