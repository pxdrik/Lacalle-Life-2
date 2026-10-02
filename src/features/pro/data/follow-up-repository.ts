import type { BodyPoint, DiaryWeek, OverviewRow, PatientSession, Shared } from "../types/follow-up";

/**
 * O acompanhamento do treinador (Etapa 6). Só leitura, e cada leitura passa
 * por uma função do banco que confere o que o paciente libera (0039).
 */
export interface FollowUpRepository {
  /** Treinos finalizados desde `since` (ms), mais novo primeiro. */
  listSessions(linkId: string, since: number): Promise<Shared<readonly PatientSession[]>>;
  /**
   * O diário entre dois dias (`YYYY-MM-DD`), comparado com as refeições do
   * plano publicado (como o banco guarda; `null` sem plano).
   */
  listDiary(linkId: string, from: string, to: string, plan: { readonly id: string; readonly meals: unknown } | null): Promise<Shared<DiaryWeek>>;
  listBody(linkId: string): Promise<Shared<readonly BodyPoint[]>>;
  /** Um por vínculo ativo; `since` (ms) limita os treinos de cada um. */
  overview(since: number): Promise<readonly OverviewRow[]>;
}
