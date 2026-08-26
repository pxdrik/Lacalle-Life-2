"use client";

import { Moon, Sun } from "lucide-react";

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

  return (
    <button
      type="button"
      onClick={() => {
        setPreference(isDark ? "light" : "dark");
      }}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      className="flex size-(--control-h-sm) items-center justify-center rounded-md border border-line bg-surface text-ink-subtle transition-colors duration-150 ease-out hover:text-ink"
    >
      {isDark ? (
        <Moon aria-hidden className="size-4" />
      ) : (
        <Sun aria-hidden className="size-4" />
      )}
    </button>
  );
}
