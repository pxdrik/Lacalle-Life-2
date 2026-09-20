// Mixagem do comercial, em um lugar só. É lido pelo Remotion (AudioTrack.tsx) e pelos scripts
// (scripts/audio/*). Ajustes marcados "ao vivo" valem no Studio e no render na hora; os
// marcados "regerar" mexem no que está gravado nos stems e pedem `npm run audio`.
// Só sintaxe apagável (sem enum), para o Node importar direto.

export type AudioVersion = "v1" | "v2";
export type AudioProfile = "cinematic" | "mobile";
export type StemName = "music" | "impacts" | "ui" | "closing";

/** Qual trilha o `npm run render` usa. "v1" é a provisória; troque para "v2" ao aprovar. */
export const DEFAULT_AUDIO_VERSION: AudioVersion = "v1";
/** "cinematic": dinâmica ampla, para fones e telas grandes. "mobile": social, alto-falante de celular. */
export const DEFAULT_AUDIO_PROFILE: AudioProfile = "cinematic";

export const STEMS: readonly StemName[] = ["music", "impacts", "ui", "closing"];

export interface StemMix {
  /** Volume do stem em dB (ao vivo). 0 = como foi gerado. */
  gainDb: number;
  /** Quadro em que o stem começa a soar (ao vivo). O que estiver antes fica mudo. */
  inFrame: number;
  /** Quadro em que o stem termina de sair (ao vivo). */
  outFrame: number;
  fadeInFrames: number;
  fadeOutFrames: number;
  /** Desloca o stem inteiro no tempo (ao vivo). Positivo atrasa. */
  offsetFrames: number;
}

interface ProfileMix {
  /** Volume geral em dB (ao vivo). */
  masterDb: number;
  /** Fade de saída do conjunto, em quadros, terminando no último quadro. */
  masterFadeOutFrames: number;
  stems: Record<StemName, StemMix>;
}

const full = { inFrame: 0, outFrame: 900, fadeInFrames: 0, fadeOutFrames: 0, offsetFrames: 0 };

export const MIX: Record<AudioProfile, ProfileMix> = {
  cinematic: {
    masterDb: 0,
    masterFadeOutFrames: 20,
    stems: {
      // A música vai saindo aos poucos (803 a 851) e some antes da frase final: o CTA só aparece em 860.
      // Isso deixa ~300 ms de espaço para "Comece sem criar conta." ficar clara.
      music: { ...full, gainDb: 0, outFrame: 851, fadeOutFrames: 48 },
      impacts: { ...full, gainDb: 0 },
      ui: { ...full, gainDb: 0 },
      closing: { ...full, gainDb: 0 },
    },
  },
  mobile: {
    masterDb: 3,
    masterFadeOutFrames: 20,
    stems: {
      music: { ...full, gainDb: 0, outFrame: 851, fadeOutFrames: 48 },
      impacts: { ...full, gainDb: 0 },
      ui: { ...full, gainDb: 0 },
      closing: { ...full, gainDb: 0 },
    },
  },
};

/**
 * Parâmetros gravados nos stems (regerar com `npm run audio`).
 * Picos-alvo de cada stem depois do acabamento: definem o equilíbrio de base entre eles.
 */
export const SYNTH = {
  /** Pico-alvo de cada stem depois do acabamento: define o equilíbrio de base entre eles. */
  stemPeakDb: { music: -10, impacts: -7, ui: -15, closing: -12 } satisfies Record<StemName, number>,
  /** Teto de pico de cada stem antes da normalização. */
  stemCeilingDb: -2,
};

const lin = (db: number) => 10 ** (db / 20);

/** Ganho linear de um stem em um quadro da composição (janela de entrada/saída, fades, master). */
export function stemGain(profile: AudioProfile, stem: StemName, frame: number, totalFrames = 900): number {
  const p = MIX[profile];
  const m = p.stems[stem];
  if (frame < m.inFrame || frame >= m.outFrame) return 0;
  let g = lin(m.gainDb + p.masterDb);
  if (m.fadeInFrames > 0) g *= Math.min(1, (frame - m.inFrame) / m.fadeInFrames);
  if (m.fadeOutFrames > 0) g *= Math.min(1, (m.outFrame - frame) / m.fadeOutFrames);
  if (p.masterFadeOutFrames > 0) g *= Math.min(1, (totalFrames - frame) / p.masterFadeOutFrames);
  return Math.max(0, g);
}
