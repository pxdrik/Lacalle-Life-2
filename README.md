# Lacalle Life, comercial de 30 s

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

## Áudio v2 (direção sonora nova)

Estado: **em teste**. O padrão do `npm run render` ainda é a trilha provisória (v1). Para aprovar, troque
`DEFAULT_AUDIO_VERSION` para `"v2"` em `src/audio/config.ts`. Nada de cena, captura, texto ou animação depende disso.

Tudo é gerado por código, localmente. Quatro stems por perfil (`public/audio/v2/<perfil>/`, não versionados,
`npm run audio` regera em ~30 s): **music** (pad, sub, baixo, ritmo, arpejo, motivo), **impacts** (os três
"problemas" do gancho, o golpe de "Agora, um só.", transições), **ui** (toques, registros, séries, rolagens)
e **closing** (resolução de "Nada além disso." e assinatura). Dois perfis: **cinematic** (dinâmica ampla) e
**mobile** (social e alto-falante de celular: grave gerenciado, presença, crista menor, ~ -16 LUFS).

| Quero ajustar | Onde | Precisa regerar? |
| --- | --- | --- |
| Volume de música, impactos, UI, fechamento | `MIX[perfil].stems[stem].gainDb` em `src/audio/config.ts` | não, vale no Studio e no render |
| Volume geral | `MIX[perfil].masterDb` | não |
| Onde a trilha entra e sai, fades | `inFrame`, `outFrame`, `fadeInFrames`, `fadeOutFrames` | não |
| Deslocar um stem no tempo | `offsetFrames` | não |
| Espaço antes de "Comece sem criar conta." | `music.outFrame` e o vale gravado em `compose.mjs` (`duck`) | o vale sim |
| Equilíbrio de base entre stems | `SYNTH.stemPeakDb` | sim (`npm run audio`) |
| Notas, ritmo, timbre, momentos | `scripts/audio/compose.mjs` | sim |
| Quadros dos eventos do vídeo | `src/audio/timeline.ts` (espelha `Ad.tsx`) | sim |

Comandos: `npm run audio` (gera stems), `npm run audio:check -- cinematic --png` (loudness, pico, mono,
equilíbrio por seção, sincronia, espectrogramas em `out/audio-report/`), `npm run audio:selftest`,
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
