import { z } from "zod";

import type { CareRepository } from "./care-repository";
import type { ProSupabaseClient } from "./supabase-pro-repository";
import type { PatientLink } from "../types/care";

const linkStatus = z.enum(["active", "ended"]);

const linkRow = z.object({
  id: z.string(),
  patient_label: z.string(),
  status: linkStatus,
  share_diary: z.boolean(),
  share_body: z.boolean(),
  share_profile: z.boolean(),
  created_at: z.string(),
  ended_at: z.string().nullable(),
});

const LINK_COLUMNS = "id,patient_label,status,share_diary,share_body,share_profile,created_at,ended_at";

function toPatientLink(row: z.infer<typeof linkRow>): PatientLink {
  return {
    id: row.id,
    label: row.patient_label,
    status: row.status,
    sharing: { diary: row.share_diary, body: row.share_body, profile: row.share_profile },
    createdAt: row.created_at,
    endedAt: row.ended_at,
  };
}

function fail(error: { readonly message: string } | null): void {
  if (error !== null) throw new Error(error.message);
}

const byNewest = <T extends { readonly createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt);

export function createSupabaseCareRepository(client: ProSupabaseClient): CareRepository {
  async function uid(): Promise<string> {
    const { data } = await client.auth.getUser();
    if (data.user === null) throw new Error("not authenticated");
    return data.user.id;
  }

  return {
    async getInvite(token) {
      const { data, error } = await client.rpc("get_invite", { p_token: token });
      fail(error);
      const [row] = z
        .array(
          z.object({
            state: z.enum(["valid", "used", "expired", "invalid"]),
            professional_name: z.string().nullable(),
            council: z.string().nullable(),
            is_own: z.boolean(),
          }),
        )
        .parse(data);
      return {
        state: row?.state ?? "invalid",
        professionalName: row?.professional_name ?? null,
        council: row?.council ?? null,
        isOwn: row?.is_own ?? false,
      };
    },

    async acceptInvite(token, sharing) {
      const { error } = await client.rpc("accept_invite", {
        p_token: token,
        p_share_diary: sharing.diary,
        p_share_body: sharing.body,
        p_share_profile: sharing.profile,
      });
      fail(error);
    },

    async listMyLinks() {
      const { data, error } = await client.rpc("my_care_links");
      fail(error);
      return z
        .array(
          z.object({
            link_id: z.string(),
            professional_name: z.string(),
            council: z.string(),
            status: linkStatus,
            share_diary: z.boolean(),
            share_body: z.boolean(),
            share_profile: z.boolean(),
            created_at: z.string(),
            ended_at: z.string().nullable(),
          }),
        )
        .parse(data)
        .map((row) => ({
          linkId: row.link_id,
          professionalName: row.professional_name,
          council: row.council,
          status: row.status,
          sharing: { diary: row.share_diary, body: row.share_body, profile: row.share_profile },
          createdAt: row.created_at,
          endedAt: row.ended_at,
        }));
    },

    async updateSharing(linkId, sharing) {
      const { error } = await client.rpc("update_link_sharing", {
        p_link_id: linkId,
        p_share_diary: sharing.diary,
        p_share_body: sharing.body,
        p_share_profile: sharing.profile,
      });
      fail(error);
    },

    async endLink(linkId) {
      const { error } = await client.rpc("end_link", { p_link_id: linkId });
      fail(error);
    },

    async createInvite(patientLabel) {
      const { data, error } = await client.rpc("create_invite", { p_patient_label: patientLabel });
      fail(error);
      const [row] = z.array(z.object({ token: z.string(), expires_at: z.string() })).parse(data);
      if (row === undefined) throw new Error("invite not created");
      return { token: row.token, expiresAt: row.expires_at };
    },

    async cancelInvite(inviteId) {
      const { error } = await client.rpc("cancel_invite", { p_invite_id: inviteId });
      fail(error);
    },

    async listMyPatients() {
      const me = await uid();
      // Filtro explícito pelo próprio id, como em toda leitura: o
      // administrador lê vínculos e convites dos outros (0034).
      const [links, invites] = await Promise.all([
        client.from("care_links").select(LINK_COLUMNS).eq("professional_id", me),
        client.from("care_invites").select("id,patient_label,created_at,expires_at").eq("professional_id", me).eq("status", "pending"),
      ]);
      fail(links.error);
      fail(invites.error);
      const now = Date.now();
      return {
        links: z.array(linkRow).parse(links.data).map(toPatientLink).sort(byNewest),
        invites: z
          .array(z.object({ id: z.string(), patient_label: z.string(), created_at: z.string(), expires_at: z.string() }))
          .parse(invites.data)
          .map((row) => ({ id: row.id, label: row.patient_label, createdAt: row.created_at, expiresAt: row.expires_at }))
          // Vencido não é "pendente" para quem lê: some da lista.
          .filter((invite) => Date.parse(invite.expiresAt) > now)
          .sort(byNewest),
      };
    },

    async listLinksOf(professionalId) {
      const { data, error } = await client.from("care_links").select(LINK_COLUMNS).eq("professional_id", professionalId);
      fail(error);
      return z.array(linkRow).parse(data).map(toPatientLink).sort(byNewest);
    },
  };
}
