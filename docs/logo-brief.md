# Brief da marca

**A marca existe** desde 12/08/2026. O prompt abaixo fica registrado porque foi
o que a produziu; o que importa agora é o estado e o que falta.

## Estado

- ✅ **A paleta é a da logo**, nos dois temas, com todas as duplas de contraste
  aferidas em `tokens.test.ts`. Ver a seção _A paleta_ mais abaixo.
- ✅ **O nome virou `LaCalle Life`**, com C maiúsculo, como a marca escreve — e
  o wordmark do cabeçalho ficou em duas cores: `LaCalle` em tinta, `Life` em
  esmeralda.
- ⏳ **O símbolo ainda não está no app.** Continua o "L" placeholder em
  `src/app/icon.svg`. **Falta o arquivo vetorial** — traçar a fita a partir do
  PNG seria adivinhar curva por curva e o resultado ficaria pior que o
  original. Com o SVG em mãos, são os cinco lugares da lista no fim.

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

As oito cores que vieram com a marca, e onde cada uma foi parar:

| Swatch | Hex | Papel no app |
| --- | --- | --- |
| emerald-500 | `#10B981` | `--accent` no **escuro** |
| emerald-600 | `#059669` | `--accent` no **claro** |
| emerald-800 | `#065F46` | `--accent-text` no claro |
| slate-900 | `#0F172A` | `--canvas` escuro, `--ink` claro, e a tinta sobre o verde |
| slate-800 | `#1E293B` | `--surface` escuro |
| slate-700 | `#334155` | `--muted` escuro |
| slate-200 | `#E2E8F0` | base dos cinzas claros |
| branco | `#FFFFFF` | `--surface` claro |

Três coisas medidas que decidiram o resto:

1. **Branco sobre o esmeralda reprova** — 2,54:1 no emerald-500 e 3,77:1 no
   600. A tinta sobre o verde é slate-900, que mede 7,04 e 4,74. É a mesma
   armadilha em que a V1 caiu com o próprio botão primário.
2. **A marca é um degradê, então cada tema pega o passo que funciona no seu
   fundo.** O emerald-500 não chega aos 3:1 que um gráfico deve numa página
   branca (2,31); o 600 chega (3,44). No escuro, 500 lê 7,04 contra 4,73 do
   600. Os dois passos são da marca — nenhum foi inventado.
3. **As superfícies são slate, não verdes.** A apresentação tem brilho verde em
   volta de tudo, mas as oito cores nomeiam **quatro slates e nenhuma
   superfície verde**. Isso é atmosfera de mockup; a paleta é a especificação —
   e é o que impede o app de voltar a parecer terminal, que foi o diagnóstico
   que abriu a sprint.

Tudo aferido em `src/design-system/tokens.test.ts`: 67 asserções, e editar um
valor sem cumprir AA quebra o build.

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
