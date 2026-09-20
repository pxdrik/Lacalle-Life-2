// Eventos visuais do comercial, em quadros absolutos a 30 fps.
// ESPELHA src/Ad.tsx (Sequence from + deslocamentos locais). Este arquivo não altera nada no
// vídeo: é só a referência de sincronia do áudio. Se uma cena mudar de lugar em Ad.tsx,
// atualize aqui e rode `npm run audio`.
// Só sintaxe apagável (sem enum), para o Node importar direto.

export const FPS = 30;
export const DURATION = 900;

export const CUES = {
  hook: { lines: [6, 28, 50], exitStart: 86, exitEnd: 102 },
  logo: { start: 98, sharp: 124, exitStart: 164, exitEnd: 182 },
  agora: [128, 131, 134],
  stage: { enter: 168, settled: 212, exitStart: 778, exitEnd: 804 },
  dieta: { headline: 176, scroll: [202, 290] },
  diario: { cut: 292, taps: [322, 352], states: [326, 356], hoje: [386, 398] },
  treino: { cut: 402, ultimaVez: 422, taps: [442, 482, 522], states: [448, 488, 528] },
  evolucao: { cut: 582, scroll: [[622, 682], [698, 764]] },
  fechamento: { lines: [774, 784, 794], nada: [826, 830, 834], cta: [860, 880] },
} as const;

export const sec = (frame: number) => frame / FPS;
