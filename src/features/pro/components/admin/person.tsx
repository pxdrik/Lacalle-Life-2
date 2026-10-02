import { initials } from "./format";

/**
 * Avatar com iniciais, nome e uma linha de apoio. O nome quebra linha em vez
 * de ganhar reticências: em 320px um nome longo ("Juliana Rocha
 * Albuquerque") precisa caber inteiro.
 */
export function Person({ name, detail }: { readonly name: string; readonly detail: string }) {
  return (
    <span className="flex min-w-0 items-start gap-3">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-ink-muted"
      >
        {initials(name)}
      </span>
      <span className="min-w-0">
        <span className="block font-medium break-words text-ink">{name}</span>
        <span className="block text-xs break-words text-ink-subtle">{detail}</span>
      </span>
    </span>
  );
}
