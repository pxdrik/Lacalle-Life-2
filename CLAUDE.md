# Como trabalhar neste projeto

As regras de produto e de arquitetura estão em `AGENTS.md` e não são repetidas
aqui. Este arquivo é sobre **processo**: como implementar, o que verificar
antes de dizer "pronto", e os erros que já custaram tempo.

---

## O projeto está em fase de estabilização

Decidido em 25/09/2026, depois de uma auditoria
(`_docs-auditoria/auditoria-regressoes-2026-09-25.md`) motivada por um
padrão que já custava mais tempo do que as features rendiam:

```
feature → bug → patch → outro bug → outro patch → CSS cada vez mais complexo
```

O objetivo desta fase **não é implementar rápido**. É implementar sem criar
regressão. O que se otimiza aqui é estabilidade, previsibilidade, causa raiz
e validação — nunca quantidade de código.

Duas perguntas emolduram toda mudança. Antes:

> Se eu implementar assim, o que mais pode quebrar?

Depois:

> Como eu provo que não quebrou?

A primeira etapa da fase fechou em 26/09/2026: a geometria da aba Treino
passou a ter uma fonte única de colunas, as 112 medições de navegador ficaram
verdes, e **`npm run test:browser` entrou no `verify` e na CI**. A partir daí,
quebrar alinhamento, transbordo ou área de toque derruba o portão do mesmo
jeito que quebrar um teste unitário sempre derrubou.

---

## Ao terminar, sempre

1. `npm run verify` verde. São quatro coisas, nesta ordem: typecheck, lint,
   testes unitários (`--project unit`) e testes de navegador
   (`--project browser`). Layout, geometria, transbordo, hitbox e viewport
   estão cobertos pelo último, e só por ele — jsdom não tem motor de layout.
2. `npm run build` passando.
4. **Commit e push.** Toda entrega termina no GitHub, sem precisar ser pedido.
   Trabalho que existe só na máquina não existe. `.github/workflows/ci.yml`
   roda os mesmos comandos em todo push/PR — não substitui rodar local antes
   de empurrar, é a rede de segurança para quando alguém esquecer.
5. Atualizar `docs/roadmap.md` quando um item sair ou entrar. O documento
   existe para não depender da memória de nenhuma conversa — um roadmap que
   lista como pendente algo já entregue é pior que nenhum.

Mensagens de commit em português, explicando **por que**, não o que o diff já
mostra. Escreva a mensagem num arquivo e use `git commit -F` — here-strings do
PowerShell quebram com aspas.

**Um checkpoint por etapa estável.** Feature, refatoração estrutural e
mudança visual não viajam no mesmo commit. O histórico tem que permitir
voltar para "baseline estável → feature A estável → feature B estável", e não
para um commit gigante com quinze coisas misturadas. Quanto maior o diff,
maior o risco de regressão e menor a chance de achar qual parte a causou.

---

## Definição de pronto

Compilar, passar no TypeScript, passar no lint e passar nos testes unitários
**não é pronto**. Pronto é:

```
[ ] funcionalidade implementada
[ ] comportamento existente preservado
[ ] testes relevantes passando
[ ] Browser Mode passando, quando aplicável
[ ] desktop validado
[ ] mobile validado
[ ] toque/hitbox validado, quando aplicável
[ ] sem overflow inesperado
[ ] sem elementos sobrepostos
[ ] textos alinhados
[ ] estados intermediários funcionando
[ ] persistência funcionando, quando aplicável
[ ] npm run verify passando
[ ] nenhuma regressão conhecida
```

Se algum item falhou, diga qual falhou. Nunca "quase tudo passou".

---

## Ordem de trabalho

### Antes de codar: inspeção

Nenhuma alteração começa pelo trecho que parece visualmente errado. Primeiro:

1. **Localizar** os componentes, hooks, funções, estilos e testes envolvidos.
2. **Entender** o que o componente já faz, quais estados ele tem, e **quem
   controla aquele layout** — que frequentemente não é o arquivo onde o
   problema aparece.
3. **Identificar dependências**: componentes compartilhados, classes
   reutilizadas, estado compartilhado, props, hooks, cálculo, persistência,
   sincronização, testes existentes, e outras telas que usam o mesmo
   componente. `grep -rl` no nome do componente é o piso, não o teto.
4. **Declarar o impacto**, antes de implementar:

   - arquivos que serão alterados
   - arquivos que provavelmente **não** precisam ser alterados
   - riscos de regressão
   - como vou validar

Para mudança pequena isso é um parágrafo, não um relatório. Mas existe.

### Implementar

5. Implementar a menor mudança que resolve a **causa**, não o sintoma.
6. Lint e testes.
7. Corrigir.
8. Revisão crítica: isso precisava existir? Existe forma mais simples? Existe
   componente duplicado? Código morto? Estado ilegal que o tipo poderia ter
   impedido?

### Depois

9. Testar a funcionalidade alterada.
10. Rodar os testes relacionados. Durante o trabalho vale rodar um projeto de
    cada vez (`npm run test`, `npm run test:browser`), que é mais rápido.
11. `npm run verify`, que roda os dois e é o que a CI roda.
12. Verificar se outros componentes foram afetados.
13. Comparar desktop e mobile.

---

## Se aparecer uma regressão, pare

Não empilhe outro patch em cima. Não continue implementando outra feature por
cima dela. A sequência é:

```
identificar → reproduzir → localizar a causa → corrigir a causa →
rodar os testes → validar visualmente → só então continuar
```

Um patch que esconde o sintoma sem tocar na causa transforma um bug em dois:
o original, que continua lá, e a compensação, que agora também tem que ser
mantida.

### Problema que apareceu mas não é da tarefa

Classifique e não saia consertando tudo:

- **Bloqueador** — impede a tarefa, ou causa corrupção ou perda de dado.
  Trate agora, e diga que está tratando.
- **Regressão** — foi causada por esta alteração. Volte à causa.
- **Bug pré-existente** — já existia. Registre e deixe, salvo se bloquear.
- **Melhoria futura** — registre e deixe.

---

## Layout: uma fonte de verdade para geometria

### Proibido resolver estrutura com compensação

`margin-left`, `translate-x`, `translate-y`, `top`, `left`, `right`, largura
arbitrária, offset para uma tela específica, `overflow-hidden` para esconder
o problema, `z-index` para mascarar sobreposição, `opacity: 0` para sumir com
o que incomoda, ajuste só para 360/375/390px.

Nada disso é proibido **como parte de uma solução estrutural correta**. É
proibido como tentativa de fazer caber. Se três elementos estão desalinhados
porque cada um tem a largura definida num lugar diferente, a correção é
unificar a origem da geometria, não somar três offsets.

O sinal de alerta é o comentário que explica o offset. Este projeto já teve
`border-l-[3px] px-1 gap-px` acrescentado a um cabeçalho para compensar 7px
de deslocamento, documentado no código como se fosse a solução. Era o bug
escrito por extenso.

### Quando a interface é uma tabela, ela tem uma grade

Não isto:

```
Header   → larguras próprias
Linha    → larguras próprias
Controle → outra largura
Input    → outra largura
Mobile   → outra regra inteira
```

As mesmas colunas, determinadas por uma lógica só, que cabeçalho e conteúdo
respeitam. Se uma alteração exigir duplicar valores de largura de novo, pare
e procure a solução estrutural antes de duplicar.

### `zoom` é o multiplicador escondido

`tokens.css` aplica `html { zoom: var(--ui-scale) }` e cancela o zoom só nos
campos: `input, select, textarea { zoom: calc(1 / var(--ui-scale)) }`. Duas
consequências que não estão escritas em nenhum componente:

- `w-16` num `<span>` e `w-16` num `<input>` **não têm a mesma largura na
  tela**. Dimensionar uma linha misturando os dois sem medir é acidente
  esperando acontecer.
- **A densidade muda a largura útil do layout.** Em 390px: Compacto dá 390
  unidades, Padrão 339, Confortável 300. É contraintuitivo e é por isso que
  uma linha pode caber em "Compacto" e estourar em "Confortável" na mesma
  tela.

### Densidade e viewport, sempre os três e os cinco

Alteração visual relevante se valida em **320, 360, 375, 390, 414 e desktop**,
nas três densidades (Compacto, Padrão, Confortável). Uma densidade não pode
"corrigir" um problema escondendo overflow.

Quando fizer sentido, valide também viewport alto e baixo, toque, teclado
virtual, safe areas, scroll, elementos `fixed`/`sticky`, e WebView/Capacitor.

**Reduzir a janela do desktop não substitui validação mobile.** Não neste
projeto especificamente: a janela testa uma largura, e o aparelho pode estar
noutra densidade, com outra largura de layout na mesma largura física. Fora
isso, `sm:` a 640px separa dois comportamentos inteiros, `hover` não existe
no toque, e `touch-44` é invisível em qualquer captura de tela.

### "Está desalinhado" se investiga com número

Nunca mova 2px no olho. Compare os elementos que deveriam compartilhar
geometria e descubra quem diverge:

```
header.column.x   vs  row.column.x
header.column.width  vs  row.column.width
```

`getBoundingClientRect`, largura, altura, x, y, gap, padding, margin,
overflow, escala/zoom, viewport, box-sizing, comportamento de flex/grid.
`src/test/geometry.ts` já tem as réguas prontas.

### Área visual é área de toque

Todo elemento tocável tem que ser atingido onde ele é desenhado. Isto é bug
estrutural, não detalhe:

```
[ X ][ duplicar ]
   ↑ o dedo está no X, o evento é do duplicar
```

Valide bounding box, área clicável, sobreposição, **quem o ponteiro realmente
atinge** (`document.elementFromPoint`), e a distância entre controles.
Cuidado particular com `touch-44` (`globals.css`): ele estende o alvo para
44px **fora do layout**, então botões vizinhos precisam de intervalo que
separe os centros em 44px. Sem isso os alvos se empilham e vence o último do
DOM.

---

## Testes: duas camadas, e a régua certa para cada coisa

`npm run verify` roda as duas, e é o que a CI roda. Os comandos abaixo são
para rodar uma de cada vez enquanto se trabalha.

### `npm run test` — Vitest sobre jsdom

Lógica, funções, estado, regras, persistência, transformação. Rápido, roda em
qualquer lugar, é a maior parte da suíte.

### `npm run test:browser` — Vitest Browser Mode sobre Chromium

Layout real, bounding box, overflow, hitbox, posicionamento, interação,
viewport, densidade. Arquivos `*.browser.test.tsx`.

A regra para escolher: se a asserção é sobre um **número que só existe depois
do layout**, é `browser`. Se é sobre o que uma função devolve ou o que foi
renderizado, é `unit`. **Falsificar `getBoundingClientRect` num teste de
`unit` é o sinal de que ele está no projeto errado** — a partir dali ele mede
o próprio fixture, não o app.

Problema de layout não se resolve acrescentando teste de jsdom.

### O teste tem que pegar o bug antes do Pedro

Achou um bug real? A pergunta seguinte é sempre:

> Como faço para este bug virar uma regressão impossível de voltar em
> silêncio?

E teste os estados que importam, um a um. "O RPE funciona" não protege nada
quando o defeito só existe em alguns valores: 6, 7, 7,5, 8, 8,5, 9, 9,5 e 10
são oito casos, não um.

### Teste novo só entra depois de ser visto vermelho

Reverta a correção e veja o teste falhar. Um teste de regressão verde não
prova nada — ele pode estar medindo o fixture, olhando para o lugar errado,
ou não estar rodando. Vê-lo vermelho pelo motivo certo é a única prova de que
ele protege alguma coisa.

---

## Não remova comportamento existente sem motivo

Componente, estado, interação, animação, persistência, responsividade,
fallback, validação, teste: se já funciona, preserve. Antes de remover,
confirme que está mesmo obsoleto. Na dúvida, não remova.

---

## Não mexa no data layer para resolver problema de UI

Supabase, RLS, sincronização, concorrência otimista, `entityTimestamp`,
persistência: é a área madura do projeto, e a auditoria de 25/09/2026 não
achou nada confirmado ali. Se a tarefa não exige mudança no data layer,
deixe o data layer intacto.

---

## Erros que já aconteceram aqui

Cada um destes custou tempo de verdade. Estão aqui para não custarem de novo.

### Nunca criar arquivo de texto pelo PowerShell

`Set-Content -Encoding utf8` grava BOM e quebra `JSON.parse`; `Get-Content -Raw`
com replace produz mojibake em acentos. Use as ferramentas de escrita e edição
de arquivo. O PowerShell é para rodar comandos.

### Fixture de teste tem que reproduzir a realidade, não a forma conveniente

O backfill de fotos tinha teste, o teste passava, e o app quebrava inteiro no
navegador. O fixture criava a linha antiga com `media: null` — que descreve
uma linha que **já passou** pelo código novo. A linha real não tinha a chave:
`undefined`. Se um teste cobre migração ou dado legado, construa o estado
antigo do jeito que a versão antiga realmente gravava.

Corolário: **dado lido do IndexedDB não obedece ao tipo.** O tipo descreve o
que escrevemos hoje; o banco tem o que alguma versão anterior gravou.

### Teste em jsdom não enxerga pixel

Em 25/09/2026 o projeto tinha 1936 testes verdes enquanto a aba Treino
mostrava um rótulo transbordando por cima da coluna vizinha, uma linha
estourando o card em 360px, e cinco botões com áreas de toque sobrepostas.
Nenhum dos 1936 podia ver nada disso. Não faltava rigor, faltava régua — é
por isso que a camada `browser` existe.

### Feature visual se confere no navegador

Teste verde não prova que a imagem chegou na tela. Suba o servidor e olhe —
inclusive nos dois temas.

### Largura de coluna escrita duas vezes sempre diverge

Cabeçalho e linha de uma tabela não podem ter duas listas de largura. A aba
Treino chegou a ter **quatro** sistemas para a mesma tabela conceitual, e o
cabeçalho reservava `w-14` para um controle que é `size-11`. O desalinhamento
"voltava" porque o alinhamento de hoje era coincidência do `flex-shrink`
compensando, não uma regra.

### Rótulo que não cabe na coluna transborda por cima da vizinha

"SÉRIE" ocupa 37,7px de texto e estava numa coluna de 18,4px, dimensionada
para um dígito. O resultado não era um rótulo apertado, era texto solto por
cima de "PESO" — que foi relatado como "apareceu um texto escrito série".

### Ângulo fora do domínio não se trunca, se recusa

O seletor de RPE truncava `atan2` em `[-90, 90]`. Abaixo do centro do
mostrador o ângulo passa de 90, e o truncamento dobrava a metade de baixo
inteira sobre as duas pontas da escala: 14,3% da área clicável só produzia 6
ou 10, e dois pixels de distância separavam RPE 8 de RPE 10. Ponto fora do
instrumento é ponto a ignorar, não a espremer.

### `touch-44` em fileira cria alvos sobrepostos

O utilitário estende a área de toque para 44px fora do layout. Cinco botões
de 32px sem `gap` põem os centros a 32px e sobrepõem os alvos em 12px; sem
`z-index`, vence o último do DOM. Medido: os ~19% da direita de cada ícone da
barra de ações do exercício disparavam o vizinho.

### `.children` não é a contagem de itens de uma grade

Em 26/09/2026 eu afirmei, no relatório e na mensagem de commit da Fase 2, que
`RpeSelect` "ocupava duas faixas da grade" porque renderiza o gatilho e o
`<dialog>` como irmãos. **Estava errado**, e medir desmentiu: um `<dialog>`
fechado é `display: none`, e elemento assim sai da árvore de caixas — não
vira item de grade, não consome faixa, não empurra ninguém.

O defeito era do teste. Ele comparava `header.children.length` com
`row.children.length`, e `.children` é DOM: conta nó invisível. O wrapper que
entrou no consumidor para "corrigir" isso acertou a contagem sem corrigir
layout nenhum, e veio com um comentário explicando um mecanismo inexistente.

Duas lições. **Contagem de filhos não mede layout** — faixa de grade se
confere pelo `gridTemplateColumns` resolvido ou pela posição das caixas.
E **achado que vira comentário no código precisa ter sido medido**, não
deduzido: o comentário errado sobreviveria a qualquer revisão, porque soava
plausível.

### Não escrever dado falso em arquivo curado para testar o teste

Se é preciso provar que uma checagem dispara, use fixture quebrada de
propósito, num arquivo de teste. O catálogo é dado de produção.

### Na dúvida, omitir

Vale para classificação de exercício e para casamento de foto. **Foto errada é
pior que foto nenhuma**, classificação errada é pior que campo vazio. `null`
significa "ninguém decidiu" — nunca um chute.

### `setState` com efeito colateral dentro do updater

Aconteceu duas vezes (`use-food-catalogue`, `use-diet-editor`). O updater é
puro. Leia o estado nas dependências e chame o efeito fora.

### Parâmetro com valor padrão não recebe `undefined`

`function f(cb = vi.fn())` chamada como `f(undefined)` **cai no padrão**. Um
teste escrito assim para provar "sem callback não renderiza o botão" prova o
contrário do que diz, e passa.

### Comentário que mente é pior que ausência de comentário

Já houve comentário afirmando que um componente ligava `aria-describedby` sem
ligar, e outro descrevendo as fotos como desenhos sobre fundo branco quando
são fotografias — o que levou a um placeholder branco berrante no dark mode.
Se o código mudar, o comentário muda junto.

---

## Ao mexer em fotos de exercício

- A licença é CC BY-SA 4.0 (Everkinetic). Toda superfície que mostra foto
  renderiza a atribuição a partir de `taxonomy/media-sources.ts`, nunca
  escrita à mão.
- Nada de imagem copiada para o repositório. Entrega por CDN.
- Pares `exercício → foto` são verificados à mão em
  `scripts/build-exercise-media.mjs`. Casamento automático **não é fonte** —
  metade das propostas estava errada.

---

## Ao final de cada tarefa

Um resumo curto, sempre nesta forma:

```
Alterado:
Preservado:
Testado:
Viewports testados:
Browser Mode:      passou / falhou / não se aplica
npm run verify:    passou / falhou
Riscos ou pendências:
```

Se algo falhou, diga claramente qual. Não esconda uma falha atrás de "quase
tudo passou".
