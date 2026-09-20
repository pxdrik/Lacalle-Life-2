// Linha do tempo do comercial, em quadros a 30 fps. É a FONTE ÚNICA de tempo: Ad.tsx monta as
// cenas a partir de T, e o áudio (src/audio e scripts/audio) lê CUES, derivado do mesmo T.
// Para mudar o ritmo, mude só T; nada mais precisa ser copiado.
// Só sintaxe apagável (sem enum), para o Node importar direto.

export const FPS = 30;

/**
 * "abs" = quadro absoluto do filme. "local" = relativo ao começo da própria cena.
 * Ritmo: gancho e logo curtos, rolagens e séries mais rápidas. O Diário segura ~0,9 s antes do
 * primeiro toque e o Hoje ("quanto ainda cabe no dia") segura ~1,3 s, como pedido antes.
 */
export const T = {
  hook: { lines: [4, 22, 40], exit: [74, 88], dur: 90 }, // local
  logo: { start: 76, mark: 22, words: 22, exit: [50, 66], dur: 66 }, // start abs, resto local
  stage: { enter: 128, settle: 38, exitStart: 690, exitEnd: 714 }, // abs (settle em quadros)
  dieta: { title: 134, scroll: [158, 234] }, // abs
  diario: { cut: 236, taps: [276, 302], states: [280, 306], hoje: [332, 344] }, // abs
  treino: { cut: 372, taps: [408, 444, 480], states: [414, 450, 486] }, // abs
  evolucao: { cut: 528, scroll: [[562, 612], [624, 676]] }, // abs
  close: { start: 684, dur: 116, lines: [2, 8, 14], dim: [30, 42], tudo: 32, cta: [58, 76] }, // start abs, resto local
} as const;

export const DURATION = T.close.start + T.close.dur; // 800 quadros = 26,7 s

/** Visão em quadros absolutos para o áudio (mesma forma de sempre). */
export const CUES = {
  hook: { lines: T.hook.lines, exitStart: T.hook.exit[0], exitEnd: T.hook.exit[1] },
  logo: {
    start: T.logo.start,
    sharp: T.logo.start + T.logo.mark,
    exitStart: T.logo.start + T.logo.exit[0],
    exitEnd: T.logo.start + T.logo.exit[1],
  },
  agora: [T.logo.start + T.logo.words, T.logo.start + T.logo.words + 3, T.logo.start + T.logo.words + 6],
  stage: { enter: T.stage.enter, settled: T.stage.enter + T.stage.settle, exitStart: T.stage.exitStart, exitEnd: T.stage.exitEnd },
  dieta: { headline: T.dieta.title, scroll: T.dieta.scroll },
  diario: T.diario,
  treino: { ...T.treino, ultimaVez: T.treino.cut + 20 },
  evolucao: T.evolucao,
  fechamento: {
    lines: T.close.lines.map((l) => T.close.start + l),
    tudo: [0, 1, 2, 3, 4].map((i) => T.close.start + T.close.tudo + 3 * i),
    cta: [T.close.start + T.close.cta[0], T.close.start + T.close.cta[1]],
  },
  /** Onde cada bloco de texto começa a entrar (o som de entrada acompanha). */
  text: {
    hook: T.hook.lines,
    agora: T.logo.start + T.logo.words,
    titles: [T.dieta.title, T.diario.cut, T.treino.cut, T.evolucao.cut],
    closeLines: T.close.start + T.close.lines[0],
    tudo: T.close.start + T.close.tudo,
    cta: T.close.start + T.close.cta[0],
  },
};

export const sec = (frame: number) => frame / FPS;
