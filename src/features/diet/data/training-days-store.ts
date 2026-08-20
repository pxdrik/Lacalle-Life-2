import { WEEKDAYS, type Weekday } from "../services/diet-schedule";

/**
 * "Quais dias eu treino" — um preset pessoal, não um dado de domínio.
 *
 * Puramente manual, por decisão: derivar isso do histórico real de sessões
 * exigiria decidir o que fazer quando a rotina varia de semana pra semana, e
 * o único uso daqui é um atalho de um clique ao vincular uma dieta a dias da
 * semana — não vale a complexidade de inferir. `localStorage` porque é
 * preferência de aparelho, como o tema, não algo que precise sobreviver a um
 * `export`/`import` de backup.
 */

const STORAGE_KEY = "lacalle-life.training-days";

export function getTrainingDays(): readonly Weekday[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((value): value is Weekday =>
      WEEKDAYS.includes(value as Weekday),
    );
  } catch {
    return [];
  }
}

export function setTrainingDays(days: readonly Weekday[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
  } catch {
    // Storage blocked. The preset just will not survive a reload.
  }
}
