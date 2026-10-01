import type {
  AuditEntry,
  MyAccess,
  ProfessionalRecord,
  ProfessionalRequestInput,
  RejectionReason,
} from "../types/professional";

/**
 * O acesso ao Life Pro e a administração dele. Nada aqui decide permissão:
 * o banco decide (migração 0033), e uma chamada sem permissão volta como
 * erro. Este contrato só leva e traz.
 */
export interface ProRepository {
  /** `null` sem conta: sem conta não há pedido nem administração. */
  getMyAccess(): Promise<MyAccess | null>;
  requestAccess(input: ProfessionalRequestInput): Promise<void>;

  listProfessionals(): Promise<readonly ProfessionalRecord[]>;
  approve(userId: string): Promise<void>;
  reject(userId: string, reason: RejectionReason): Promise<void>;
  setSuspended(userId: string, suspended: boolean): Promise<void>;
  listAudit(): Promise<readonly AuditEntry[]>;
}
