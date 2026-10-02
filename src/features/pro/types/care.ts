/**
 * O vínculo entre profissional e paciente, e o convite que o cria (migração
 * 0034). Guardam a relação, nunca o conteúdo do paciente.
 */
export interface Sharing {
  readonly diary: boolean;
  /** Os treinos feitos (Etapa 6, migração 0039). Vínculo de antes começa sem. */
  readonly workouts: boolean;
  readonly body: boolean;
  readonly profile: boolean;
}

/** As opções que o paciente escolhe, na ordem em que aparecem. */
export const SHARING_OPTIONS: readonly { readonly key: keyof Sharing; readonly label: string; readonly hint: string }[] = [
  { key: "diary", label: "Diário alimentar", hint: "Refeições, alimentos e quantidades que você registrar." },
  { key: "workouts", label: "Treinos", hint: "Treinos feitos, séries e carga." },
  { key: "body", label: "Evolução física", hint: "Peso e medidas." },
  { key: "profile", label: "Dados do perfil", hint: "Idade, altura e objetivo." },
];

export function describeSharing(sharing: Sharing): string {
  const labels = SHARING_OPTIONS.filter((option) => sharing[option.key]).map((option) => option.label);
  // Neutro: a frase aparece para o paciente ("Ela vê") e para a profissional ("Vê").
  if (labels.length === 0) return "Só nome e e-mail";
  // Uma frase só: maiúscula só no começo ("Diário alimentar, evolução física e dados do perfil").
  const [first, ...rest] = labels.map((label, index) => (index === 0 ? label : label.toLowerCase()));
  if (rest.length === 0) return first!;
  return `${[first, ...rest.slice(0, -1)].join(", ")} e ${rest[rest.length - 1]!}`;
}

export type LinkStatus = "active" | "ended";

/** Quem acompanha o paciente, como ele vê. */
export interface MyCareLink {
  readonly linkId: string;
  readonly professionalName: string;
  readonly council: string;
  readonly status: LinkStatus;
  readonly sharing: Sharing;
  readonly createdAt: string;
  readonly endedAt: string | null;
}

/** Um paciente, como o profissional (ou o administrador) vê. */
export interface PatientLink {
  readonly id: string;
  readonly label: string;
  readonly status: LinkStatus;
  readonly sharing: Sharing;
  readonly createdAt: string;
  readonly endedAt: string | null;
}

export interface PendingInvite {
  readonly id: string;
  readonly label: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface CreatedInvite {
  readonly token: string;
  readonly expiresAt: string;
}

export type InviteState = "valid" | "used" | "expired" | "invalid";

export interface InviteInfo {
  readonly state: InviteState;
  readonly professionalName: string | null;
  readonly council: string | null;
  readonly isOwn: boolean;
}
