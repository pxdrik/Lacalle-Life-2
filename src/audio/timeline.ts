// Eventos visuais do comercial, em quadros absolutos a 30 fps.
// ESPELHA src/Ad.tsx (Sequence from + deslocamentos locais). Este arquivo não altera nada no
// vídeo: é só a referência de sincronia do áudio. Se uma cena mudar de lugar em Ad.tsx,
// atualize aqui e rode `npm run audio`.
// Só sintaxe apagável (sem enum), para o Node importar direto.

export const FPS = 30;
/** 30 s originais + 36 quadros: a tela Diário aparece antes do 1º toque (+12) e a tela Hoje segura (+24). */
export const DURATION = 936;

export const CUES = {
  hook: { lines: [6, 28, 50], exitStart: 86, exitEnd: 102 },
  logo: { start: 98, sharp: 124, exitStart: 164, exitEnd: 182 },
  agora: [128, 131, 134],
  stage: { enter: 168, settled: 212, exitStart: 814, exitEnd: 840 },
  dieta: { headline: 176, scroll: [202, 290] },
  diario: { cut: 292, taps: [334, 364], states: [338, 368], hoje: [398, 410] },
  treino: { cut: 438, ultimaVez: 458, taps: [478, 518, 558], states: [484, 524, 564] },
  evolucao: { cut: 618, scroll: [[658, 718], [734, 800]] },
  fechamento: { lines: [810, 820, 830], tudo: [862, 865, 868, 871, 874], cta: [896, 916] },
} as const;

export const sec = (frame: number) => frame / FPS;
