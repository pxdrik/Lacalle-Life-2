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

## O que trocar antes de publicar

- **Endereço do fechamento**: `CTA_URL` em `src/Ad.tsx`.
- **Trilha**: `public/audio/score.wav` é provisória. Qualquer faixa licenciada de 30 s no mesmo
  caminho substitui.
- **Recaptura**: `capture.mjs` usa o Life em execução; se as telas do app mudarem, rode
  `npm run capture` e depois `npm run render`.

## Dados de demonstração

Nada aqui toca os dados reais de ninguém: o navegador de captura tem perfil próprio e o backup
de demonstração só é importado nele.
