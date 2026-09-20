# Lacalle Life, comercial de 31,2 s

Vídeo feito em código com [Remotion](https://www.remotion.dev). As telas são capturas reais
do app (Playwright, dados de demonstração), nada é mockup redesenhado.

## Estrutura

| Pasta | O que tem |
| --- | --- |
| `src/` | A composição: `Ad.tsx` é a linha do tempo (30 fps, 900 quadros). |
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

## Áudio v2 (só efeitos, sem música)

Estado: **em teste**, e é o padrão do `npm run render`. O áudio não altera cena, captura, texto ou animação.

Sem música de fundo. Só dois tipos de som, ambos gerados por código, localmente e sem saturação:

- **Swooshes** (stem `swooshes`): um por troca de página, sempre ar filtrado, com o pico no meio do fade
  da tela. Sete no total: logo, aparelho sobe, Diário, Hoje, Treino, Evolução, aparelho sai. Os que vão "para
  frente" sobem de frequência; a saída do aparelho desce.
- **Cliques** (stem `clicks`): dois sons por toque, como um interruptor de verdade. O toque do dedo (corpo
  grave curto com um estalo macio) e, 4 a 6 quadros depois, um tique leve quando o item marca. Cinco toques
  no filme (2 no Diário, 3 no Treino).

A versão anterior, com a base sustentada, os baques do gancho, o golpe de "Agora, um só.", as três notas e a
resolução do fim, está no histórico do git (commit `790c853`), se algum desses sons precisar voltar.

Dois perfis: **cinematic** (~ -22 LUFS, pico -7 dBFS) e **mobile** (celular e social: sem subgrave, presença,
mais centrado, ~ -19 LUFS). `npm run audio` regera os stems em ~10 s (`public/audio/v2/<perfil>/`, não versionados).

| Quero ajustar | Onde | Precisa regerar? |
| --- | --- | --- |
| Volume dos swooshes ou dos cliques | `MIX[perfil].stems[stem].gainDb` em `src/audio/config.ts` | não, vale no Studio e no render |
| Volume geral | `MIX[perfil].masterDb` | não |
| Onde entram e saem, fades, deslocamento | `inFrame`, `outFrame`, `fadeInFrames`, `fadeOutFrames`, `offsetFrames` | não |
| Silenciar um dos dois | `gainDb: -Infinity` no stem | não |
| Equilíbrio de base entre os dois | `SYNTH.stemPeakDb` | sim (`npm run audio`) |
| Timbre, duração, nível de cada som | `scripts/audio/voices.mjs` e `compose.mjs` | sim |
| Quadros dos eventos do vídeo | `src/audio/timeline.ts` (espelha `Ad.tsx`) | sim |

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
