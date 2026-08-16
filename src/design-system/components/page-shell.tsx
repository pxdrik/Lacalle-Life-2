import { cn } from "@/design-system/cn";

/**
 * How much vertical room a screen opens with.
 *
 * `tight` is for the screens you arrive at already reading — Hoje, the diary,
 * a running workout — where a tall gap before the first card is a scroll
 * nobody asked for. `roomy` is for the ones you arrive at to choose something.
 */
type Padding = "tight" | "roomy";

/** Ambos os pares saem da escala base 4 da pág. 22. `py-14` — 56 px — não sai. */
const PADDING: Record<Padding, string> = {
  tight: "py-6 md:py-10",
  roomy: "py-10 md:py-12",
};

/**
 * The width every screen lives in: **1280 px**, da pág. 21.
 *
 * **Isto reverte um número que tinha uma razão, e a razão não sobreviveu à
 * medição da própria página.** O cap era 1920 px, e o comentário que o
 * defendia contava a história certa: 1152 px foi medido contra uma janela sem
 * sidebar, e quando 256 px viraram coluna fixa o mesmo cap deixou 725 px de
 * página vazia num monitor de 2133 — o conteúdo lia como uma tira estreita
 * presa ao lado de uma navegação.
 *
 * O que faltava naquela conta é o que a pág. 21 diz na frase seguinte à do
 * cap: **"a sidebar não conta como coluna, e o grid de 12 começa depois
 * dela"**. O cap é do conteúdo, não da janela. Com 264 px de coluna, 1280 de
 * conteúdo num monitor de 1920 deixa 188 px de cada lado — margem, não tira
 * estreita. A queixa original era contra 725; esta é outra situação.
 *
 * As margens laterais seguem a tabela da pág. 32: 16 no celular, 24 no tablet,
 * 48 no desktop.
 *
 * Written once here rather than spelled out on eleven pages, which is how the
 * eleven had already drifted into two different vertical paddings with no rule
 * saying which screen gets which.
 */
const SHELL_PX = "px-4 md:px-6 lg:px-12";

export function pageShell(padding: Padding = "roomy"): string {
  return cn("mx-auto w-full max-w-(--content-max)", SHELL_PX, PADDING[padding]);
}

/**
 * For an element that bleeds to the shell's own edge — a sticky header, a
 * full-bleed image — and then repads to line back up with the content below
 * it.
 *
 * A negative margin only cancels padding of the exact same value, at the exact
 * same breakpoint. Writing `-mx-6` by hand next to `pageShell()`'s `px-4
 * md:px-6 lg:px-12` cancels correctly at `md` and up and overshoots by 8px
 * below it — that mismatch is what caused the mobile overflow regression this
 * constant exists to prevent from happening a second time. Pairing bleed and
 * pad from the same source is the fix; a second one-off `-mx-6` elsewhere is
 * the same bug again.
 */
export const PAGE_SHELL_BLEED = "-mx-4 md:-mx-6 lg:-mx-12 " + SHELL_PX;

interface Props extends React.HTMLAttributes<HTMLElement> {
  readonly padding?: Padding;
}

/** The `main` element every route opens with. */
export function PageShell({ padding, className, ...props }: Props) {
  return <main className={cn(pageShell(padding), className)} {...props} />;
}
