# Auditoria de UI / produto — 26/09/2026 (Sprint 0)

Baseline da fase de refinamento pós-estabilização. **Nenhum código de produto
foi alterado nesta sprint.** O único arquivo escrito é este.

Método: leitura dos componentes e dos seus consumidores, medição dos tokens,
e validação no navegador real (dev server em `localhost:3111`, Playwright,
390 px e 320 px, temas claro e escuro).

---

## Baseline verificado

| Portão | Resultado |
|---|---|
| `npm run typecheck` | passou |
| `npm run lint` | passou |
| `npm run test` (unit) | 1951/1952 — 1 falha, *flake* de saturação (ver abaixo) |
| `npm run test:browser` | 131/131 passou |

A falha unitária é `src/composition/identity-isolation.test.ts > "anônimo,
conta A e conta B nunca compartilham dado pessoal entre si"`, com
`Test timed out in 5000ms`. Rodada isolada, a mesma suíte passa em **2,82 s**
— quatro testes, quatro verdes. A rodada completa levou 249 s com o dev
server e outras tarefas na máquina; é o padrão já conhecido de saturação, não
regressão. **Não é achado desta auditoria e não deve virar tarefa de sprint.**

Sem overflow horizontal em `/hoje` a 320 px: `scrollWidth` 305 =
`clientWidth` 305, zero elementos fora da caixa. A geometria estabilizada
está intacta.

---

## Resumo executivo

O app não tem um problema de estilo. Tem um problema de **hierarquia** e de
**adesão ao próprio design system**. Três fatos medidos sustentam quase todos
os achados abaixo:

1. **A escala tipográfica da marca não é usada pelo app.** `tokens.css`
   define `--text-display/h1/h2/h3/h4/label/metric`. Nas telas do produto há
   **340 usos da escala padrão do Tailwind** (`text-xs`, `text-sm`,
   `text-2xl`…) contra **5 usos da escala da marca** — e 1 desses 5 é a
   Landing Page.
2. **A tela Hoje não tem herói.** O maior texto da tela é o nome da própria
   tela.
3. **Estados equivalentes têm aparências diferentes** porque o componente do
   design system que os resolve existe e quase ninguém o usa.

Isso é bom: quase toda a fase é reaproximar o app de peças que já estão no
repositório, não inventar linguagem nova.

---

# A. HOJE

## A1 — O número do dia não é o herói da tela

**Severidade:** alta · **Esforço:** baixo · **Sprint:** 1

**Localização:** `src/features/diet/components/today-energy.tsx` (`CalorieRing`,
`text-2xl`) e `src/design-system/components/page-header.tsx:75`
(`text-h2 md:text-h1`).

**Medido no navegador (390 px, sem perfil):**

```
H1 "Hoje"               24 px / peso 700
números do card herói   20 px / peso 500
títulos ALIMENTAÇÃO     12 px / peso 500  #6b7280
```

Com perfil preenchido o número do anel é `text-2xl` = **24 px**, exatamente o
mesmo tamanho do `<h1>` no mobile — e **menor** que ele no desktop, onde o
título sobe para `text-h1` = 32 px. A tela cujo trabalho é responder "quanto
ainda cabe hoje?" está tipograficamente dizendo que a resposta mais importante
é a palavra "Hoje".

**A peça certa já existe e está parada.** `--text-metric: 28px / 110% / −2%`
tem no próprio `tokens.css` o comentário: *"O número de destaque… a pág. 24 o
usa no valor do stat card, que é a linha que o cartão existe para mostrar."*
Ele é usado em **um** lugar no repositório inteiro:
`src/app/_components/landing/visual-food.tsx:14` — um card decorativo de
marketing.

**Solução proposta:** o número restante passa a `text-metric` (28 px,
tabular, tracking da marca); o rótulo "restantes / para hoje / acima da meta"
segue abaixo; e a linha de contexto "1.420 consumidas · 2.067 meta" — que hoje
**não existe em lugar nenhum da tela** — entra como terceira linha, em
`text-xs text-ink-subtle`. Consumido e meta já estão em memória no mesmo
componente (`totals.kcal`, `targets.kcal`); nenhuma métrica nova, nenhuma
consulta nova.

**Risco de regressão:** baixo. O `key={changes}` da animação "Number Update" e
o `formatDecimal` ficam como estão; muda tamanho e ganha uma linha. Exige
medição em 320 px com densidade Confortável — é a combinação que dá a menor
largura útil (300 unidades em 390 px, por `--ui-scale`), e o herói divide a
linha com o SVG de 76 px.

---

## A2 — Dois pedidos de perfil empilhados, um em cima do outro

**Severidade:** média · **Esforço:** baixo · **Sprint:** 1

**Localização:** `src/features/profile/components/profile-incomplete-notice.tsx`
e o ramo `targets === null` de `today-energy.tsx:70-89`.

Observado no navegador (captura `hoje-390-dark.png`), em sequência vertical
imediata:

> ⓘ Complete seu perfil para ver metas de calorias e macros aqui.
> **[Completar perfil]**
>
> 0 kcal 0 Prot 0 Carb 0 Gord
> Sem meta para comparar. **Preencha o perfil** se quiser ver quanto ainda
> cabe no dia.

Dois avisos, duas frases sobre a mesma ausência, dois links para `/perfil`,
um colado no outro. O topo da tela mais importante do app gasta seu primeiro
terço se desculpando duas vezes.

**Solução proposta:** um dos dois sai. A recomendação é remover a frase de
dentro do herói e deixar o `Notice`, que já é o componente do design system
para exatamente isso — o herói volta a mostrar só os totais verdadeiros mais
o "Registrar". Decisão de produto, não técnica: vale confirmar antes.

**Risco:** baixo, mas existe teste amarrando o link do herói (`today-energy.test.tsx`
cobre "o caminho para o diário não some quando o header compartilhado sai").
O link `Registrar` **não** pode sair junto.

---

## A3 — Estado vazio: duas frases diferentes para o mesmo fato

**Severidade:** baixa · **Esforço:** trivial · **Sprint:** 1

`today-meals.tsx` → *"Nada registrado hoje ainda."*
`today-workout.tsx` → *"Nada registrado hoje."*

Lado a lado, na mesma tela, mesma linha de leitura. O comentário do próprio
`TodayWorkout.Empty` diz que a forma foi igualada de propósito ("a mesma forma
do bloco de refeições, e esse é o ponto") — a forma foi, o texto não.

Além disso, o brief da fase pede estado vazio que **oriente ação** em vez de
só reportar ausência. Os dois hoje são "ícone + negação + botão". Uma estrutura
"estado · contexto · ação" custa uma linha em cada.

**Risco:** nenhum, desde que os testes que procuram o texto sejam atualizados
junto. `grep -rn "Nada registrado" src` antes de tocar.

---

## A4 — "Água" é uma linha órfã entre o herói e Alimentação

**Severidade:** baixa · **Esforço:** baixo · **Sprint:** 1 ou 5

`today-hydration.tsx`, renderizado em `hoje/page.tsx` com `mt-2`, entre o
herói e o grupo Alimentação/Treino. Não tem título de seção, não tem
superfície, e o comentário da página declara que ele deveria ter "o mesmo
tratamento de linha discreta de `TodayProgress`". Mas `TodayProgress` está no
fim da página, atrás de um `border-t` que o separa como apoio — e `Água` está
no meio, sem essa marcação. Dois elementos com o mesmo tratamento visual
ocupam ranks diferentes sem nada que diga isso.

---

# B. DIÁRIO / ALIMENTAÇÃO

## B1 — Planejado e consumido são distinguidos por um ícone de 32 px

**Severidade:** alta · **Esforço:** médio · **Sprint:** 2

**Localização:** `src/features/diet/components/meal-card.tsx:344-400` e
`src/features/diet/components/food-log-screen.tsx:280-412`.

Uma refeição do dia pode estar em três estados semanticamente distintos:

| estado | de onde vem | como aparece |
|---|---|---|
| planejada, não comida | dieta, `eaten === false` | card normal + check **vazio** |
| comida | check ou refeição à mão | card normal + check **cheio**, ou sem check |
| comida diferente do plano | `edited` | card normal + ícone de lápis |

**Os três cards são idênticos fora do botão.** Mesma borda, mesmo fundo, mesmo
peso de nome, e — o ponto crítico — **mesmo total de kcal com a mesma
tipografia**. Uma refeição planejada e não comida exibe "731 kcal" exatamente
como uma refeição comida exibe "731 kcal", enquanto o total fixo no topo da
tela conta só as comidas.

Que isso confunde não é hipótese minha: `food-log-screen.tsx:210-225` carrega
um aviso escrito depois de um achado real de 25/09/2026, dizendo em texto o
que o layout não diz —

> *"…os totais acima contam só o que já foi."*

Um parágrafo explicando por que os números discordam é o sintoma escrito por
extenso. A causa é que os dois estados têm o mesmo peso visual.

**Solução proposta:** diferenciar o estado *não comido* no próprio card, sem
entidade nova e sem tocar em `meal-execution.ts`. `checkState` já chega ao
`MealCard` como prop. O caminho mais barato e mais alinhado ao design system é
o total da refeição planejada em `text-ink-subtle` (em vez de `text-ink`),
ou o card inteiro em `tone="quiet"`, que é literalmente o tom que o `Card`
documenta para "conteúdo que ainda não aconteceu".

**Risco de regressão:** médio. `MealCard` é compartilhado entre o Diário e o
editor de Dietas. No editor **não existe** `checkState` (`undefined`), e a
aparência lá não pode mudar. A condição tem que ser `checkState === "unchecked"`,
nunca "falsy" — `undefined` é o caso do editor e o comportamento padrão dele
é "comido" (ver `isEaten` em `meal-execution.ts`). Um teste de geometria
existente não pega isso; precisa de teste de unidade para os três estados mais
o `undefined`, e um teste de navegador em 360 px para garantir que o tom não
mexeu na altura da linha.

## B2 — Duas listas mostram "planejado", com aparências diferentes

**Severidade:** média · **Esforço:** baixo · **Sprint:** 2

`PlannedMeals` (`food-log-screen.tsx:616`) é uma lista compacta, com título
`Planejado para <dia>`, linhas de borda fina e um check de 32 px. Logo abaixo,
o mesmo dia mostra refeições **também planejadas e também não comidas** — as
que vieram de "Começar de X" — como `MealCard` completos.

O motivo é legítimo e está documentado (uma lista é "nunca puxada pro dia", a
outra é "puxada mas não marcada"). O problema é que essa distinção é invisível
para quem lê: são duas caixas de "ainda não comi isso" com dois desenhos
diferentes, empilhadas.

**Solução proposta:** nesta sprint, não unificar o mecanismo — só o título.
`PlannedMeals` escreve à mão as classes de `Section size="compact"`
(`text-xs font-medium tracking-wide text-ink-subtle uppercase`, byte por byte
idênticas) em vez de usar o componente. Trocar pelo `Section` e dar ao grupo
de baixo um título irmão torna a separação legível sem tocar no domínio.

## B3 — Repetir refeição: o mecanismo já existe, o atalho não

**Severidade:** baixa · **Esforço:** baixo · **Sprint:** 2

`duplicateMeal`, `copyItemToMeal` e `moveItemToMeal` já estão implementados e
ligados ao `MealCard` (menu ⋮). O que não existe é repetir uma refeição **de
outro dia**. Recomendação: **não fazer nesta fase.** Exigiria ler outro
`FoodLog` dentro da tela, o que é fronteira de dados, não apresentação — e o
brief proíbe expandir escopo por conveniência. Registrado como melhoria
futura.

## B4 — `food-log-screen.tsx` tem 674 linhas

**Severidade:** baixa (dívida) · **Esforço:** médio · **Sprint:** nenhuma

`AGENTS.md` regra 8 pede arquivos até ~250 linhas. `meal-card.tsx` tem 782.
**Não refatorar durante esta fase** — a regra de escopo é explícita. Fica
registrado porque toda edição de Sprint 2 acontece dentro desses dois
arquivos, e isso aumenta o custo de revisão de cada diff.

---

# C. EVOLUÇÃO

## C1 — A tela responde "quais dados existem", nunca "o que mudou"

**Severidade:** alta · **Esforço:** médio · **Sprint:** 3

**Localização:** `src/features/workouts/components/evolution-screen.tsx:85-180`.

A ordem atual é: abas (Volume/Duração) → gráfico semanal → gráfico mensal →
Recordes → Histórico. Não há **nenhum** número resumo antes do primeiro
gráfico. A primeira coisa que a tela oferece é um controle, e a segunda é um
eixo — as duas pedem que o leitor faça a comparação de cabeça.

**Tudo que falta já está calculado.** `VolumePoint` (`services/history.ts:155`)
carrega `volumeKg`, `sets`, `sessions` e `durationMs` por período, e
`volumeByPeriod(history, 12, startOfWeek)` já é chamado na linha 72. "+12% de
volume nas últimas 4 semanas" e "4 treinos neste período" saem de somar pontos
que a tela já tem na mão — sem métrica inventada, sem score, sem nível, sem
entidade nova.

**Risco:** baixo no dado, médio na borda. Comparar duas janelas exige decidir
o que mostrar quando a janela anterior é zero (dividir por zero) ou quando há
menos de 8 semanas de histórico. A regra segura, e a que o projeto já usa em
`TodayProgress` (`changeKg === null` → "Registre de novo em alguns dias"), é
**omitir a comparação em vez de chutar**. Isso precisa de teste unitário
próprio, com histórico curto, histórico vazio e período anterior zerado.

## C2 — A data do recorde é calculada e jogada fora

**Severidade:** média · **Esforço:** trivial · **Sprint:** 3

`PersonalRecord` (`services/history.ts:94-105`) expõe `heaviestAt` e
`bestOneRepMaxAt`. A lista de Recordes em `evolution-screen.tsx:146-163`
renderiza nome, `reps × kg` e `1RM` — e **descarta as duas datas**.

O brief pergunta se há "oportunidade simples de mostrar exercício, carga,
repetição e data de maneira mais clara". Há: três dos quatro já estão na tela
e o quarto já está no objeto. `formatDate` já existe no mesmo arquivo
(linha 214).

**Risco:** baixíssimo no dado. O risco é de layout: a linha já tem quatro
colunas (nome flexível, `reps × kg`, `1RM` de 80 px) e a data é uma quinta.
A 320 px isso não cabe na mesma linha — tem que descer para uma segunda linha
sob o nome, como `SessionRow` já faz. **Medição obrigatória em Browser Mode
antes e depois**; é exatamente a classe de mudança que gerou o transbordo de
"SÉRIE" sobre "PESO" na aba Treino.

## C3 — O Histórico é renderizado inteiro, sem limite

**Severidade:** média · **Esforço:** baixo · **Sprint:** 3

`evolution-screen.tsx:174` — `{history.map((session) => <SessionRow …>)}`.
Todas as sessões concluídas, desde sempre, sempre. Recordes tem
`.slice(0, 12)`; Histórico não tem corte nenhum.

Três treinos por semana durante dois anos são ~312 linhas montadas a cada
abertura da tela, embaixo de dois gráficos. É densidade e é custo de render.

**Solução proposta:** cortar em N (12, o mesmo número que Recordes já usa) com
um "Ver mais" que revela o resto — não paginação, não virtualização, não
consulta nova. O brief é explícito: não remover informação para deixar
"clean", então o resto tem que continuar alcançável.

## C4 — Três estados vazios, três anatomias, na mesma tela

**Severidade:** alta (é o achado mais visível do app) · **Esforço:** baixo ·
**Sprint:** 5 (ou 3, para o bloco Treinos)

Confirmado na captura `evolucao-390-light.png`, uma única rolagem:

| bloco | componente | ícone | ação |
|---|---|---|---|
| Peso | `EmptyState` (design system) | sim | **botão sólido** "Registrar peso" |
| Treinos | `Card tone="quiet"` à mão | **não** | **link sublinhado** "Ir para os treinos" |
| Dieta | `Card tone="quiet"` à mão | **não** | **link sublinhado** "Ir para as dietas" |

Mesma pergunta ("ainda não há nada aqui"), mesma tela, três respostas visuais.

`src/design-system/components/empty-state.tsx` documenta a anatomia exata
— ícone, frase obrigatória, legenda opcional, ação opcional — e é usado por
**3 arquivos**. Outros **6** desenham `Card tone="quiet" text-center` à mão,
mais 2 variações em `Card tone="default"` no Hoje, mais um
`border-dashed … px-6 py-10` em `body-screen.tsx:210`. **Nove aparências para
um estado.**

**Solução proposta:** migrar os hand-rolled para `EmptyState`. Alguns não
cabem sem mudar o componente — `EmptyDay` do Diário tem quatro ações, não uma,
e `EmptyState` aceita `action` única. Esses ficam de fora; **não alargar
`EmptyState` para caber neles** (seria inventar abstração por causa de um
consumidor). Os de Evolução cabem inteiros.

## C5 — Duas implementações de aba na mesma página

**Severidade:** média · **Esforço:** baixo · **Sprint:** 5

`design-system/components/tabs.tsx` existe, tem `role="tab"` e indicador
animado, e é importado por **exatamente um arquivo** (`evolution-screen.tsx`,
para Volume/Duração). Duas seções acima, na mesma página,
`body-screen.tsx:196` desenha a sua própria faixa de abas com
`border-b-2 pb-2 text-xs`.

Resultado visível na captura: o seletor de métrica corporal ("Peso") lê como
um título minúsculo com um traço embaixo, enquanto o seletor logo abaixo lê
como abas de verdade. Mesma função, dois desenhos, 400 px de distância.

---

# D. MICRO UI / TEMA CLARO

## D1 — As marcas de escala do RPE medem 1,05:1 no tema claro

**Severidade:** alta · **Esforço:** trivial · **Sprint:** 4

**Localização:** `src/features/workouts/components/rpe-select.tsx:398-411`.

As oito marcas usam `stroke-canvas`; o trilho sob elas usa `stroke-muted`.
Calculado dos valores normativos de `tokens.css`:

```
claro   marca #f8fafc  sobre trilho #f3f4f6  →  1,05 : 1   (invisível)
escuro  marca #0b0d0f  sobre trilho #22272c  →  1,29 : 1   (fraco)
```

Na porção já preenchida do arco (`stroke-accent` #2A9162) as marcas aparecem
nos dois temas. É por isso que o defeito se manifesta como "os marcadores
somem à medida que o RPE cai" — não como "o seletor está quebrado".

**Isto é o item "marcadores do RPE" que o brief nomeia, e é um bug de
contraste real, não percepção.**

**Solução proposta:** trocar o token da marca por um que tenha contraste contra
`muted` nos dois temas — `stroke-line-strong` (#d1d5db no claro / #363c44 no
escuro) é o candidato, e é o token que o brandbook já designa para borda e
separação forte. Não criar token novo.

**Risco:** precisa ser verificado contra o arco preenchido também — a marca
tem que continuar legível sobre `accent`. Duas medições, quatro combinações
(claro/escuro × preenchido/vazio). **A matemática do ângulo não se toca.**

## D2 — A escala tipográfica da marca está morta no app

**Severidade:** alta (é a causa de quase todo achado de tipografia) ·
**Esforço:** médio · **Sprint:** 4

```
usos nas telas do produto:
  escala Tailwind  →  340   (text-xs 123, text-sm 181, text-xl 15, text-2xl 11, …)
  escala da marca  →    5   (text-h1 ×1, text-h2 ×4 — PageHeader e Landing)
  text-metric      →    1   (card decorativo da Landing)
  text-display / h3 / h4 / label  →  0
```

Consequência direta: existem **quatro registros de título** escritos à mão
pelo app, e `Section` só oferece dois.

| registro | classes | ocorrências |
|---|---|---|
| A | `text-sm font-medium text-ink` | 8 (Evolução ×4, aderência, food-picker, perfil ×2) |
| B | `text-xs font-medium tracking-wide text-ink-subtle uppercase` | 3, **idêntico byte a byte** a `Section size="compact"` |
| C | `text-sm font-semibold text-ink` | 1 (`backup-panel`) — difere de A só no peso |
| D | `text-lg font-semibold tracking-tight` | `Section size="default"` |

O registro **A é o título mais usado do app e não tem casa no design system.**
O registro **C existe só porque ninguém percebeu que A já existia.**

É também a resposta técnica para a pergunta do brief — *"a interface parece
elegante ou parece uma página administrativa?"*. Uma página administrativa é
exatamente o que se obtém quando tudo é `text-sm` e `text-xs` e o contraste de
rank vem de `font-medium` contra `font-normal`.

**Solução proposta para a Sprint 4:** dar a `Section` um terceiro tamanho que
cubra o registro A, migrar os 8 usos, e absorver C. **Não** migrar os 340 usos
de corpo de texto para a escala da marca — isso é uma refatoração de app
inteiro, fora de qualquer sprint desta fase, e seria exatamente o tipo de
mudança grande que a fase de estabilização existe para evitar.

## D3 — No tema claro, um card se separa da página por 1,05:1

**Severidade:** média · **Esforço:** médio (decisão de marca) · **Sprint:** 4

```
claro:   canvas #f8fafc  vs  surface #ffffff   →  1,05 : 1
         borda  #e5e7eb  vs  surface #ffffff   →  1,21 : 1
escuro:  canvas #0b0d0f  vs  surface #16191d   →  1,10 : 1
```

Os números são parecidos, a percepção não: no escuro a diferença cai numa
faixa de luminância onde o olho separa bem, no claro cai onde ele não separa.
Na captura `hoje-390-light.png` os cards de Alimentação e Treino praticamente
não lêem como superfícies — o que se vê é a borda de 1 px, sozinha.

**Isto é conflito com o brandbook, não descuido.** `tokens.css` documenta que
os dois valores são normativos ("fundo da aplicação sempre Background; card
sempre White") e que a hierarquia entre cards deixou de ser sombra porque a
pág. 24 proíbe sombra difusa.

**Recomendação: não resolver sozinho.** Qualquer saída (escurecer o canvas,
usar `line-strong` como borda de card no claro) diverge de uma página do
brandbook. É decisão do Pedro, e o padrão do projeto para divergência é
registrá-la em `docs/brandbook.md`. Levanto o número; não mexo.

## D4 — `ink-subtle` sobre `muted`: 4,39:1, já conhecido

`tokens.css:127` já documenta esse buraco e a saída por componente (o hover
troca para `ink-muted`, que mede 9,44:1), e `tokens.test.ts` guarda o destino
da troca. **Não é achado novo.** Listado só para que a Sprint 4 não "descubra"
de novo e tente consertar em token o que é, por decisão, resolvido em
componente.

## D5 — A folha do RPE

O brief pede para medir antes de mexer. **Não medi**: a folha só aparece
dentro de uma sessão em andamento, o que exigiria criar rotina e sessão no
IndexedDB local do Pedro — escrita de dado que a Sprint 0 não autoriza. Fica
como pendência explícita da Sprint 4, com o método já definido:
`getBoundingClientRect` do `<dialog>` contra a largura útil em 320/360/390 px
nas três densidades, e `document.elementFromPoint` nos oito valores.

---

# Achados fora de escopo (registrados, não tratados)

- `food-log-screen.tsx` 674 linhas, `meal-card.tsx` 782 — acima do teto de
  ~250 de `AGENTS.md`. **Não refatorar nesta fase.**
- Repetir refeição de outro dia (B3) — tocaria fronteira de dados.
- A divergência de contraste do tema claro (D3) — decisão de marca.

---

# Ordem sugerida, e o que muda em relação ao brief

O brief define Sprint 1 Hoje, 2 Diário, 3 Evolução, 4 micro UI, 5 consistência.
Dois ajustes que recomendo, ambos para reduzir retrabalho:

1. **D2 (terceiro tamanho de `Section`) sobe da Sprint 4 para o início.**
   Sprints 1, 2, 3 e 5 todas tocam títulos de seção. Fazer o token primeiro
   significa que as outras quatro usam a peça certa em vez de escreverem o
   registro A à mão e serem reescritas na Sprint 4.
2. **D1 (contraste do RPE) pode sair a qualquer momento.** É uma troca de
   classe, isolada num arquivo, com duas medições. Não depende de nada.

Se o Pedro preferir a ordem literal do brief, ela funciona — só custa um
segundo passe nos títulos.

---

# Limitações desta auditoria

Ditas explicitamente, porque afetam a confiança de cada achado:

- **Validei apenas estados vazios no navegador.** Este perfil local é anônimo
  e não tem perfil, dieta, refeição nem sessão. Ver Hoje com anel, Diário
  cheio e Evolução com gráficos exigiria escrever dado no IndexedDB do Pedro —
  fora do que a Sprint 0 autoriza. Os achados sobre estados preenchidos
  (A1 com perfil, B1, C1, C2, C3) vêm de leitura de código e de medição de
  token, **não de observação**. Cada um deles precisa de confirmação visual na
  sua própria sprint, antes da implementação.
- **Viewports observados:** 390 px e 320 px, densidade Padrão. Não validei
  360, 375, 414 nem 1280, e não validei Compacto/Confortável.
- **Temas:** ambos observados em `/hoje` e `/evolucao`, estados vazios.
- **Toque, teclado virtual, safe areas e Capacitor:** não observados.
- Os números de contraste são calculados dos valores de `tokens.css` pela
  fórmula WCAG, não amostrados de pixel renderizado. Diferem do pixel real se
  houver `opacity` ou mistura no caminho — nenhum dos casos medidos tem.
