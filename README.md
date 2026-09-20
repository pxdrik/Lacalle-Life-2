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

## Áudio v2 (mínimo, com suspense)

Estado: **em teste**, e já é o padrão do `npm run render` (a trilha v1 tem 30 s e não cobre os 31,2 s do vídeo;
os arquivos dela continuam em `public/audio/score.wav` para voltar atrás). Para voltar: `DEFAULT_AUDIO_VERSION = "v1"`
em `src/audio/config.ts`. O áudio não altera cena, captura, texto ou animação.

Direção: pouquíssimo som, limpo (nada de saturação), muito ar e silêncio. Uma base em ré com **quarta suspensa
(sol)** que fica "pendurada" o filme inteiro e só resolve na **terça maior (fá sustenido)** quando aparece
"Tudo em um lugar só.". O fá sustenido não aparece em nenhum outro lugar, então a chegada soa como resolução.

O que existe, e mais nada: a base (só o filtro abre com a narrativa), três baques no gancho, um golpe limpo em
"Agora, um só.", **um swoosh por troca de página** (seis, sempre a mesma família de ar filtrado, com o pico no
meio do fade da tela), **três notas** (uma por página, na escala da base) e a resolução mais a assinatura do
fim. Tudo é gerado por código, localmente.

Quatro stems por perfil (`public/audio/v2/<perfil>/`, não versionados; `npm run audio` regera em ~40 s):
**music** (a base), **impacts** (baques, sopro até o logo, golpe e swooshes), **ui** (as três notas) e **closing**
(resolução e assinatura). Dois perfis: **cinematic** (~ -20 LUFS, pico -7 dBFS) e **mobile** (celular e social:
sem subgrave, presença, mais centrado, ~ -18 LUFS).

Para silenciar as notas: `ui.gainDb: -99`. Para tirar os swooshes: `impacts.gainDb: -99` (leva junto o golpe e os baques).

| Quero ajustar | Onde | Precisa regerar? |
| --- | --- | --- |
| Volume de música, impactos, UI, fechamento | `MIX[perfil].stems[stem].gainDb` em `src/audio/config.ts` | não, vale no Studio e no render |
| Volume geral | `MIX[perfil].masterDb` | não |
| Onde a trilha entra e sai, fades | `inFrame`, `outFrame`, `fadeInFrames`, `fadeOutFrames` | não |
| Deslocar um stem no tempo | `offsetFrames` | não |
| Espaço antes de "Comece sem criar conta." | `music.outFrame` e o vale gravado em `compose.mjs` (`duck`) | o vale sim |
| Equilíbrio de base entre stems | `SYNTH.stemPeakDb` | sim (`npm run audio`) |
| Notas, harmonia, timbre, momentos | `scripts/audio/compose.mjs` | sim |
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
