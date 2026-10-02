import { z } from "zod";

import type { ProRepository } from "./pro-repository";
import { REJECTION_REASONS, type AuditEntry, type Registrations, type RejectionReason } from "../types/professional";

/**
 * O pedaço do cliente Supabase que este repositório usa. Estrutural, como
 * `SyncSupabaseClient`, para o teste passar um fake sem montar o cliente
 * inteiro.
 */
export interface ProSupabaseClient {
  readonly auth: {
    getUser(): Promise<{ readonly data: { readonly user: { readonly id: string } | null } }>;
  };
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ readonly data: unknown; readonly error: { readonly message: string } | null }>;
  from(table: string): {
    select(columns: string): ProQuery;
  };
}

export interface ProQuery
  extends PromiseLike<{ readonly data: unknown; readonly error: { readonly message: string } | null }> {
  eq(column: string, value: string): ProQuery;
}

const status = z.enum(["pending", "approved", "rejected", "suspended"]);
const reason = z.enum(REJECTION_REASONS as [RejectionReason, ...RejectionReason[]]);

// Os dois registros (0037): CRN nas colunas de antes, CREF nas novas, cada
// par inteiro ou vazio (o banco garante).
const registrationColumns = {
  council_region: z.string().nullable(),
  council_number: z.string().nullable(),
  cref_number: z.string().nullable(),
  cref_region: z.string().nullable(),
};

function registrationsOf(row: {
  readonly council_region: string | null;
  readonly council_number: string | null;
  readonly cref_number: string | null;
  readonly cref_region: string | null;
}): Registrations {
  return {
    crn:
      row.council_region === null || row.council_number === null
        ? null
        : { region: row.council_region, number: row.council_number },
    cref:
      row.cref_number === null || row.cref_region === null ? null : { number: row.cref_number, region: row.cref_region },
  };
}

const ownRow = z.object({
  status,
  display_name: z.string(),
  ...registrationColumns,
  rejection_reason: reason.nullable(),
});

const listRow = z.object({
  user_id: z.string(),
  email: z.string(),
  display_name: z.string(),
  ...registrationColumns,
  status,
  rejection_reason: reason.nullable(),
  requested_at: z.string(),
  reviewed_at: z.string().nullable(),
});

const auditRow = z.object({
  id: z.number(),
  action: z.enum(["approve", "reject", "suspend", "reactivate"]),
  target_user_id: z.string().nullable(),
  detail: z.object({
    display_name: z.string(),
    council: z.string(),
    reason: reason.nullable().optional(),
  }),
  created_at: z.string(),
});

function fail(error: { readonly message: string } | null): void {
  if (error !== null) throw new Error(error.message);
}

export function createSupabaseProRepository(client: ProSupabaseClient): ProRepository {
  return {
    async getMyAccess() {
      const { data: userData } = await client.auth.getUser();
      if (userData.user === null) return null;

      const [admin, own] = await Promise.all([
        client.rpc("is_admin"),
        // Filtro explícito, como em toda leitura da sincronização: o
        // administrador também lê os pedidos dos outros (0033), e aqui só
        // interessa o dele.
        client
          .from("professional_profiles")
          .select("user_id,status,display_name,council_region,council_number,cref_number,cref_region,rejection_reason")
          .eq("user_id", userData.user.id),
      ]);
      fail(admin.error);
      fail(own.error);

      const rows = z.array(ownRow.extend({ user_id: z.string() })).parse(own.data);
      const mine = rows.find((row) => row.user_id === userData.user?.id);
      return {
        isAdmin: z.boolean().parse(admin.data),
        professional:
          mine === undefined
            ? null
            : {
                status: mine.status,
                displayName: mine.display_name,
                registrations: registrationsOf(mine),
                rejectionReason: mine.rejection_reason,
              },
      };
    },

    async requestAccess(input) {
      const { crn, cref } = input.registrations;
      const { error } = await client.rpc("request_professional_access", {
        p_display_name: input.displayName,
        p_crn_region: crn?.region ?? null,
        p_crn_number: crn?.number ?? null,
        p_cref_number: cref?.number ?? null,
        p_cref_region: cref?.region ?? null,
      });
      fail(error);
    },

    async listProfessionals() {
      const { data, error } = await client.rpc("admin_list_professionals");
      fail(error);
      return z
        .array(listRow)
        .parse(data)
        .map((row) => ({
          userId: row.user_id,
          email: row.email,
          displayName: row.display_name,
          registrations: registrationsOf(row),
          status: row.status,
          rejectionReason: row.rejection_reason,
          requestedAt: row.requested_at,
          reviewedAt: row.reviewed_at,
        }));
    },

    async approve(userId) {
      const { error } = await client.rpc("admin_review_professional", {
        p_user_id: userId,
        p_decision: "approve",
        p_reason: null,
      });
      fail(error);
    },

    async reject(userId, rejection) {
      const { error } = await client.rpc("admin_review_professional", {
        p_user_id: userId,
        p_decision: "reject",
        p_reason: rejection,
      });
      fail(error);
    },

    async setSuspended(userId, suspended) {
      const { error } = await client.rpc("admin_set_professional_suspended", {
        p_user_id: userId,
        p_suspended: suspended,
      });
      fail(error);
    },

    async listAudit() {
      const { data, error } = await client
        .from("admin_audit_log")
        .select("id,action,target_user_id,detail,created_at");
      fail(error);
      return z
        .array(auditRow)
        .parse(data)
        .map(
          (row): AuditEntry => ({
            id: row.id,
            action: row.action,
            targetUserId: row.target_user_id,
            displayName: row.detail.display_name,
            council: row.detail.council,
            reason: row.detail.reason ?? null,
            createdAt: row.created_at,
          }),
        )
        .sort((a, b) => b.id - a.id);
    },
  };
}
