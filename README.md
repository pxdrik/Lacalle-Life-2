# Lacalle Life, comercial de 25,1 s

Vídeo feito em código com [Remotion](https://www.remotion.dev). As telas são capturas reais
do app (Playwright, dados de demonstração), nada é mockup redesenhado.

## Estrutura

| Pasta | O que tem |
| --- | --- |
| `src/` | A composição: `Ad.tsx` monta as cenas, e `src/timeline.ts` é a **fonte única de tempo** (30 fps, 752 quadros). |
| `scripts/capture.mjs` | Sobe um navegador limpo, importa dados de demonstração e captura as telas em `public/shots/`. |
| `scripts/demo-data.mjs` | Dados de demonstração (dieta, treinos, 10 semanas de histórico), montados sobre o catálogo real. |
| `scripts/score.mjs` | Trilha provisória sintetizada por código, sincronizada com os cortes e toques. |
| `public/` | Capturas, fontes (IBM Plex Sans) e a trilha. |

## Comandos

```bash
npm install
npm run studio        # pré-visualização com timeline
npm run render        # out/lacalle-life-9x16.mp4 (1080x1920, Reels/TikTok/Stories)
npm run render:wide   # out/lacalle-life-16x9.mp4 (1920x1080, site/YouTube)
npm run score         # regenera a trilha
npm run capture       # recaptura as telas (Life rodando em http://localhost:3000)
```

## Ritmo (src/timeline.ts)

Todo o tempo do filme mora em `T`, em `src/timeline.ts`. `Ad.tsx` monta as cenas a partir dele e o áudio lê o
mesmo `T` (por `CUES`), então mudar o ritmo é mexer só ali e rodar `npm run audio`. O filme tem 25,1 s: gancho e logo
curtos, rolagens e séries mais rápidas, texto entrando em 18 quadros. O Diário segura ~0,9 s antes do primeiro toque e o
Hoje ("quanto ainda cabe no dia") ~1,3 s, como pedido.
O Treino foi apertado a pedido (parecia uma "freada"): primeiro toque 0,9 s depois do corte e um toque a cada 0,8 s,
em vez de 1,2 s, e a virada para Evolução vem logo depois do "3/13 séries". Para afrouxar ou apertar de novo, mexa só em
`T.treino` (e no que vem depois, `T.evolucao`, `T.stage`, `T.close`, `T.callouts`, que andam junto).

## Retenção e CTA (recompensas)

Feito para prender: um gancho que quebra o padrão e uma recompensa visível a cada ganho, sem inventar número.

- **Gancho** (0 a 2,6 s): as três linhas ("Um app para a dieta. Outro para o treino. Outro para a evolução.") entram com
  "slam" (escala 1,35 para 1), e então cai um **"Chega."** grande em verde, a cena treme por 8 quadros e as três linhas
  escurecem. O texto do soco é `HOOK_PUNCH` em `src/Ad.tsx`.
- **Números em destaque** (`T.callouts`): uma pílula por ganho, um de cada vez, com o valor que já aparece na tela do
  app (dados de demonstração): 2.973 kcal de meta, 1.588 kcal registrados, 1.385 kcal restantes, séries 3/13, +2,4 kg
  em 9 semanas, recorde de 1RM de 223,3 kg. Nada de estatística inventada.
- **Checks**: cada item marcado dá um estouro (anel e pontos) no botão, um "soquinho" no aparelho e um brilho verde no fundo.
- **CTA**: o fecho segura ~2,3 s inteiro. As três linhas, "Tudo em um lugar só.", a marca, o botão **"Experimentar agora"**
  (aparece com pop, pulsa chamando o toque e é "tocado" com uma onda), "Sem criar conta." e o endereço. O rótulo do botão
  está em `CtaButton` (`src/Reward.tsx`); o endereço, em `CTA_URL` (`src/Ad.tsx`). Só se afirma o que é verdade
  (sem conta, sim; "grátis", não).

## Áudio v2 (só efeitos, sem música)

Estado: **em teste**, e é o padrão do `npm run render`. O áudio não altera cena, captura, texto ou animação.

Sem música de fundo. Quatro tipos de som, todos gerados por código, localmente e sem saturação:

- **Swooshes** (stem `swooshes`): um "swish" por troca de página, ar filtrado em banda estreita (curto, 0,24 a 0,5 s, sem
  corpo grave e sem cauda longa), com o pico no meio do fade da tela. É o som mais baixo dos efeitos de página, mas
  continua 9 a 13 dB acima do resto no próprio instante. Sete: logo, aparelho sobe, Diário, Hoje, Treino, Evolução,
  aparelho sai. (O swoosh anterior, de 0,4 a 0,9 s em 400 a 4200 Hz, destoava dos cliques e dos pops.)
- **Cliques** (stem `clicks`): o toque do dedo (corpo grave curto com estalo macio). Cinco toques (2 Diário, 3 Treino).
  Quem responde ao toque, 4 quadros depois, é o pop do stem `rewards`.
- **Texto** (stem `text`): uma pequena subida aguda e curta na hora em que cada bloco de texto entra, mais aguda que
  o swoosh de página para os dois não se confundirem. Sete: "Agora, um só.", os quatro títulos, as linhas do fecho
  (um som só) e "Tudo em um lugar só.".
- **Recompensas** (stem `rewards`): um som por ganho, no quadro em que ele aparece. Três pops que sobem no gancho
  (ré, fá sustenido, lá) e uma batida grave no "Chega."; um pop a cada check que sobe de nota (fecha em ré agudo); um
  "ding" de vidro macio nos números em destaque (o que cai junto de um check não repete); e no CTA, um pop na entrada do
  botão e, no toque, o estalo do dedo com um arpejo curto (ré e lá agudos).

A versão com música (base, baques, golpe, notas, resolução) está no histórico do git (commit `790c853`).

### Versão com música (opcional)

A trilha original é um arquivo à parte: **não entra nos renders padrão**, que continuam só com efeitos. Ela é
gerada por `npm run audio:music` (`scripts/audio/music.mjs`, ~10 s) e entra quando a composição recebe
`music: true` (`props/cinematic-musica.json`, `props/mobile-musica.json`, ou `npm run render:musica`).

Ambient eletrônico minimalista, ré maior, 100 bpm, sem bateria e sem melodia marcante. Poucas camadas por vez:
pad profundo, ar (textura), grave limpo que "respira", pequenos pulsos tonais em grupos de 3+3+2 e sete notas
soltas. O arco acompanha as cenas: quase vazio no gancho e na abertura, pulso sutil quando o aparelho entra, mais
densidade no treino, pico em "Tudo em um lugar só." e um release curto sob a chamada, com cauda limpa. A grade
de compassos é ancorada nessa frase e as seções vêm de `src/timeline.ts`, então retimar o filme move a música.
Volume próprio: `music.gainDb` em `src/audio/config.ts`. Verificação: `npm run audio:check -- cinematic --music --png`.

Dois perfis: **cinematic** (~ -22 LUFS, pico -7 dBFS) e **mobile** (celular e social: sem subgrave, presença, mais
centrado, ~ -19 LUFS). `npm run audio` regera os stems em ~15 s (`public/audio/v2/<perfil>/`, não versionados).

| Quero ajustar | Onde | Precisa regerar? |
| --- | --- | --- |
| Volume dos swooshes, cliques, texto ou recompensas | `MIX[perfil].stems[stem].gainDb` em `src/audio/config.ts` | não, vale no Studio e no render |
| Volume geral | `MIX[perfil].masterDb` | não |
| Onde entram e saem, fades, deslocamento | `inFrame`, `outFrame`, `fadeInFrames`, `fadeOutFrames`, `offsetFrames` | não |
| Silenciar um dos dois | `gainDb: -Infinity` no stem | não |
| Equilíbrio de base entre os dois | `SYNTH.stemPeakDb` | sim (`npm run audio`) |
| Timbre, duração, nível de cada som | `scripts/audio/voices.mjs` e `compose.mjs` | sim |
| Texto do soco, do botão, quais números aparecem | `HOOK_PUNCH` (`Ad.tsx`), `CtaButton` (`Reward.tsx`), `T.callouts` (`timeline.ts`) | só o vídeo, nada de áudio se o tempo não mudar |
| Ritmo do filme (quando cada coisa acontece) | `T` em `src/timeline.ts` | sim (`npm run audio`) e re-render do vídeo |

Comandos: `npm run audio` (gera stems), `npm run audio:check -- cinematic --png` (loudness, pico, mono,
equilíbrio por seção, sincronia, espectrogramas em `out/audio-report/`), `npm run audio:selftest`, `node scripts/audio/clicks.mjs arquivo.wav` (procura estalos),
`npm run render:mobile` e `npm run render:wide:mobile` (MP4 com o perfil mobile).

Para ouvir sem re-renderizar o vídeo: `npx remotion render Ad out/test/audio-cinematic.wav --codec=wav
--props=props/cinematic.json` e `node scripts/audio/mux.mjs cinematic`, que troca só o áudio e copia o
stream de vídeo sem tocar nele.

## O que trocar antes de publicar

- **Endereço do fechamento**: `CTA_URL` em `src/Ad.tsx`.
- **Trilha**: `public/audio/score.wav` é provisória. Qualquer faixa licenciada de 30 s no mesmo
  caminho substitui.
- **Recaptura**: `capture.mjs` usa o Life em execução; se as telas do app mudarem, rode
  `npm run capture` e depois `npm run render`.

## Dados de demonstração

Nada aqui toca os dados reais de ninguém: o navegador de captura tem perfil próprio e o backup
de demonstração só é importado nele.
