const WHEN = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** "29/09, 18:40": a data das telas de administração. */
export function formatWhen(iso: string): string {
  return WHEN.format(new Date(iso));
}

/** Duas iniciais para o avatar. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
