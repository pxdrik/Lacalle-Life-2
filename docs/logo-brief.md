# Brief da marca

A logo é o **único bloqueio** da sprint de redesign: o pedido cita o símbolo em
cinco lugares — cabeçalho, celular, favicon, carregamento e estado vazio — e ele
não existe. Este arquivo é o prompt para gerá-la e o que fazer com o resultado.

---

## O que existe hoje

Um **"L" branco sobre quase-preto**, em `src/app/icon.svg`:

```svg
<path d="M11 7h4.6v13.4H22V25H11z" fill="#ffffff" />
```

Nove caracteres de path. É placeholder honesto — diz a inicial e nada mais. Não
carrega o esmeralda, não diz saúde, treino ou nutrição, e é por isso que a
auditoria registrou que "tirando o nome do topo, não há forma, ícone ou
ilustração que seja só dele".

`apple-icon.tsx` **gera** o PNG do iOS a partir desse mesmo traço, de propósito:
uma imagem binária no repositório é uma segunda cópia da arte que sai do lugar
na primeira vez que uma das duas muda.

---

## As restrições que não são negociáveis

Elas vêm do código, não de gosto:

1. **Tem que virar path de SVG.** O ícone é path data commitada e o ícone do iOS
   é gerado a partir dela. Nada de gradiente, sombra, textura, 3D ou degradê —
   forma chapada, fechada, uma cor.
2. **Tem que sobreviver a 16px.** Favicon é o menor uso e o mais implacável.
   Se a ideia precisa de detalhe para ser lida, ela não serve.
3. **Tem que funcionar em duas cores de fundo**: `#080b0b` (escuro, o padrão do
   app) e `#f6f9f9` (claro). E tem que funcionar **em uma cor só**, porque no
   cabeçalho ela entra num chip monocromático.
4. **Não pode parecer SaaS, terminal ou ferramenta de desenvolvedor.** É o
   diagnóstico que abriu a sprint inteira. Tem que parecer app de saúde,
   nutrição e treino: moderno, confiável, agradável, acolhedor.

## A paleta

| Papel | Hex | Token |
| --- | --- | --- |
| A marca | `#009c60` | `oklch(0.58 0.2 167)` — o esmeralda da V1 |
| Fundo escuro | `#080b0b` | `--canvas` escuro |
| Fundo claro | `#f6f9f9` | `--canvas` claro |
| Sobre o esmeralda | `#0b0f0e` | `--accent-ink`, quase-preto |

O esmeralda é hue 167 e **não muda entre os temas** — é a identidade, medida da
V1. Ver o cabeçalho de `src/design-system/tokens.css`.

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

## O que fazer com o resultado

1. Vetorizar e reduzir a **um path**, ou poucos. Se não couber em path simples,
   a ideia não passou na restrição 1.
2. Substituir o `<path>` em `src/app/icon.svg`, mantendo o `viewBox="0 0 32 32"`
   e o `rect` de fundo.
3. **Não commitar PNG.** `apple-icon.tsx` regenera o do iOS a partir do traço;
   basta trocar o path lá também.
4. Conferir nos cinco lugares que o pedido cita: cabeçalho, celular, favicon,
   carregamento e estado vazio — e nos dois temas.
5. Riscar o bloqueio em `docs/roadmap.md`, seção _Identidade_.
