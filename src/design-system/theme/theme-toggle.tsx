"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";

import { cn } from "../cn";
import { useTheme } from "./theme-provider";

/**
 * Claro ↔ escuro, num botão só.
 *
 * Era um grupo de 3 rádios (Claro/Escuro/Sistema) — pequeno demais pro que
 * carregava, e "Sistema" como uma terceira opção ao lado das outras duas
 * pesava mais do que valia: a tela já abre no tema escolhido (`DEFAULT_THEME`
 * é `"dark"`, nunca `"system"`), então seguir o SO nunca foi o caminho comum.
 * Um alguém que tinha `"system"` salvo de antes continua resolvendo
 * normalmente por `resolveTheme` — só não tem mais como escolher esse
 * terceiro estado de novo por aqui.
 *
 * O ícone mostra o tema atual, não o que o toque vai escolher — mesmo padrão
 * do play/pause em `ExercisePhotos`, onde o rótulo é que descreve a ação.
 */
export function ThemeToggle() {
  const { resolved, setPreference } = useTheme();
  const isDark = resolved === "dark";
  // Mesma técnica de `performed-set-row.tsx`/`meal-card.tsx`: presa ao
  // toque, nunca ao tema resolvido — que já muda sozinho na primeira
  // renderização (`resolveTheme`) e faria o ícone pipocar sem ninguém ter
  // tocado em nada.
  const [taps, setTaps] = useState(0);

  return (
    <button
      type="button"
      onClick={() => {
        setTaps((count) => count + 1);
        setPreference(isDark ? "light" : "dark");
      }}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      className="flex size-(--control-h-sm) items-center justify-center rounded-md border border-line bg-surface text-ink-subtle transition-[background-color,border-color,color,scale] duration-150 ease-out hover:text-ink active:scale-90"
    >
      {isDark ? (
        <Moon
          key={taps}
          aria-hidden
          className={cn("size-4", taps > 0 && "animate-pop motion-reduce:animate-none")}
        />
      ) : (
        <Sun
          key={taps}
          aria-hidden
          className={cn("size-4", taps > 0 && "animate-pop motion-reduce:animate-none")}
        />
      )}
    </button>
  );
}
