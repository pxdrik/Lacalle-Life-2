import type {
  CreatedInvite,
  InviteInfo,
  MyCareLink,
  PatientLink,
  PendingInvite,
  Sharing,
} from "../types/care";

/**
 * Vínculos e convites (0034). Como em `ProRepository`, o banco decide quem
 * pode o quê; este contrato só leva e traz.
 */
export interface CareRepository {
  // Paciente
  getInvite(token: string): Promise<InviteInfo>;
  acceptInvite(token: string, sharing: Sharing): Promise<void>;
  listMyLinks(): Promise<readonly MyCareLink[]>;
  updateSharing(linkId: string, sharing: Sharing): Promise<void>;
  endLink(linkId: string): Promise<void>;

  // Profissional
  createInvite(patientLabel: string): Promise<CreatedInvite>;
  cancelInvite(inviteId: string): Promise<void>;
  listMyPatients(): Promise<{ readonly links: readonly PatientLink[]; readonly invites: readonly PendingInvite[] }>;

  // Administrador: o vínculo, nunca o conteúdo.
  listLinksOf(professionalId: string): Promise<readonly PatientLink[]>;
}
