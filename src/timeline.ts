// Linha do tempo do comercial, em quadros a 30 fps. É a FONTE ÚNICA de tempo: Ad.tsx monta as
// cenas a partir de T, e o áudio (src/audio e scripts/audio) lê CUES, derivado do mesmo T.
// Para mudar o ritmo, mude só T; nada mais precisa ser copiado.
// Só sintaxe apagável (sem enum), para o Node importar direto.

export const FPS = 30;

/**
 * "abs" = quadro absoluto do filme. "local" = relativo ao começo da própria cena.
 * Ritmo pensado para prender: gancho que estoura em 2,6 s ("Chega."), uma recompensa visível a
 * cada ganho (callouts e estouros de check) e um CTA com botão e pausa longa (~2,3 s inteiro).
 */
export const T = {
  hook: { lines: [3, 17, 31], chega: 46, exit: [64, 76], dur: 78 }, // local (a cena começa em 0)
  logo: { start: 64, mark: 20, words: 20, exit: [44, 58], dur: 60 }, // start abs, resto local
  stage: { enter: 108, settle: 36, exitStart: 626, exitEnd: 650 }, // abs (settle em quadros)
  dieta: { title: 114, scroll: [136, 208] }, // abs
  diario: { cut: 210, taps: [250, 276], states: [254, 280], hoje: [306, 318] }, // abs
  treino: { cut: 346, taps: [374, 398, 422], states: [380, 404, 428] }, // abs (toques a cada 0,8 s, sem freada)
  evolucao: { cut: 464, scroll: [[498, 548], [560, 612]] }, // abs
  close: { start: 620, dur: 132, lines: [2, 8, 14], dim: [24, 34], tudo: 26, cta: [50, 64], press: 92 }, // start abs, resto local
  /**
   * Recompensas: um número em destaque por ganho. Os valores são os que aparecem na própria tela
   * (dados de demonstração do app). Um de cada vez, sem sobrepor.
   */
  callouts: [
    { at: 142, dur: 40, value: "2.973", label: "kcal de meta" }, // dieta
    { at: 282, dur: 30, value: "1.588", label: "kcal registrados" }, // diário (805 + 783)
    { at: 320, dur: 32, value: "1.385", label: "kcal restantes" }, // hoje
    { at: 430, dur: 30, value: "3/13", label: "séries" }, // treino
    { at: 474, dur: 36, value: "+2,4", label: "kg em 9 semanas" }, // evolução (73,4 → 75,8)
    { at: 570, dur: 34, value: "223,3 kg", label: "recorde de 1RM" }, // evolução (recordes)
  ],
} as const;

export const DURATION = T.close.start + T.close.dur; // 752 quadros = 25,1 s

/** Visão em quadros absolutos para o áudio. */
export const CUES = {
  hook: { lines: T.hook.lines, exitStart: T.hook.exit[0], exitEnd: T.hook.exit[1] },
  hookChega: T.hook.chega,
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
  /** O botão do CTA: quando aparece e quando é "tocado". */
  botao: { pop: T.close.start + T.close.cta[0], press: T.close.start + T.close.press },
  /** Instantes das recompensas (o som acompanha). */
  callouts: T.callouts.map((c) => c.at),
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
