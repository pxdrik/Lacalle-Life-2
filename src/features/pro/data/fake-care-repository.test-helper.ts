import type { CareRepository } from "./care-repository";
import type { InviteInfo, MyCareLink, PatientLink, PendingInvite, Sharing } from "../types/care";

/**
 * Um `CareRepository` em memória para testes de tela. As regras (quem pode
 * convidar, aceitar, mudar, encerrar) são testadas contra o banco em
 * `care-links.db.test.ts` e `supabase-care-repository.db.test.ts`.
 */
export function fakeCareRepository(options: {
  readonly invite?: InviteInfo;
  readonly myLinks?: readonly MyCareLink[];
  readonly links?: readonly PatientLink[];
  readonly invites?: readonly PendingInvite[];
}): CareRepository & { readonly calls: string[] } {
  const calls: string[] = [];
  let myLinks = [...(options.myLinks ?? [])];
  let links = [...(options.links ?? [])];
  let invites = [...(options.invites ?? [])];
  const flags = (s: Sharing) => `${s.diary ? "D" : "-"}${s.workouts ? "T" : "-"}${s.body ? "E" : "-"}${s.profile ? "P" : "-"}`;

  return {
    calls,
    getInvite: () =>
      Promise.resolve(options.invite ?? { state: "invalid", professionalName: null, council: null, isOwn: false }),
    acceptInvite: (token, sharing) => {
      calls.push(`accept:${token}:${flags(sharing)}`);
      return Promise.resolve();
    },
    listMyLinks: () => Promise.resolve(myLinks),
    updateSharing: (linkId, sharing) => {
      calls.push(`share:${linkId}:${flags(sharing)}`);
      myLinks = myLinks.map((link) => (link.linkId === linkId ? { ...link, sharing } : link));
      return Promise.resolve();
    },
    endLink: (linkId) => {
      calls.push(`end:${linkId}`);
      const endedAt = "2026-10-01T12:00:00.000Z";
      myLinks = myLinks.map((link) => (link.linkId === linkId ? { ...link, status: "ended", endedAt } : link));
      links = links.map((link) => (link.id === linkId ? { ...link, status: "ended", endedAt } : link));
      return Promise.resolve();
    },
    createInvite: (label) => {
      calls.push(`invite:${label}`);
      invites = [
        { id: `i-${label}`, label, createdAt: "2026-10-01T12:00:00.000Z", expiresAt: "2099-10-08T12:00:00.000Z" },
        ...invites,
      ];
      return Promise.resolve({ token: "abc123", expiresAt: "2099-10-08T12:00:00.000Z" });
    },
    cancelInvite: (id) => {
      calls.push(`cancel:${id}`);
      invites = invites.filter((invite) => invite.id !== id);
      return Promise.resolve();
    },
    listMyPatients: () => Promise.resolve({ links, invites }),
    listLinksOf: () => Promise.resolve(links),
  };
}

export function patientLink(overrides: Partial<PatientLink> & { readonly id: string }): PatientLink {
  return {
    label: "Ana Luísa Prado",
    status: "active",
    sharing: { diary: true, workouts: false, body: true, profile: false },
    createdAt: "2026-07-03T12:00:00.000Z",
    endedAt: null,
    ...overrides,
  };
}

export function myLink(overrides: Partial<MyCareLink> & { readonly linkId: string }): MyCareLink {
  return {
    professionalName: "Marina Faria",
    council: "CRN-3 12345",
    status: "active",
    sharing: { diary: true, workouts: false, body: true, profile: true },
    createdAt: "2026-07-03T12:00:00.000Z",
    endedAt: null,
    ...overrides,
  };
}
