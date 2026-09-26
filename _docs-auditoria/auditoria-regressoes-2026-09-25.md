# Auditoria técnica e estrutural: prevenção de regressões

Data: 25/09/2026
Escopo: LaCalle Life V2, foco na aba Treino, com varredura do mesmo tipo de
problema no resto do projeto.
Estado do código: nenhuma linha alterada. Este documento é diagnóstico.

Baseline medido antes de começar:

- `npm run test`: 187 arquivos, 1936 testes, **todos verdes**.
- `git status`: limpo em `src/`, pendências apenas em `package.json` e pastas
  não versionadas.

---

## 1. Resumo executivo

O projeto tem duas metades com maturidade muito diferente.

**A camada de dados é sólida.** Concorrência otimista real
(`putIfVersionMatches`), versão monotônica por construção
(`entityTimestamp`, que já resolve a colisão de milissegundo), escrita sem
debounce na sessão de treino pela razão certa, `apply` já reescrito para sair
do updater impuro do `setState`, testes adversariais por domínio de sync.
Procurei perda de dado, sobrescrita silenciosa e race de persistência, e não
encontrei nada confirmado. Isso não é onde o projeto está quebrando.

**A camada visual e de interação não tem nenhuma rede de proteção.** Os 1936
testes rodam 100% em jsdom, que não tem motor de layout. Nenhum deles pode,
por construção, enxergar: sobreposição, transbordo, recorte por `overflow`,
área de toque, geometria de ponteiro, ou o efeito do `zoom` global. É
exatamente a classe de defeito que o Pedro está reportando, e é exatamente a
classe que a suíte não cobre. Por isso a sensação de "implementar, quebrar,
corrigir, quebrar outra coisa": o portão `npm run verify` fica verde
enquanto a tela quebra.

**A causa estrutural compartilhada por quase todos os bugs da aba Treino é
uma só**: as larguras das colunas do treino são listas de números escritas à
mão, duplicadas entre o cabeçalho e a linha, duplicadas de novo entre a tela
de planejar e a de executar, e submetidas a **dois sistemas de escala
diferentes na mesma linha** (`html { zoom: 1.15 }` em tudo, contra
`input, select, textarea { zoom: 1/1.15 }` nos campos). Quatro listas de
números que só podem concordar por coincidência, e que já divergiram em todas
as quatro.

**Nada crítico de segurança, perda de dados ou corrupção de dados foi
encontrado.** Não há motivo para alterar nada antes da decisão do Pedro.

Resposta à pergunta final ("é difícil quebrar o app sem querer?"): hoje, não.
O que protege contra regressão é lógica pura bem testada, e a lógica pura não
é onde o app quebra. O item de maior retorno desta auditoria não é nenhuma
correção individual: é passar a ter **um punhado de testes que rodam em
navegador de verdade** e medem geometria.

---

## 2. Problemas confirmados

### C1. RPE: a faixa abaixo do centro do mostrador só produz 6 ou 10

**Local**: `src/features/workouts/components/rpe-select.tsx:169-190`

**Problema**: `angleFromPointer` calcula `atan2(dx, -dy)` e depois **trunca**
o resultado em `[-90, 90]`. Abaixo do centro do mostrador (`dy > 0`) o
`atan2` devolve módulo maior que 90, e o truncamento dobra a faixa inteira
sobre as duas pontas da escala em vez de recusar o ponto.

**Evidência** (simulação sobre a geometria real, viewBox 280x150, centro em
140,128):

```
amostra          -> RPE
(140, 127)       -> 8
(140, 129)       -> 10     <- dois pixels de distância
(135, 140)       -> 6
(145, 140)       -> 10
( 80, 132)       -> 6
(200, 135)       -> 10
```

14,3% da área clicável do SVG fica abaixo do centro, e **toda ela** resolve
para 6 ou 10, dividida pela linha vertical do meio. O círculo do pivô
desenhado em (140,128) com raio 6 tem a metade de baixo dentro dessa zona.

**Impacto**: é literalmente o relato do Pedro, incluindo o "preciso clicar
fora do círculo para funcionar": a região que funciona é a de cima, inclusive
fora do arco desenhado; a que está dentro e embaixo é a quebrada.

**Classificação**: confirmado. **Prioridade**: alta.

**Correção sugerida**: ponto abaixo do centro não é um ângulo a truncar, é um
ponto fora do instrumento. Ignorar no `pointerdown` (sem mudar valor) e, no
`pointermove`, manter o último valor válido do arrasto. Em paralelo, encolher
a área interativa para a faixa do arco em vez do retângulo inteiro do SVG.

---

### C2. RPE: os degraus do meio são as menores áreas do mostrador

**Local**: `rpe-select.tsx:21-45`, junto com
`src/features/workouts/taxonomy/rpe.ts:14-23`

**Problema**: a escala é **não uniforme** (6, 7, 7,5, 8, 8,5, 9, 9,5, 10),
mas `fractionForValue` mapeia **pelo valor** e não pelo índice. O trecho de 6
a 7 vale um degrau e ocupa um quarto do arco; o de 7,5 a 8 vale um degrau e
ocupa um oitavo.

**Evidência** (área do retângulo clicável por valor):

```
RPE  6 : 16.9%      RPE  8.5 :  9.2%
RPE  7 : 20.0%      RPE  9   : 14.0%
RPE  7.5:  9.2%     RPE  9.5 : 10.9%
RPE  8 :  7.8%      RPE 10   : 11.9%
```

RPE 8 tem 2,6 vezes menos alvo que RPE 7.

**Impacto**: a segunda metade do "os valores intermediários não estão sendo
selecionados corretamente". Mesmo depois de corrigir C1, o meio da escala
continua sendo o mais difícil de acertar.

**Classificação**: confirmado. **Prioridade**: alta.

**Correção sugerida**: mapear por índice em `RPE_SCALE` (cada degrau vale
1/8 do arco). Os tiques desenhados passam a ficar equidistantes, que é o que
a pessoa já assume ao olhar.

---

### C3. O texto "série" transbordando a própria coluna

**Local**: `src/features/workouts/components/session-exercise-card.tsx:116`

```tsx
<span className="w-4 text-center">Série</span>
```

**Problema**: `w-4` é a largura da coluna do **número** da série, dimensionada
para um dígito. O rótulo tem cinco letras.

**Evidência** (medido no navegador, 390px, densidade padrão):

```
caixa do rótulo : 18.4px
texto renderizado: 37.7px      transbordo: 19.3px para a direita
```

O texto escapa por cima da coluna "PESO". É exatamente o "SÉRIE PESO" colado
que aparece no print do Pedro.

**Impacto**: é o texto "série" que ele viu. Não é código legado nem
renderização condicional: é o cabeçalho de coluna não cabendo na própria
caixa.

**Classificação**: confirmado. **Prioridade**: alta.

**Correção sugerida**: não remover o rótulo. A coluna do número precisa ter
largura própria que caiba o rótulo, ou o rótulo precisa ser abreviado por
desenho ("#"). A solução real está em C5.

---

### C4. A linha de série estoura o card, e o X é recortado

**Local**: `src/features/workouts/components/performed-set-row.tsx:129-279`

**Problema**: a linha é um `flex` com `justify-between`, **todos** os filhos
com `shrink-0`, sem `flex-wrap`. Não pode encolher e não pode quebrar. O pai
imediato é `overflow-hidden` (linha 99), que é obrigatório: é o mecanismo de
recolhimento do `useCollapsibleRemove`. Quando a soma passa da largura
disponível, o último elemento, que é o X de remover a série, é simplesmente
cortado.

**Evidência** (medido no navegador com a marcação real):

| viewport | densidade | precisa | tem | transbordo |
|---|---|---|---|---|
| 390px | Compacto | 312 | 312 | 0 |
| 390px | Padrão | 262 | 262 | 0 |
| 390px | Confortável | 245 | 223 | **22px** |
| 360px | Compacto | 282 | 282 | 0 |
| 360px | **Padrão** | 257 | 236 | **21px** |
| 360px | Confortável | 245 | 200 | **45px** |

A linha de **cardio** (campo de duração, sem RPE) não estoura em nenhum caso:
em 390px/Confortável precisa de 223 e tem 223.

**Impacto**: três coisas de uma vez.

1. Em 360px (Pixel, linha Galaxy S, a largura mais comum do Android) na
   densidade **padrão**, o X some. O comentário do `touch-44` em
   `globals.css` diz que as linhas foram "tuned at 360px"; a linha de série
   foi reescrita em 17/09 para pílulas de largura fixa e nunca foi remedida.
2. Exercício de força perde o X e exercício de cardio mantém. É o
   "alguns exercícios mostram o X e outros não", mecanicamente explicado.
3. Quem usa "Confortável" perde o X até em 390px.

**Classificação**: confirmado. **Prioridade**: alta.

**Correção sugerida**: a linha precisa de um orçamento de largura declarado,
não de seis larguras independentes somadas na esperança de caber. Ver C5.

---

### C5. Cabeçalho e linha são duas listas de largura independentes, e usam
duas escalas diferentes

**Local**: `session-exercise-card.tsx:112-128` contra
`performed-set-row.tsx:129-279`

**Problema**: três defeitos empilhados.

1. **Divergência escrita à mão**: o cabeçalho reserva `w-14` (56px) para o
   RPE; o controle é `size-11` (44px). Doze pixels de erro puro, sem `zoom`
   envolvido.
2. **Comportamentos de transbordo opostos**: os `span` do cabeçalho **não**
   têm `shrink-0`; os filhos da linha **têm**. Sob pressão, o cabeçalho
   encolhe e a linha estoura. As duas nunca vão divergir do mesmo jeito.
3. **Duas escalas na mesma linha**: `html { zoom: 1.15 }` vale para os `span`
   do cabeçalho; `input, select, textarea { zoom: calc(1/1.15) }` cancela o
   zoom só nos campos. Um `w-16` no cabeçalho e um `w-16` no campo **não têm
   a mesma largura na tela**. Só podem concordar por acaso, numa densidade.

**Evidência** (desalinhamento dos centros, cabeçalho menos linha, em px):

| densidade | peso | reps | rpe | check |
|---|---|---|---|---|
| Compacto | -2,2 | -4,4 | -0,6 | +3,2 |
| Padrão | -0,9 | -1,6 | +0,3 | +2,1 |
| Confortável | -4,8 | **-13,7** | **-22,7** | **-27,4** |

Em Padrão o erro é pequeno, e é por isso que o problema "volta" em vez de
ficar: o alinhamento de hoje é coincidência do `flex-shrink` compensando, não
uma regra.

O comentário em `session-exercise-card.tsx:105-111` documenta a correção
anterior: adicionaram `border-l-[3px] px-1 gap-px` ao cabeçalho para
compensar um deslocamento de 7px. Isso é exatamente o "offset artificial
compensando estrutura errada" que o Pedro pediu para eu procurar, e está
registrado no próprio código como se fosse a solução.

**Impacto**: qualquer mudança de largura em qualquer um dos dois lados
reabre o desalinhamento. É a fonte permanente de "os textos voltaram a ficar
desalinhados".

**Classificação**: confirmado. **Prioridade**: alta.

**Correção sugerida**: uma grade só, declarada uma vez.
`grid-template-columns` com colunas nomeadas num componente
`SetRowGrid`, usada pelo cabeçalho e pela linha. O cabeçalho deixa de saber
larguras; ele herda as do mesmo lugar. Isso resolve C3, C4 e C5 juntos, e é
menos código do que existe hoje.

---

### C6. O mesmo problema, pior, no editor de rotina

**Local**: `routine-exercise-card.tsx:184-199` contra `planned-set-row.tsx`

**Problema**: o editor de rotina tem o **terceiro e quarto** sistema de
largura do mesmo conceito de tabela, e eles divergem mais que os da sessão.

| coluna | cabeçalho reserva | controle real |
|---|---|---|
| Série | `w-6` (24) | `w-6` (24) ok |
| Peso | `flex-1` | `flex-1 w-full` |
| Reps | `flex-1` | `flex-1 w-full` |
| RPE | `w-16` (64) | `size-8` (**32**) |
| X | `w-7` (28) | `size-11` (**44** no celular) |

Erro duro de 32px no RPE e 16px no X, em celular.

Além disso, `planned-set-row.tsx:23-24` ainda usa `w-full` dentro de
`flex-1` num `<input>`, que é **precisamente o padrão que o comentário de
`performed-set-row.tsx:38-57` diz ter sido medido renderizando a 21,86px**,
abaixo do próprio padding. O `PerformedSetRow` foi corrigido; o
`PlannedSetRow` continua carregando o defeito.

**Impacto**: a tela de montar treino tem o mesmo desalinhamento da tela de
executar, com magnitude maior, e um campo cuja largura pode colapsar.

**Classificação**: confirmado. **Prioridade**: alta.

---

### C7. Áreas de toque sobrepostas na barra de ações do exercício

**Local**: `routine-exercise-card.tsx:142-181`

**Problema**: cinco `IconButton` de `size-8` com o utilitário `touch-44`,
dentro de um `flex ... justify-end` **sem `gap`**. O `touch-44` cria um
`::after` absoluto de 44px centrado em cada botão. Centros a 32px de
distância, alvos de 44px: 12px de sobreposição entre cada par, e sem
`z-index` quem ganha é o **último na ordem do DOM**.

**Evidência** (medido com `elementFromPoint` sobre a marcação real, cinco
pontos dentro da área **visível** de cada botão):

```
botão A (Trocar)     -> A  A  A  A  B
botão B (Duplicar)   -> B  B  B  B  C
botão C (Mover cima) -> C  C  C  C  D
botão D (Mover baixo)-> D  D  D  D  E
botão E (Remover)    -> E  E  E  E  E
```

Os ~19% da direita de cada ícone visível disparam o **vizinho**.

**Impacto**: é a mesma classe do bug do RPE, generalizada, e com consequência
pior: tocar na borda direita de "Trocar" executa "Duplicar". Tocar na borda
direita de "Mover para baixo" abre o "Remover".

**Classificação**: confirmado. **Prioridade**: alta.

**Correção sugerida**: `gap` que separe os centros em pelo menos 44px, ou
`touch-44` apenas em controles isolados, nunca em sequência adjacente. Vale
revisar o utilitário: ele resolve alvo pequeno e cria colisão em fileira.

---

### C8. O X de remover série fica invisível no desktop

**Local**: `performed-set-row.tsx:276` e `planned-set-row.tsx:108`

```
sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100
```

**Problema**: a partir de 640px o X só aparece na linha sob o cursor.

**Evidência**: além do código, existe a confissão no próprio repositório.
`src/features/diet/components/meal-item-row.tsx:72` documenta este exato
padrão como defeito já encontrado e corrigido na dieta:

> "o botão de remover sempre visível (`sm:opacity-0` só existia a partir do
> breakpoint que o celular nunca atinge) empurrava tudo pra uma quarta linha"

A dieta resolveu movendo as ações para um kebab. O treino nunca recebeu a
correção.

**Impacto**: no desktop, "alguns exercícios mostram o X e outros não" é
literalmente verdade: só o exercício sob o mouse mostra.

**Classificação**: confirmado. **Prioridade**: média.

---

## 3. Riscos potenciais

### R1. `zoom` no `<html>` é o multiplicador de todo erro de largura

`tokens.css:647-656`. A justificativa é boa e está bem escrita (os 16px reais
do campo contra o auto-zoom do Safari iOS). O efeito colateral não está
registrado em lugar nenhum: **a densidade muda a largura útil do layout**.
Em 390px, Compacto dá 390 unidades de layout, Padrão dá 339, Confortável dá
300. O resultado é contraintuitivo, e é o que as medições de C4 mostram:
"Compacto" é a única densidade onde a linha de série cabe.

Classificação: risco potencial. Prioridade: alta como **contexto**, porque
explica por que "funciona aqui e quebra ali" sem ninguém ter mudado nada.

### R2. `zoom` no WebView do Capacitor não está validado

`android/` e `capacitor.config.ts` existem no repositório. `zoom` tem
histórico de divergência entre engines, e interage com `position: fixed` e
com `env(safe-area-inset-*)`, que também é multiplicado pelo zoom (um inset
de 34px vira 39px em Padrão e 44px em Confortável). Nada no projeto valida
isso em aparelho real.

Classificação: risco potencial. Prioridade: alta antes de publicar o shell.

### R3. `useCollapsibleRemove` depende de `transitionend` disparar

`src/design-system/hooks/use-collapsible-remove.ts:48-52`. A remoção só
acontece no `transitionend`. Se a transição for interrompida, ou o elemento
não estiver sendo renderizado, `onRemove` nunca roda e o X **não faz nada,
silenciosamente**. É a mesma família do que já foi anotado sobre
`animationend`. Não reproduzi. O hook é usado em refeição, exercício, série e
alimento, então a superfície é larga.

Classificação: risco potencial. Prioridade: média.

### R4. `apply` dispara gravações concorrentes sem serialização

`use-session-runner.ts:93-117`. Duas chamadas rápidas colocam dois
`sessions.save` em voo, o segundo esperando a versão que o primeiro ainda não
gravou. Procurei o furo e **não consegui confirmá-lo**: as transações do
IndexedDB são serializadas na ordem de criação, e `entityTimestamp` já é
monotônico por construção (o comentário em `entity.ts:80-103` mostra que a
colisão de milissegundo foi pensada). Registro porque não há serialização por
desenho, não porque vi quebrar.

Classificação: risco potencial. Prioridade: baixa.

### R5. Chips de filtro com `touch-44` em fileira

`food-filters.tsx:21`, `custom-food-form.tsx:335`,
`custom-exercise-form.tsx:180`: `h-7`/`h-8` com `touch-44` em barras que
quebram linha com `gap-2`. Mesma colisão de C7, agora também na vertical (28
ou 32px de altura, alvo de 44px, 8px de intervalo).

Classificação: risco potencial. Prioridade: média.

### R6. O mostrador pequeno do RPE corta o próprio número

`rpe-select.tsx:345` usa `viewBox="0 0 56 40"` e desenha o texto com
`y = cy + 14 = 38` e `fontSize 12`. A linha de base fica a 2 unidades do
fundo da caixa, e a vírgula de "8,5" desce abaixo dela. Além disso, `cx`,
`cy` e `r` são props enquanto o `viewBox` é literal: parametrização que não
parametriza nada, com um único chamador.

Classificação: risco potencial. Prioridade: baixa.

---

## 4. Inconsistências encontradas

- **I1.** Duas linhas de série com filosofias opostas: `PerformedSetRow` usa
  pílulas de largura fixa (corrigido em 17/09), `PlannedSetRow` usa
  `flex-1 w-full` (o padrão que a correção abandonou). A segunda ainda
  carrega o bug que a primeira documentou.
- **I2.** Dois `IconButton` praticamente idênticos, um em
  `session-exercise-card.tsx:177` e outro em
  `routine-exercise-card.tsx:272`. O do editor de rotina tem uma prop
  `danger` que **nenhum chamador usa**. Código morto.
- **I3.** Dois cabeçalhos de coluna escritos à mão, nenhum derivado da linha
  que rotulam.
- **I4.** Remover exercício: `RoutineExerciseCard` tem `Trash2` com
  `ConfirmButton`; `SessionExerciseCard` **não tem remoção nenhuma**, e o
  botão de trocar só existe quando `onSwap` é passado (ausente no
  `SessionEditor`). Três comportamentos diferentes para a mesma entidade em
  três telas.
- **I5.** O RPE muda de tamanho por tela sem regra: `size-11` ao executar,
  `size-8` ao planejar, e em cada tela o cabeçalho discorda do próprio
  controle.

Sobre "abstração por abstração": a única diferença que eu considero
**legítima** entre a linha planejada e a executada é o conjunto de colunas
(a executada tem o botão de concluir e a legenda do planejado). Isso não
justifica dois sistemas de largura, justifica uma grade com colunas
opcionais.

---

## 5. Problemas específicos da aba Treino

Cobertos acima: C1, C2 (RPE), C3 (texto "série"), C4 (sobreposição e X
sumido), C5 e C6 (desalinhamento), C7 (toque sobreposto), C8 (X no desktop).

Verificações que **não** apontaram problema, ditas para não virarem trabalho
desnecessário:

- Adicionar e remover série, adicionar e remover exercício, edição, ordenação
  e persistência têm testes de serviço (`edit-session`, `edit-routine`,
  `start-session`, `session-stats`, `history`) e passam. A lógica está sã.
- A ordem "Peso primeiro, Reps depois" está consistente nos quatro arquivos.
- Estados vazio, de carregamento e de erro existem e são tipados como união
  discriminada em `SessionRunnerState`. Não há estado ilegal representável.
- Valores longos no campo de peso estão contidos (`readWeight` recusa sinal e
  separador duplo, achado de auditoria anterior, com teste).
- Recarregar preserva: a escrita é imediata, sem debounce, por decisão
  documentada.

---

## 6. Problemas de responsividade e mobile

O ponto que o Pedro levantou está certo e é demonstrável **neste projeto
especificamente**, porque o `zoom` global quebra a equivalência:

> reduzir a janela do desktop para 390px **não** é o mesmo que um celular de
> 390px

Motivos concretos aqui:

1. **A densidade muda a largura de layout.** Reduzir a janela testa uma
   largura; o aparelho do Pedro pode estar em outra densidade e ter uma
   largura de layout diferente com a mesma largura física (R1). As medições
   de C4 mostram o mesmo viewport passando e falhando conforme a densidade.
2. **`sm:` a 640px separa dois comportamentos inteiros.** O X da série é
   sempre visível abaixo de 640 e escondido atrás de hover acima (C8). Quem
   valida no desktop vê o comportamento de hover e nunca vê o de toque, e
   vice-versa.
3. **Hover não existe no toque.** Todo `group-hover` da aba Treino é
   inalcançável no celular por definição.
4. **`touch-44` é invisível.** Os alvos sobrepostos de C7 não aparecem em
   nenhum print. Só aparecem tocando, ou medindo com `elementFromPoint`.
5. **`env(safe-area-inset-*)` é multiplicado pelo `zoom`** (R2).

O que está **bem** resolvido e não precisa mexer: não há nenhum `100vh` no
projeto; a barra inferior usa
`--bottom-nav-h: calc(3.5rem + env(safe-area-inset-bottom))`; `position:
fixed` é usado com parcimônia e com `z-index` coerente; o `touch-none` do
seletor de RPE está correto.

O gap real é de **processo**: não existe nenhuma validação automatizada em
viewport móvel, nem em WebView.

---

## 7. Problemas de arquitetura e componentização

A arquitetura em camadas está boa e é defendida por lint
(`AGENTS.md` regra 4: componente não importa `@/core/storage`). Repositórios
por feature, `composition/` como raiz de composição, `core/` sem React.
Migrações append-only. Isso funciona e não é onde está o risco.

O risco de regressão não está na arquitetura de dados, está em **duplicação
de layout sem dono**:

- quatro sistemas de largura para uma tabela conceitual (C5, C6);
- dois `IconButton` (I2);
- um utilitário global (`touch-44`) que altera a área de toque de 20+ locais
  e não tem nenhum teste que meça área de toque.

### Componentes mais perigosos de modificar

Ordenados por raio de explosão medido pelo número de importadores e pela
ausência de teste capaz de perceber a quebra.

| componente | por que é perigoso |
|---|---|
| `tokens.css` (`--ui-scale` / `zoom`) | muda a largura de layout do app inteiro; nenhum teste enxerga |
| `globals.css` (`touch-44`) | muda a área de toque de 20+ controles; nenhum teste enxerga |
| `design-system/components/dialog.tsx` | todo painel e folha, inclusive a do RPE |
| `design-system/hooks/use-collapsible-remove.ts` | toda remoção de item em 4 features; exige `overflow-hidden` no pai, que é o que recorta o X |
| `rpe-select.tsx` | usado por `PerformedSetRow` e `PlannedSetRow` com tamanhos diferentes |
| `card.tsx`, `page-shell.tsx` | definem o orçamento de largura de tudo |
| `composition/migrations.ts` | append-only, sem volta |

---

## 8. Problemas de testes

**O que existe**: 1936 testes, 187 arquivos, todos verdes. Cobertura muito
boa de lógica pura (domínio, nutrição, formatação), de repositórios, e de
sincronização, incluindo arquivos `*.adversarial.test.ts` por domínio. Isso é
acima da média e deve ser preservado.

**O buraco, em uma frase**: `vitest.config.ts` declara
`environment: "jsdom"` para **tudo**, e não existe nenhum teste E2E nem de
navegador. jsdom não implementa layout. Logo:

- nenhum teste pode detectar C3, C4, C5, C6, C7 nem C8;
- `rpe-select.test.tsx:17-42` precisa **falsificar**
  `getBoundingClientRect` e `viewBox.baseVal` para existir. O único
  componente do app cuja correção é puramente geométrica é testado contra uma
  geometria escrita à mão no próprio teste. Os 16 testes dele passam, e C1 e
  C2 estão lá;
- o teste que mais chega perto ("nunca escolhe um valor fora da escala")
  arrasta para `clientX: 1000, clientY: 128`, ou seja, exatamente na altura
  do centro. Um `clientY: 129` teria pegado o C1.

**Testes que passariam mesmo com a tela quebrada**: praticamente todos os
testes de componente. Eles verificam presença de nó, rótulo acessível e
chamada de callback, nunca posição.

**Fluxos críticos sem cobertura de verdade**: executar um treino inteiro de
ponta a ponta num navegador; o seletor de RPE em pixels reais; qualquer
layout em qualquer viewport; qualquer área de toque.

---

## 9. Matriz de regressão recomendada para Treino

Ponto importante que muda a forma da proposta: **TRAINING-020 a 024 não podem
ser escritos em vitest + jsdom.** Escrevê-los lá produziria testes verdes que
não protegem nada, que é justamente o problema atual. A matriz precisa ser
dividida por instrumento.

### Bloco A, em vitest + jsdom (o que já existe, completar)

Lógica e contrato. Baratos, rápidos, já são o padrão do projeto.

| ID | caso | onde | estado |
|---|---|---|---|
| TRAINING-001 | abrir aba Treino | `treinos/page` | parcial |
| TRAINING-002 | adicionar exercício | `edit-routine.test` | coberto |
| TRAINING-003 | remover exercício | `edit-routine.test` | coberto |
| TRAINING-004 | adicionar série | `edit-session.test` | coberto |
| TRAINING-005 | remover série | `edit-session.test` | coberto |
| TRAINING-006 | editar peso | `weight-field.test` | coberto |
| TRAINING-007 | editar repetições | `performed-set-row.test` | coberto |
| TRAINING-018 | persistência após reload | `session-repository.test` | coberto |
| TRAINING-019 | exercício com várias séries | `session-exercise-card.test` | parcial |

Um único teste novo aqui, **de mesa**, e que pega C2 sem navegador:

- TRAINING-008..017 viram **um** teste parametrizado: para cada um dos oito
  degraus, o ângulo devolvido por `angleForFraction` tem que voltar ao mesmo
  degrau por `valueForAngle`, e **as oito bandas têm que ter a mesma
  largura**. Dez testes quase idênticos não protegem mais que um
  parametrizado; a asserção de banda igual é a que realmente pega o defeito.

### Bloco B, em navegador real (não existe hoje, é o item de maior retorno)

Recomendo **Vitest Browser Mode** em vez de uma suíte Playwright separada: o
vitest já está no projeto, a configuração é um `projects` a mais no
`vitest.config.ts`, e não há um segundo runner para manter. Poucos testes,
todos medindo número, nenhum medindo aparência.

| ID | caso | asserção que realmente protege |
|---|---|---|
| TRAINING-020 | layout sem sobreposição | para cada viewport e densidade: `row.scrollWidth <= row.clientWidth` |
| TRAINING-021 | layout desktop | centro de cada coluna do cabeçalho igual ao centro da coluna da linha, tolerância 1px |
| TRAINING-022 | layout mobile | 320, 360, 390 e 430px, nas três densidades: nenhum transbordo, X inteiro dentro do pai |
| TRAINING-023 | interação touch | `elementFromPoint` no centro e nas quatro bordas de cada botão de ação devolve **aquele** botão |
| TRAINING-024 | interação mouse | idem, mais o X da série alcançável sem depender de hover |
| TRAINING-008..017 | RPE em pixels | tocar no centro de cada banda do arco devolve aquele degrau; tocar **abaixo do centro** não muda o valor |

Doze a quinze testes no total. É pouco de propósito: cada um tem que ser
capaz de falhar por um defeito real desta auditoria. Antes de aceitar
qualquer um deles, aplicar a regra que já é do Pedro: **reverter a correção e
ver o teste ficar vermelho.** Um teste de regressão verde não prova nada.

---

## 10. Regras recomendadas para o `CLAUDE.md`

O `CLAUDE.md` atual é bom e a seção "Erros que já aconteceram aqui" é o
formato certo. Proponho **não** criar um capítulo novo de doutrina abstrata,
e sim acrescentar as entradas abaixo no mesmo tom, mais um bloco curto de
processo. Regra genérica que ninguém consegue verificar não muda
comportamento; as abaixo são todas verificáveis.

### Para "Erros que já aconteceram aqui"

**Largura de coluna escrita duas vezes sempre diverge.**
Cabeçalho e linha de uma tabela não podem ter duas listas de largura. Uma
grade, um lugar. Já divergiu em quatro sistemas na aba Treino, e a
"correção" anterior foi um `px-1` compensando 7px.

**`zoom` do `html` e `zoom` do campo não se somam, se cancelam.**
`w-16` num `<span>` e `w-16` num `<input>` **não têm a mesma largura na
tela** (`tokens.css`). Nunca dimensionar uma linha misturando os dois sem
medir. A densidade "Confortável" reduz a largura de layout: em 390px sobram
300 unidades, não 390.

**Área visual não é área de toque.**
`touch-44` cria um alvo de 44px fora do layout. Em botões adjacentes sem
`gap`, os alvos se sobrepõem e o **último do DOM** vence. Medido: os 19% da
direita de cada ícone da barra de ações do exercício disparam o vizinho.

**Ângulo fora do domínio não se trunca, se recusa.**
Truncar `atan2` em `[-90, 90]` dobra a metade de baixo do mostrador sobre as
duas pontas da escala. Ponto fora do instrumento é ponto a ignorar.

**Teste em jsdom não enxerga pixel.**
jsdom não tem layout. Sobreposição, transbordo, recorte e área de toque só
existem em navegador. Um teste de componente verde não é evidência de que a
tela está certa, e falsificar `getBoundingClientRect` num teste é o sinal de
que o teste está medindo o próprio fixture.

### Para "Ao terminar, sempre" (acrescentar entre 2 e 3)

Um bloco curto, só para mudança que toca tela:

> **Se a mudança toca layout ou interação**, antes de commitar:
> 1. Medir, não olhar: `scrollWidth <= clientWidth` na linha alterada.
> 2. Nas três densidades, em 360px e em 390px. Reduzir a janela não cobre a
>    densidade.
> 3. Se há botões adjacentes, `elementFromPoint` nas bordas de cada um.
> 4. Se mexeu em componente compartilhado, listar quem importa antes de
>    mudar (`grep -rl`) e rodar os testes desses lugares.

### Para "Ordem de trabalho" (uma linha em cada ponta)

- No passo 2 ("listar os impactos"): quem importa o que vai mudar, e o que
  pode quebrar nesses lugares.
- Passo 7 novo: a funcionalidade nova funciona **e** o comportamento anterior
  continua funcionando. Só então é "pronto".

Sobre as outras regras que o Pedro pediu (estabilidade antes de refatoração,
menor mudança possível, feature não é refactor, não quebrar em silêncio): já
estão, em substância, no `CLAUDE.md` e no `AGENTS.md` atuais (ordem de
trabalho passo 6, regra 8 de tamanho, revisão crítica). Reescrevê-las como
capítulo novo dilui as que são específicas e verificáveis. Minha
recomendação é acrescentar só as que faltam.

---

## 11. Definition of Done proposta

Curta de propósito, para caber na cabeça.

> Pronto é: a coisa nova funciona, **e** o que já funcionava continua
> funcionando, **e** existe uma forma de descobrir se parar de funcionar.

Concretamente, uma tarefa está pronta quando:

1. `npm run verify` e `npm run build` passam.
2. Se tocou lógica: existe teste, e ele já foi visto **vermelho** com a
   correção revertida.
3. Se tocou tela: foi medido nas três densidades, em 360 e 390px, e não só
   olhado.
4. Se tocou componente compartilhado: os importadores foram listados e os
   testes deles rodaram.
5. Commit e push, com mensagem em português explicando o porquê.
6. `docs/roadmap.md` atualizado.

---

## 12. Plano de correção priorizado

Proposto em fases porque a ordem importa: a fase 0 é o que faz as outras
serem verificáveis. Nada aqui foi executado.

### Fase 0, primeiro: o instrumento

Sem isto, toda correção seguinte é "parece certo agora".

1. Adicionar Vitest Browser Mode como um segundo `project` no
   `vitest.config.ts`. Um arquivo, nenhum runner novo.
2. Escrever **três** testes de medição, e ver os três vermelhos contra o
   código de hoje: transbordo da linha de série (C4), alinhamento
   cabeçalho x linha (C5), e alvos da barra de ações (C7).

Se os três não ficarem vermelhos, o instrumento está errado e nada do que
vem depois vale. Medição é evidência, não verdade.

### Fase 1: o RPE (o bug que mais incomoda)

3. C1: recusar ponto abaixo do centro, em vez de truncar.
4. C2: mapear a escala por índice, não por valor.
5. Encolher a área interativa para a faixa do arco.
6. R6: corrigir o `viewBox` do mostrador pequeno, e tirar a parametrização
   falsa de `cx`/`cy`/`r`.

Teste de aceitação: TRAINING-008..017 no navegador, os oito degraus
alcançáveis, e tocar embaixo do centro não muda nada.

### Fase 2: a grade de colunas (resolve quatro bugs de uma vez)

7. Criar uma grade única de linha de série, com colunas nomeadas, usada pelo
   cabeçalho e pela linha.
8. Migrar `session-exercise-card` + `performed-set-row` (resolve C3, C4, C5).
9. Migrar `routine-exercise-card` + `planned-set-row` (resolve C6 e I1).
10. Recalcular o orçamento de largura para caber em **320px na densidade
    Confortável**, que é o pior caso real, e não em 390px no Padrão.

Esta é a única fase que mexe em estrutura, e é onde o risco de regressão está
concentrado. Fazer depois da fase 0, com os testes já existindo.

### Fase 3: toque e alcance

11. C7: separar os centros dos ícones em 44px, ou tirar `touch-44` de
    fileira adjacente.
12. R5: mesmo tratamento nos chips de filtro.
13. C8: decidir o X da série. A dieta já resolveu isto com kebab
    (`meal-item-row`); seguir a mesma decisão é mais barato que inventar
    outra, e acaba com a divergência entre as duas features.

### Fase 4: limpeza e blindagem

14. I2: um `IconButton` só, e remover a prop `danger` morta.
15. I4: decidir conscientemente se remover exercício existe na sessão. Não é
    bug, é lacuna de produto, e a decisão é do Pedro.
16. R2: validar `zoom` e `safe-area` em aparelho real antes de publicar o
    shell Capacitor.
17. R3: decidir se `useCollapsibleRemove` precisa de rede de segurança para
    quando `transitionend` não vier.
18. Atualizar `CLAUDE.md` com as regras da seção 10.

### O que eu deliberadamente **não** recomendo

- Refatorar a camada de dados. Está boa, e mexer nela é risco sem retorno.
- Trocar o mecanismo de `zoom` agora. A justificativa dele é legítima; o
  problema é que ninguém sabe que ele existe ao dimensionar uma linha. A
  correção certa por enquanto é a regra no `CLAUDE.md` mais a grade única,
  não arrancar o `zoom`.
- Escrever dezenas de testes de componente. O projeto já tem cobertura boa de
  lógica; o que falta são doze testes de geometria, não mais duzentos de
  jsdom.
