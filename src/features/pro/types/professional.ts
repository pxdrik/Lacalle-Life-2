/**
 * O profissional do Life Pro e a decisão sobre o pedido dele (migração 0033).
 * Os valores são os mesmos que o banco aceita: a lista fechada mora lá, e
 * estes tipos só a espelham.
 */
export type ProfessionalStatus = "pending" | "approved" | "rejected" | "suspended";

export type RejectionReason = "council_not_found" | "name_mismatch" | "inactive";

export const REJECTION_REASONS: readonly RejectionReason[] = ["council_not_found", "name_mismatch", "inactive"];

/** Como o administrador escolhe o motivo. */
export const REJECTION_REASON_LABELS: Readonly<Record<RejectionReason, string>> = {
  council_not_found: "Registro não encontrado",
  name_mismatch: "O nome não confere",
  inactive: "Registro inativo",
};

/** O que a pessoa lê no Perfil depois da recusa. É o que o administrador vê antes de recusar. */
export const REJECTION_REASON_MESSAGES: Readonly<Record<RejectionReason, string>> = {
  council_not_found:
    "Não encontramos esse número de CRN na região informada. Confira o número e a região e envie de novo.",
  name_mismatch:
    "O nome do pedido não confere com o do registro no conselho. Use o nome como está no registro e envie de novo.",
  inactive: "O registro aparece como inativo no conselho. Quando estiver ativo, envie o pedido de novo.",
};

/**
 * Os conselhos regionais de nutricionistas, para a pessoa escolher o seu. O
 * banco aceita de CRN-1 a CRN-12 (0033); a lista oferece de CRN-1 a CRN-11.
 * Sem os estados de cada um: não estão conferidos numa fonte, e quem
 * administra procura pelo número no site do próprio conselho.
 */
export const COUNCIL_REGIONS: readonly string[] = Array.from({ length: 11 }, (_, index) => `CRN-${String(index + 1)}`);

export interface ProfessionalRequestInput {
  readonly displayName: string;
  readonly councilRegion: string;
  readonly councilNumber: string;
}

/** O pedido como a própria pessoa o vê. */
export interface OwnProfessional {
  readonly status: ProfessionalStatus;
  readonly displayName: string;
  readonly councilRegion: string;
  readonly councilNumber: string;
  readonly rejectionReason: RejectionReason | null;
}

/** O que a conta logada pode fazer: pedir acesso, usar o Life Pro, administrar. */
export interface MyAccess {
  readonly isAdmin: boolean;
  readonly professional: OwnProfessional | null;
}

/** Uma linha da tela de administração. */
export interface ProfessionalRecord {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly councilRegion: string;
  readonly councilNumber: string;
  readonly status: ProfessionalStatus;
  readonly rejectionReason: RejectionReason | null;
  readonly requestedAt: string;
  readonly reviewedAt: string | null;
}

export type AuditAction = "approve" | "reject" | "suspend" | "reactivate";

export interface AuditEntry {
  readonly id: number;
  readonly action: AuditAction;
  readonly targetUserId: string | null;
  readonly displayName: string;
  readonly council: string;
  readonly reason: RejectionReason | null;
  readonly createdAt: string;
}
