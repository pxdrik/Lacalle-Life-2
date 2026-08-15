# Brief da marca

**Este documento está encerrado.** A marca existe desde 12/08/2026, o símbolo
entrou no app em 15/08/2026, e desde então a fonte de verdade da identidade é
outra: o **LaCalle Brand System V1.1**, com o resumo das decisões de aplicação
em `docs/brandbook.md` e o contrato técnico em `src/design-system/tokens.css`.

O que sobra aqui é histórico — o prompt que produziu a marca, e o registro de
como o bloqueio do vetor foi resolvido. Nada abaixo é normativo.

## Como o bloqueio do vetor caiu

A versão anterior desta página dizia:

> Falta o arquivo vetorial — traçar a fita a partir do PNG seria adivinhar curva
> por curva e o resultado ficaria pior que o original.

**Estava certa sobre a arte que tinha em vista, e errada sobre o que era
preciso.** A fita do brandbook é um render 3D em degradê, cuja leitura vem
inteira do sombreado; adivinhar aquilo de fato produziria algo pior. Mas a
versão que a pág. 8 do Brand System pede é outra — "em monocromia, usar a versão
de contorno preenchido" — e essa é a **silhueta do canal alfa**, que é um
contorno fechado, sem buracos e sem quinas.

Foi essa que foi traçada, em 15/08: canal alfa da arte, contorno seguido em
resolução 6×, reamostrado por comprimento de arco, ajustado em bézier cúbicas
com âncoras distribuídas por curvatura. **Divergência de 6,6% de área contra o
original, quase toda a franja de antialias de 1 px.**

O maior render do símbolo em qualquer um dos dois brandbooks mede **139 × 137
px** — é o teto disponível, e uma curva ajustada em cima dele fica melhor que
ele. Quando o vetor oficial da pág. 51 existir, ele substitui duas constantes em
`src/design-system/brand/mark.ts` e nada mais muda.

As quatro restrições que a versão anterior listou como não negociáveis foram
todas atendidas, e continuam valendo para qualquer arte futura: **um path
fechado e chapado**, **legível a 16 px** (com a variante de ajuste óptico que a
pág. 15 exige para isso), **funcional em uma cor só** via `currentColor`, e
**sem cara de ferramenta de desenvolvedor**, que foi o diagnóstico que abriu a
sprint do redesign.

---

## O prompt

> Design a flat vector logo mark for "Lacalle Life", a personal health app for
> nutrition tracking and strength training. Not a wordmark — a single symbol
> that works alone.
>
> **Form:** one continuous, confident shape built from an open circular arc —
> a ring that does not quite close. The ring is the app's signature graphic: it
> is how the app already draws the calories left in a day. Integrate the letter
> **L** into or against that arc so the mark reads both as a progress ring and
> as an initial, without either one being decoration on top of the other.
>
> **Style:** geometric, even stroke weight, generous rounded stroke caps, wide
> negative space. Calm and human, not clinical. It should feel like a modern
> fitness and nutrition app — warm, trustworthy, encouraging — and must not
> feel like a developer tool, a dashboard, a terminal or enterprise software.
>
> **Colour:** a single emerald green, `#009c60`, on a near-black `#080b0b`
> background. Flat fill only — no gradients, no shadows, no bevel, no glow, no
> 3D, no texture.
>
> **Constraints:** must remain legible at 16×16 pixels; must survive being
> rendered in one flat colour; must be reducible to simple SVG path data.
> Centred, on a square canvas, with clear margin around the mark. No text, no
> letters other than the L, no tagline, no border, no background pattern, no
> mockup, no photorealism.

### Variações para gerar junto

Gere as quatro e compare lado a lado a 16px, não a 512px:

1. **Anel + L** — a do prompt acima.
2. **Só o anel aberto**, sem letra, com a abertura na diagonal superior direita.
   Testa se a marca sobrevive sem a inicial — costuma ser a mais forte a 16px.
3. **L formado pelo próprio traço do anel**, onde a haste vertical e a base do
   L *são* segmentos do círculo em vez de linhas retas coladas nele.
4. **Marca de folha ou chama abstrata dentro do anel** — o caminho mais
   "bem-estar". Cuidado: é o que mais escorrega para clip-art genérico de
   academia.

### O que rejeitar de cara

- Halter, garfo e faca, coração com batimento, maçã, bíceps. São o vocabulário
  óbvio, e o app já usa halter e talher como **ícones de navegação** — repetir
  um deles na marca apaga a diferença entre "a marca" e "uma seção".
- Qualquer coisa que só leia a 128px.
- Duas cores, contorno externo, ou fundo que faz parte da forma.
- Letra dentro de um quadrado arredondado — é o placeholder de hoje.

---

## Onde a marca vive hoje

Nenhum destes é escolha deste documento — os três primeiros vêm da pág. 50 do
Brand System, e o último é a tradução dela para um app sem repositório de marca
separado.

| Arquivo | Papel |
| --- | --- |
| `src/design-system/brand/mark.ts` | **A única fonte da forma.** Os dois paths e a construção do ícone. |
| `src/design-system/brand/signature.tsx` | `Mark` e `Signature`, com a construção da pág. 10 como `calc()`. |
| `src/app/icon.svg` | Favicon: gradiente 150°, símbolo a 46%, raio a 22,5%. |
| `src/app/apple-icon.tsx` | Ícone do iOS, gerado — sangria total, sem raio. |
| `public/icon-maskable.svg` | Android, sangria total, símbolo dentro da zona segura. |
| `src/design-system/brand/mark.test.ts` | Prova que os SVGs de disco não divergiram do módulo. |

**Não commitar PNG.** O do iOS é gerado; um binário no repositório é uma segunda
cópia da arte que sai do lugar na primeira vez que uma das duas muda.
