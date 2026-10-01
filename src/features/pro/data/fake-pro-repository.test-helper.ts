import type { ProRepository } from "./pro-repository";
import {
  describeRegistrations,
  type AuditEntry,
  type MyAccess,
  type ProfessionalRecord,
  type ProfessionalStatus,
  type RejectionReason,
} from "../types/professional";

/**
 * Um `ProRepository` em memória para testes de tela. As regras de verdade
 * (quem pode aprovar, quem lê o quê) são testadas contra o banco em
 * `supabase-pro-repository.db.test.ts`; aqui só se imita o efeito de cada
 * decisão, para a tela ter o que mostrar.
 */
export function fakeProRepository(options: {
  readonly access?: MyAccess | null;
  readonly professionals?: readonly ProfessionalRecord[];
}): ProRepository & { readonly calls: string[] } {
  let access = options.access === undefined ? { isAdmin: false, professional: null } : options.access;
  let professionals = [...(options.professionals ?? [])];
  const audit: AuditEntry[] = [];
  const calls: string[] = [];

  const set = (userId: string, status: ProfessionalStatus, reason: RejectionReason | null) => {
    professionals = professionals.map((record) =>
      record.userId === userId ? { ...record, status, rejectionReason: reason } : record,
    );
  };
  const log = (userId: string, action: AuditEntry["action"], reason: RejectionReason | null) => {
    const record = professionals.find((p) => p.userId === userId)!;
    audit.unshift({
      id: audit.length + 1,
      action,
      targetUserId: userId,
      displayName: record.displayName,
      council: describeRegistrations(record.registrations).join(" · "),
      reason,
      createdAt: "2026-10-01T12:00:00.000Z",
    });
  };

  return {
    calls,
    getMyAccess: () => Promise.resolve(access),
    requestAccess: (input) => {
      calls.push(`request:${input.displayName}|${describeRegistrations(input.registrations).join("|")}`);
      access = {
        isAdmin: access?.isAdmin ?? false,
        professional: { status: "pending", rejectionReason: null, ...input },
      };
      return Promise.resolve();
    },
    listProfessionals: () => Promise.resolve(professionals),
    approve: (userId) => {
      calls.push(`approve:${userId}`);
      set(userId, "approved", null);
      log(userId, "approve", null);
      return Promise.resolve();
    },
    reject: (userId, reason) => {
      calls.push(`reject:${userId}:${reason}`);
      set(userId, "rejected", reason);
      log(userId, "reject", reason);
      return Promise.resolve();
    },
    setSuspended: (userId, suspended) => {
      calls.push(`${suspended ? "suspend" : "reactivate"}:${userId}`);
      set(userId, suspended ? "suspended" : "approved", null);
      log(userId, suspended ? "suspend" : "reactivate", null);
      return Promise.resolve();
    },
    listAudit: () => Promise.resolve([...audit]),
  };
}

export function record(overrides: Partial<ProfessionalRecord> & { readonly userId: string }): ProfessionalRecord {
  return {
    email: `${overrides.userId}@exemplo.com`,
    displayName: "Beatriz Nogueira",
    registrations: { crn: { region: "CRN-3", number: "12345" }, cref: null },
    status: "pending",
    rejectionReason: null,
    requestedAt: "2026-09-29T21:40:00.000Z",
    reviewedAt: null,
    ...overrides,
  };
}
