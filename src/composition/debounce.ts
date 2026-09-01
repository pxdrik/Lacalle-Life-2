/**
 * Uma pendência por vez: chamadas repetidas dentro da janela reiniciam o
 * timer, então só a última leva a `fire` — usado por `data-providers.tsx`
 * para colapsar uma rajada de escritas locais (o editor de dieta/rotina
 * salva por campo, sem debounce próprio, de propósito) num push só.
 */
export function debouncedTrigger(fire: () => void, delayMs: number): () => void {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (timeout !== undefined) clearTimeout(timeout);
    timeout = setTimeout(fire, delayMs);
  };
}

/**
 * Mesma ideia de `debouncedTrigger`, mas uma janela por chave — o caso de
 * `FoodLog`, onde o push é um dia por vez: editar o dia de hoje não pode
 * reiniciar (ou nunca disparar) o push de um dia diferente editado pouco
 * antes.
 */
export function debouncedKeyedTrigger(
  fire: (key: string) => void,
  delayMs: number,
): (key: string) => void {
  const timeouts = new Map<string, ReturnType<typeof setTimeout>>();
  return (key: string) => {
    const existing = timeouts.get(key);
    if (existing !== undefined) clearTimeout(existing);
    timeouts.set(
      key,
      setTimeout(() => {
        timeouts.delete(key);
        fire(key);
      }, delayMs),
    );
  };
}
