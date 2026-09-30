# Roadmap

O que foi entregue, o que vem a seguir e o que ficou registrado para não
depender da memória de nenhuma conversa.

---

## ✅ Tema claro vira o principal, escuro vira opção — 29/09/2026

Decisão do Pedro depois do protótipo do Life Pro: no tema escuro (fundo quase
preto com um único verde vivo) as telas liam como "feitas por IA"; as mesmas
telas no claro não. Não é troca de cor da marca: Verdant e todos os tokens
continuam iguais nos dois temas.

- `DEFAULT_THEME` passou de `"dark"` para `"light"` (`design-system/theme/theme.ts`).
  Script de pré-hidratação e servidor leem a mesma constante, então não há
  troca de tema no primeiro paint.
- **Quem é afetado:** só quem nunca tocou no botão de tema. A preferência vive
  no `localStorage` do aparelho e não sincroniza com a conta; quem já escolheu
  escuro continua no escuro.
- O botão continua alternando claro/escuro.
- Testes: os que fixavam o padrão escuro passaram a fixar o claro. Revertido o
  padrão para `"dark"`, 9 caem. O do Turnstile passou a escolher o escuro
  explicitamente: esperar `"light"` passaria mesmo se o widget ignorasse o tema
  do app, porque claro também é o padrão da Cloudflare.
- Conferido no navegador: build de produção, perfil limpo, SO simulado em modo
  escuro: abre no claro.

**Pendência conhecida, não tratada aqui:** o `themeColor` do `app/layout.tsx`
segue o tema do sistema, não o do app. Quem está com o SO no escuro e o app no
claro vê a barra do navegador escura. O desencontro já existia no sentido
oposto com o padrão anterior.

## ✅ Trocar de aba esperava a rede — mesmo já em cache — 25/09/2026

Pedro: "tem vezes que a minha ação demora mto pra contabilizar... quando eu
clico em alguma aba, ele demora para abrir, as vezes tenho ate que clicar 2
vezes."

Causa raiz achada em `public/sw.js`: o `fetch` que o roteador do Next faz a
cada troca de aba (Hoje/Diário/Treinos/Evolução) — a URL com `_rsc=...` —
dividia a mesma estratégia `networkFirst` que a navegação de página inteira
usa. Isso significa que **todo clique numa aba, mesmo numa rota já visitada
e em cache, esperava uma ida e volta de rede de verdade** antes de mostrar
qualquer coisa. Num sinal ruim — o próprio arquivo já documentava "geralmente
um andar abaixo do nível da rua" — essa espera é exatamente onde nasce o
segundo clique: a pessoa acha que o primeiro não registrou.

- ✅ **`staleWhileRevalidate` nova, só para o cache de payload.** Responde
  com o que já está em cache na hora (sem esperar rede nenhuma), e atualiza
  o cache em segundo plano (`event.waitUntil`) para a próxima vez. Um deploy
  novo ainda chega — uma troca de aba depois, nunca travando a que disparou
  a atualização. A navegação de página inteira (`request.mode === "navigate"`)
  continua em `networkFirst`, sem mudança — ali faz sentido esperar a rede,
  é a única vez que uma casca desatualizada ficaria visível de verdade.
  Primeira visita a uma rota nova (nada em cache ainda) continua esperando
  a rede, porque não há outra coisa pra servir.
- ✅ **`load-sw.ts` (harness de teste) ganhou um `waitUntil` de verdade.**
  Era um no-op só no `dispatchFetch` — inofensivo enquanto nada chamava
  `waitUntil` fora de `install`/`activate`, mas a nova estratégia chama.
  Drena `pending` só depois de `event.result` resolver (não antes: no
  caminho de cache-hit, `waitUntil` é chamado dentro da mesma função
  assíncrona que resolve `result`, uma linha antes do próprio `return`).
- ✅ **4 testes novos**, rodando o `public/sw.js` de verdade (não uma
  reimplementação): responde do cache na hora mesmo com a rede prometendo
  outra coisa, atualiza o cache em segundo plano pro próximo clique, continua
  servindo o valor antigo se a atualização em segundo plano falhar, e uma
  rota nunca aberta antes continua esperando a rede.

`npm run verify` (typecheck + lint + 1936 testes) e `npm run build` verdes.
`VERSION` do service worker não mudou de propósito — o payload já em cache
continua válido, só a estratégia ao redor dele mudou.
⚠️ Efeito só chega no aparelho de verdade depois do deploy (o service worker
se auto-atualiza via `skipWaiting`/`clients.claim`, já existentes) — não dá
pra confirmar a sensação de "mais rápido" fora de um celular real.

---

## ✅ Três achados de um agente sem contexto do app — 25/09/2026

Pedro pediu uma validação externa do estado do produto (PDF pra ChatGPT
avaliar). Dos 5 pontos que voltaram, 3 (clareza do produto, montar dieta,
telas com dado real) foram testados ao vivo por um segundo agente — sem
nenhum contexto deste repositório, só a interface — e não se confirmaram
como problema. O teste achou 4 coisas reais; as 3 primeiras, por ordem de
impacto, foram corrigidas nesta entrada (a quarta é dado de catálogo
incompleto, não código — fica pra curadoria).

- ✅ **Diário: por que o total do dia fica zerado depois de importar uma
  dieta.** `startDayFromDiet` sempre semeou as refeições como `eaten: false`
  — proposital, é o que faz o anel de calorias contar só o que foi
  realmente comido — mas nada na tela dizia isso, então via como bug
  ("a importação falhou"), não como comportamento esperado. Uma linha nova
  abaixo do total ("N refeições planejadas ainda não foram marcadas como
  comidas — os totais acima contam só o que já foi") aparece só enquanto
  existir alguma, e some sozinha assim que a última é marcada.
  `food-log-screen.tsx`.
- ✅ **Diário: ninguém descobre a vinculação de dieta por dia da semana.**
  "Começar de uma dieta" é o caminho mais natural pra quem nunca vinculou
  nada — e é também exatamente por isso que o card "Dieta" da Evolução
  fica sempre vazio pra essa pessoa, sem ela nunca saber que existe outro
  jeito. Uma sugestão discreta ("Sabia que dá pra vincular uma dieta a
  dias da semana?") aparece só nesse estado (nenhuma dieta jamais vinculada
  a nenhum dia) e some pra quem já usa o recurso — não é a métrica de
  aderência que mudou, só a descoberta dela. `food-log-screen.tsx`
  (`EmptyDay`).
- ✅ **Perfil: o botão de ritmo mostra um número que o resultado final não
  bate.** "Moderado (0,82 kg)" é o teto de 1% do peso corporal — mas se o
  déficit necessário pra chegar lá passar do teto de 25% do TDEE, o
  resultado final entrega um ritmo menor (ex.: 0,63 kg/semana) sem
  nenhuma explicação visível ligando os dois números. O aviso que já existia
  pro corte de déficit (`DEFICIT_CLAMPED`/`SURPLUS_CLAMPED`) agora nomeia o
  ritmo semanal resultante na mesma frase. `core/nutrition/energy.ts`.
- ✅ **6 testes novos** cobrindo os três casos (a nota aparecendo/sumindo no
  Diário, a sugestão de vinculação aparecendo só quando ninguém nunca usou
  o recurso, e a mensagem de clamp nomeando o ritmo certo).

Verificado ao vivo (`next build` + `next start` + Playwright, não só nos
testes) reproduzindo o cenário exato que o agente encontrou — os três
cenários de antes/depois batem com o esperado.

`npm run verify` (typecheck + lint + 1932 testes) e `npm run build` verdes.

---

## ✅ `MacroDonut` sem `width`/`height` — só apareceu ao vivo — 25/09/2026

**Achado gerando as capturas de tela pra um PDF de visão geral do produto**
(pedido do Pedro, não uma entrega de feature): o donut de `PlanSummary`
ocupava a largura inteira do card, gigante — não os 64 px pedidos. Os
testes (`macro-donut.test.tsx`) nunca pegaram isso porque jsdom não faz
layout de verdade; contam `<circle>`/`<text>`, não pixel.

- ✅ **Causa:** o `<svg>` só tinha `viewBox`, nunca `width`/`height`. Sem
  os dois, um SVG inline sem dimensão intrínseca cresce pra preencher o
  espaço disponível do flex/bloco em vez de respeitar `size` — e como
  `viewBox` escala todo o conteúdo junto, os números de porcentagem
  cresciam junto com os arcos, gigantes.
- ✅ **Correção:** `width={size}` e `height={size}` no `<svg>`, ao lado do
  `viewBox` que já existia.

Prova real: rodando `next build && next start` (produção, sem o problema
de `eval()`/CSP do modo dev nesta automação — ver
`ssr-indexeddb-lacalle-life` na memória) e conferindo com Playwright MCP.
Confirmado nos três lugares que usam `MacroDonut` — resumo, cada preset e
o preview do personalizado — com print de cada um.

`npm run verify` (typecheck + lint + 1928 testes) e `npm run build`
verdes.

---

## ✅ Donut menor, e movido pro picker de distribuição — 25/09/2026

Segundo ajuste na mesma entrega: "Nao era eesse tipo de circulo que eu
queria, era dentro da mudança de distruibuição, mas ficou bom assim, mas
deixe ele menor... e aplique os gráficos na aba de Ajustar Distribuição de
Macros."

- ✅ **`MacroDonut` generalizado** — trocou `macros: Macros` (gramas) por
  `shares: Record<MacroKey, number>` (três pesos quaisquer) e ganhou
  `size`/`showLabels`. Deixou de saber o que soma proteína/carbo/gordura em
  kcal — quem chama decide a unidade (kcal-por-macro no resumo, % direto no
  preset), o componente só desenha a proporção. Isso que permitiu reusar a
  mesma peça nos dois tamanhos sem duplicar a matemática do arco.
- ✅ **`PlanSummary`** — donut de 64 px (era 128; "deixe ele menor").
- ✅ **`MacroSplitDialog`** — cada preset ganha um donut de 28 px sem
  legenda (`showLabels={false}`) ao lado do nome, direto das próprias % do
  preset — sem depender de nenhum plano calculado. "Automático" fica sem
  donut de propósito: sua distribuição real depende do peso e objetivo do
  perfil, não é um número fixo que esta tela já tem à mão (na dúvida,
  omitir). "Personalizado" ganha um donut de 56 px, com legenda, que
  atualiza ao vivo assim que os três campos têm número — antes de
  "Salvar", antes até da soma bater 100%.
- ✅ **6 testes novos/ajustados** — `MacroDonut` com a API nova, e dois
  testes no dialog: um donut por preset (nenhum em "Automático"), e o preview
  ao vivo aparecendo só quando os três campos estão preenchidos.

`npm run verify` (typecheck + lint + 1928 testes) e `npm run build` verdes.

---

## ✅ Ícone da água azul, gráfico de distribuição de macros — 24/09/2026

Ajuste nas duas entregas de hoje, pedido pelo Pedro depois de ver a versão
sem cor/sem gráfico: "vamos deixar o desenho da água azulzinho, além disso,
a distribuição vamos fazer o gráfico, igual mandei em imagem. Vai ficar mais
fácil do usuário enxergar."

- ✅ **Água, ícone azul.** `text-protein-text` — o único azul que o design
  system já tem (`--protein`, tokens.css), reaproveitado em vez de criar um
  token novo. `TodayHydration`/`WaterCard` nunca competem visualmente com o
  azul do grid de macro pelo mesmo motivo de sempre: contexto e rótulo já
  diferenciam ("Água" vs. "Proteína"), o par nunca aparece como dois pontos
  de dado disputando o mesmo significado.
- ✅ **`MacroDonut`** (`features/profile/components/`) — reverte a decisão
  "sem gráfico" da entrada de distribuição de macros abaixo, só na tela de
  resumo (`PlanSummary`): o app de referência também desenha a lista de
  presets sem gráfico nenhum, e só o "Goals" (o resumo) tem o donut — a
  mesma divisão que este app já tinha, sem querer. Lê a proporção direto dos
  gramas de `plan.targets` (não de `macroSplit`), então funciona igual em
  modo automático ou personalizado, sem duplicar o que `distribution.ts` já
  decidiu. `aria-hidden`: o grid de gramas ao lado já é a fonte acessível.
- ✅ **4 testes novos** (`macro-donut.test.tsx`) — um arco por macro com
  fatia de verdade, rótulo de porcentagem certo, fatia fina demais pulada, e
  divisão por zero segura quando tudo está zerado.

`npm run verify` (typecheck + lint + 1925 testes) e `npm run build` verdes.
Mesma ressalva de verificação visual das duas entregas anteriores.

---

## ✅ Meta de água: nova, aditiva, sincronizada — 24/09/2026

Segunda metade do pedido do Pedro (ver entrada logo abaixo, distribuição de
macros) — água como meta própria, fora dos macros, fórmula `peso (kg) × 35
mL`, com progresso de verdade, não só um número solto.

O app não tinha nenhum conceito de hidratação — sem campo, sem tela, sem
registro — então isto entrou como feature nova do zero, seguindo o mesmo
padrão do `BodyEntry` (id = dia, um registro por dia, sem substrutura pra
mesclar) em vez do `FoodLog` (que precisa de merge por `Meal.id`).

- ✅ **`computeHydrationTargetMl(weightKg)`** (`core/nutrition/hydration.ts`)
  — irmão de `distribution.ts`, fora de `Macros`/`distribution.ts` de
  propósito: é o "não precisa estar dentro dos macros" que o Pedro pediu, e
  o mesmo padrão de "uma função, uma fonte" do resto do motor.
- ✅ **`features/hydration`, domínio novo** — `WaterEntry` (`types/`),
  `WaterRepository`/`LocalWaterRepository`/`SyncingWaterRepository`
  (`data/`), `useWaterDay` (`hooks/`, espelha `useFoodLogDay` — otimista,
  com conflito versionado — mas simplificado: um campo só, sem "mover de
  dia").
- ✅ **Migração Supabase (0031) aplicada em produção** — tabela
  `water_entries`, RLS, `save_water_entry`/`delete_water_entry` — escrita
  direto na forma final e correta que `save_body_entry`/`delete_body_entry`
  só alcançaram depois de 3 gerações de bugs (referência ambígua,
  applied/revive ausente, checagem de dono no revive), sem repetir nenhuma
  delas. `get_advisors` confirmou: mesmo padrão de aviso (RPC
  `security definer` executável por `authenticated`) que as outras 18
  funções já têm, nada novo introduzido.
  **Achado no caminho:** o projeto Supabase certo não é o que uma primeira
  checagem (`list_projects`) mostrou — esse (`bzsqohkyadmywojmqhlk`,
  "Lacalle Life" com espaço) está pausado e parece abandonado. O banco real,
  confirmado batendo contra `NEXT_PUBLIC_SUPABASE_URL` do `.env.local`, é
  `rtvscxcfwfsamxatkwit` ("Lacalle-Life", com hífen) — já ativo, não
  precisou de restore nenhum. Path perigoso evitado: o Pedro pediu pra
  pausar exatamente o banco de produção por engano; a migration só foi pro
  projeto certo depois de confirmar isso com ele.
- ✅ **Backup/export estendido** — `WaterRepository` ganhou `listAll()` (não
  estava no escopo original, YAGNI — mas o backup precisa enumerar tudo, e
  sem isso água nunca sobreviveria a perder o aparelho). `water` é opcional
  no envelope do backup (`backup-schemas.ts`/`backup.ts`), não obrigatório
  como os outros sete — um backup de antes de hoje não tem essa chave, e não
  pode parar de restaurar por causa disso.
- ✅ **UI, sem gráfico/barra** — `WaterCard` no Diário (irmão de
  `FoodLogScreen`, não dentro: aquele arquivo já passa de 600 linhas) com
  dois atalhos (+200/+500 mL) e o total clicável pra corrigir à mão.
  `TodayHydration` no Hoje, mesma linha discreta que `TodayProgress` já usa
  — nunca dentro de `TodayEnergy`, que é onde `MACRO_CODING` mora.
- ✅ **24 testes novos** cobrindo fórmula, schema, repositório local
  (incluindo conflito de escrita concorrente), decorador de sync, hook e os
  dois componentes.

`npm run verify` (typecheck + lint + 1921 testes, 1920 passaram — o único
que falhou foi por timeout de 5s e só quando a suíte inteira roda sob carga,
`identity-isolation.test.ts`; confirmado flakiness de máquina rodando ele
isolado duas vezes seguidas (passou nas duas), não regressão) e
`npm run build` verdes.
⚠️ Mesma ressalva da entrega anterior: não confirmado ao vivo no navegador
desta automação (overlay de erro do Next trava o renderer aqui). Achado no
caminho, não deste código: os logs do `next dev` mostram um
`indexedDB is not defined` de `composition/repositories.ts` rodando durante
SSR — reproduz também na Landing Page, então é anterior a esta entrega, não
causado por ela. Vale o Pedro checar `/hoje` e `/diario` no Chrome de
verdade antes de considerar fechado, e talvez investigar esse SSR à parte.

---

## ✅ Perfil: distribuição de macros por % (ajuste opcional) — 24/09/2026

Pedro sentiu a proteína alta demais na meta atual e trouxe o print de outro
app (tela "Goals", presets "Diet type") como referência de querer balancear
os três macros manualmente. `core/nutrition/distribution.ts` calculava
proteína/gordura/carbo só a partir de peso + objetivo, sem nenhuma forma de
ajuste — e o comentário do arquivo já era explícito: é a única fonte de meta
de macro do app, então a distribuição por % tinha que entrar como um segundo
*input* dessa mesma função, nunca uma segunda implementação. **Ajuste
opcional, não substituição**: quem nunca abrir a tela nova continua recebendo
a meta automática de sempre. Parte B (meta de água, separada dos macros)
segue como item próprio abaixo.

- ✅ **`NutritionProfile.macroSplit` opcional** (`core/nutrition/profile.ts`)
  — três percentuais que somam 100 (`macroSplitSchema`), ausente = automático.
  `computeDistribution` ramifica no topo: com split, aloca os gramas direto
  da % (mesma técnica de "carboidrato pega o resto em kcal" que o algoritmo
  por prioridade já usava, pra manter a soma batendo dentro da tolerância).
  `findViolations` não mudou nada — já opera sobre os gramas resultantes,
  não sobre como foram calculados, então um preset inviável (ex.: Cetogênica
  numa meta de kcal baixa) cai no mesmo "não é possível montar uma meta
  segura" que um automático inviável já caía.
- ✅ **`MACRO_SPLIT_PRESETS`** (`core/nutrition/constants.ts`) — Padrão,
  Balanceada, Pouca gordura, Rica em proteína, Cetogênica, valores nossos
  (não copiados do app de referência).
- ✅ **`MacroSplitDialog`** (`features/profile/components/`) — sem
  donut/gráfico de propósito: é a mesma régua já registrada nesta lista pro
  card de refeição ("mostra os números mesmo, não esse graficozinho"), e
  esta é a tela onde alguém *escolhe* uma distribuição, não só lê uma. Tocar
  num preset (ou "Automático") comita na hora; "Personalizado" expande três
  campos e só libera "Salvar" com a soma em 100%.
- ✅ **`ProfileScreen`/`PlanSummary`** — nenhuma persistência nova, o split
  mora dentro do `NutritionProfile` que já viaja pelo `profileRepository`
  existente. `PlanSummary` ganha uma linha mostrando o preset ativo (ou
  "Distribuição automática") com um botão pra ajustar.
- ✅ **12 testes novos** (`distribution.test.ts`, `macro-split-dialog.test.tsx`,
  mais os 3 existentes de `plan-summary.test.tsx` atualizados) — presets
  somando 100, alocação por %, o mesmo gate de segurança recusando um split
  inviável, e a soma de 100% travando o "Salvar" do personalizado.

`npm run verify` (typecheck + lint + 1897 testes) e `npm run build` verdes.
⚠️ Não confirmado ao vivo no navegador desta vez: o overlay de erro do Next
dev trava o renderer neste ambiente de automação (reproduz até na Landing
Page, sem relação com esta entrega) — Pedro, vale abrir `/perfil` no seu
Chrome de verdade antes de considerar fechado.

---

## ✅ Detalhes do alimento: gordura saturada quebrando linha, de novo — causa raiz diferente da primeira vez — 24/09/2026

Pedro: "deu novamente o erro de desing da gordura saturada estar quebrando
linha." A correção de 23/09/2026 (`items-end` no grid, ver a entrada "Diário:
total da refeição colado no nome, caixas de nutriente alinhadas" abaixo)
tinha ficado com um ⚠️ próprio: não verificada com dado real no navegador.
Foi exatamente aí que escondia um bug diferente, não uma regressão da mesma
correção.

- ✅ **Causa raiz de verdade, achada reproduzindo na tela real** (produção,
  "Marmita Carne de Panela" do Pedro, coluna estreitada via
  `el.style.maxWidth` no elemento de verdade — não um resize de viewport,
  pouco confiável neste ambiente). `align-items: flex-end` alinha a caixa
  **inteira** de cada célula do grid pelo fim da linha, não só o input —
  então o rótulo curto de "Sódio" descia junto, e o texto dele ia parar na
  altura da *segunda* linha de "Gordura saturada", lendo como se as duas
  frases fossem uma só. Diferente do bug original (as caixas de input
  desalinhadas), por isso parecia "a mesma coisa de novo" sem ser a mesma
  causa.
- ✅ **`min-h-8` no `<span>` do rótulo (`NutrientField`, dentro de
  `meal-item-detail-screen.tsx`), em vez de `items-end` no grid.** Reserva a
  altura de duas linhas pra qualquer rótulo, curto ou longo — o texto de
  cada um fica sempre ancorado no topo, e o input de baixo, vindo depois
  dessa altura fixa nos dois lados, sai alinhado de qualquer jeito, sem
  precisar mover a caixa inteira. Confirmado lado a lado ("atual" vs.
  "proposta", HTML solto com as classes reais do Tailwind) antes de tocar o
  componente de produção.
- ✅ **1 teste novo**, em `meal-item-detail-screen.test.tsx`: confere
  `min-h-8` no rótulo e a ausência de `items-end` no grid — trava o
  mecanismo da correção, não só o efeito visual.

---

## ✅ Diário: desfazer disponível mesmo bem depois do toast — 24/09/2026

**Ampliação da entrada "Transformar em 1 alimento: desfazer, e virar
alimento de verdade" abaixo.** Pedro, numa refeição que já tinha juntado
antes ("Marmita Carne de Panela"): "quero que apareça o desfazer para uma
refeição que eu ja juntei." O toast de 23/09/2026 desfazia certo, mas só
enquanto estivesse na tela — sem nada pra desfazer depois que ele já tinha
fechado.

- ✅ **`Meal.consolidatedFrom?: readonly MealItem[]` (novo campo, mesma
  convenção de `plannedSnapshot`)** — os itens de antes da transformação,
  congelados na própria refeição, não só numa variável local do hook.
  Presente exatamente quando há algo pra desfazer; `undefined` — nunca
  `[]` — antes da primeira transformação, e limpo de volta a `undefined`
  pelo próprio desfazer. Sincroniza sem mudança nenhuma em
  `food-log-merge.ts`: o merge já é por refeição inteira (`deepEqual` +
  "mais recente vence"), sem regra por campo.
- ✅ **`edit-diet.ts` — `replaceMealItems` virou `consolidateMealItems` +
  `undoConsolidateMealItems`.** A primeira grava `items` e congela o que
  havia em `consolidatedFrom`; a segunda restaura de lá e limpa o campo —
  um clique repetido, ou um clique tardio numa refeição que mudou de outro
  jeito, não encontra nada pra restaurar e não faz nada. `useConsolidateMeal`
  passou a chamar as duas em vez de fechar sobre uma cópia local dos itens
  antigos — o toast e o ⋮ da refeição agora rodam o mesmo mecanismo, não
  dois.
- ✅ **`meal-card.tsx` — "Desfazer transformação" no ⋮**, ao lado de
  "Transformar em 1 alimento" (os dois nunca aparecem juntos: transformar
  pede 2+ itens, e uma transformação bem-sucedida deixa exatamente 1).
  Aparece sempre que `meal.consolidatedFrom` tem algo, independente de
  quando a transformação aconteceu ou se o toast ainda existe.
- ✅ **9 testes novos** — `edit-diet.test.ts` (congela e restaura, no-op sem
  histórico, no-op na segunda chamada) e `meal-card.test.tsx` (some sem a
  prop, some numa refeição nunca transformada, chama `onUndoConsolidate`).
  Os 4 testes já existentes de `use-consolidate-meal.test.tsx` continuam
  verdes sem alteração — a troca de mecanismo não mudou o comportamento
  observável.

---

## ✅ Transformar em 1 alimento: desfazer, e virar alimento de verdade — 23/09/2026

**Correção/ampliação da entrada logo abaixo.** Pedro, depois de usar:
"faltou um botão para desfazer, alem disso, queria que isso virasse um
alimento, e eu poder usar em outros dias no diario e ate mesmo adicionar
na dieta. Ent ele deve criar um novo alimento mesmo." A primeira versão
criava um item avulso (`foodId: null`) — servia só naquela refeição, não
aparecia buscando em outro dia nem na dieta.

- ✅ **Cria um `Food` de verdade no catálogo**, reaproveitando
  `createCustomFood` (o mesmo serviço que a tela normal de criar alimento
  usa) em vez de inventar um caminho novo. O item que substitui os
  alimentos da refeição referencia esse `Food` pelo `foodId`
  (`createMealItem`, também reaproveitado — o mesmo par que
  `useApplyPickedFood` já usa quando uma busca normal escolhe um
  alimento). Resultado: "Marmita de carne" agora aparece buscando em
  qualquer outro dia do Diário, e ao montar uma Dieta — exatamente o
  pedido.
  - Nova categoria no formulário (`Select`, reaproveitando
    `FOOD_CATEGORIES`/`FOOD_CATEGORY_LABELS` de `custom-food-form.tsx`):
    `Food.category` é obrigatório, e um prato misto não tem uma categoria
    óbvia — "proteína" como ponto de partida, trocável.
  - O nome e a densidade combinada passam pela mesma validação
    (`customFoodSchema`) que o formulário normal já aplica, antes de
    salvar — não confia cegamente no que foi calculado.
- ✅ **Botão de desfazer, num toast** — `useToast`/`ToastProvider` ganham
  uma ação opcional (rótulo + callback), não só uma mensagem; o toast fica
  6s em vez de 3,2s quando carrega uma ação, tempo real pra notar, decidir
  e tocar. "Desfazer" restaura a lista de itens exata de antes
  (`replaceMealItems`, a mesma função de baixo nível que fez a
  transformação, rodada ao contrário) — o `Food` recém-criado continua no
  catálogo, apagável de Alimentos como qualquer outro alimento criado à
  mão, do jeito que já seria se tivesse sido um engano feito pela tela
  normal.
- ✅ **`consolidateMealItems` vira dois lugares distintos:**
  `replaceMealItems` (`edit-diet.ts`) — só troca a lista de itens, usada
  tanto pra transformar quanto pra desfazer — e `useConsolidateMeal`
  (hook novo), que orquestra criar o `Food`, salvar, trocar os itens e
  mostrar o toast. Peso real (`combinedMealTotals`, `diet-macros.ts`) e a
  chamada ao repositório de alimentos não cabiam numa função pura de
  `edit-diet.ts` — dependem de I/O assíncrono, que o resto do arquivo
  nunca tem.
- ✅ **20 testes novos** entre `toast.test.tsx` (a ação, o prazo maior),
  `use-consolidate-meal.test.tsx` (cria o `Food`, substitui os itens,
  mostra o toast, desfaz, recusa nome em branco), `edit-diet.test.ts`
  (`replaceMealItems`) e `meal-card.test.tsx` (a categoria no
  formulário).

---

## ✅ Diário: transformar uma refeição em 1 alimento — 23/09/2026

Pedro: "minha refeição foi arroz, feijão, carne e purê, mas quero um botão
pra transformar ela em 'marmita de carne' por exemplo".

- ✅ **`consolidateMealItems` (`edit-diet.ts`)** — substitui os alimentos da
  refeição por um só, nomeado pela pessoa. O total combinado é
  `mealMacros` (a soma já arredondada por item, a mesma que a tela já
  mostra) — o número na tela não se move ao virar uma linha só, muda
  quantas linhas levam até ele. O peso é o peso real somado dos alimentos
  (`per100gFrom`, nova função em `core/domain/macros.ts`, a inversa de
  `scaleMacros`), não um placeholder tipo 100 g — uma porção desse
  alimento novo continua significando algo depois. `foodId: null`: nunca
  esteve no catálogo, igual a qualquer alimento digitado à mão.
- ✅ **`meal-card.tsx`** — "Transformar em 1 alimento" no ⋮, só com 2+
  alimentos (nada pra combinar com 0 ou 1) e só no Diário (`onConsolidate`
  indefinido no editor de dieta — é sobre o que já foi comido, não um
  plano). Abre uma folha com a lista dos alimentos atuais, o total
  combinado (`MacroSummary`) e um campo de nome — o mesmo total que a
  pessoa já está olhando, pra não confirmar às cegas o que vai perder de
  detalhe.
- ✅ **Sem tocar `DietEditor`** — o prop é opcional, seguindo a mesma regra
  de escopo de `onOpenItemDetail`/`checkState` já estabelecida no arquivo.
- ✅ **15 testes novos** — `macros.test.ts` (`per100gFrom`), `edit-diet.test.ts`
  (substituição, totais preservados, peso real, sem proveniência,
  no-ops) e `meal-card.test.tsx` (o botão só aparece com 2+ alimentos e
  `onConsolidate`, o formulário, o fluxo completo).

---

## ✅ Excluir refeição/alimento: texto de confirmação invisível — 23/09/2026

Pedro, olhando o ⋮ de "Café da manhã": "Eu vi aqui, e o texto de
confirmação da exclusão ainda nao aparece" — print mostrando uma barra
sólida vermelho-coral, sem nenhum texto.

- ✅ **Causa raiz, em `confirm-button.tsx` (componente compartilhado, não
  em cada tela).** Estado armado ("segundo toque, vai apagar de verdade")
  pinta `bg-danger` sólido + `text-danger-ink` pra contraste — mas
  `meal-card.tsx` e `meal-item-row.tsx` passam `className="... text-danger
  ..."` pra deixar o ícone vermelho já em repouso, sem depender de hover.
  Como `className` entrava por último na mesma `cn()`, esse `text-danger`
  também vencia o `text-danger-ink` do estado armado — texto vermelho
  sobre fundo vermelho sólido, mesma cor dos dois lados. "Excluir?" e
  "Remover?" ficavam lá, só que invisíveis.
- ✅ **Corrigido uma vez, no componente — nunca nas duas telas que o
  usam.** As classes do estado armado agora vêm depois de `className` na
  fusão (não antes), então sempre vencem, custe o que custar o chamador
  tiver passado; as classes do estado em repouso continuam antes,
  deixando o chamador customizar normalmente. `meal-item-row.tsx` tinha o
  mesmo bug, no "Remover?" de excluir um alimento — nunca reportado, mas
  a mesma causa, corrigida de graça.
- ✅ **Prova de verdade, não só teste verde.** Escrito o teste, revertido
  o `confirm-button.tsx` pra antes da correção (`git stash`) e confirmado
  que ele falha do jeito certo (`text-danger` sobrevivendo no estado
  armado) antes de reaplicar a correção — a prática que já rendeu memória
  própria neste projeto.

---

## ✅ Diário: total da refeição, largura certa pra centralizar — 23/09/2026

**Quinta correção na mesma tarde.** O layout empilhado da entrada logo
abaixo agradou — "agora sim!!" — mas ainda não centralizava de verdade: as
quatro colunas ficavam visivelmente empurradas pra esquerda, com um vão à
direita do tamanho de quase uma coluna inteira.

- ✅ **A causa: o bloco vivia dentro da coluna que divide espaço com o ⋮.**
  `<MacroSummary layout="stacked">` estava dentro do
  `<div className="min-w-0 flex-1">` do cabeçalho — a mesma coluna que o
  nome e o horário usam, e que reparte a linha do `header` com o botão ⋮
  (`shrink-0`, ao lado). `grid-cols-4` centraliza certinho contra a
  largura que *recebe*, só que essa largura nunca foi a do card inteiro —
  era o card menos o espaço do ⋮. O resultado: quatro colunas
  perfeitamente centralizadas numa caixa que, ela mesma, não estava
  centralizada no card.
- ✅ **`meal-card.tsx`** — o bloco sai de dentro do `header` e vira um
  irmão dele, depois do `</header>` fechar. Sem mais nenhum botão
  dividindo a linha com ele, usa a largura inteira do card (só o padding
  do próprio `Card`), e `grid-cols-4` finalmente centraliza contra a
  largura certa.
- ✅ **Verificado visualmente, não só por medição** — a mesma sessão
  encontrou uma inconsistência real entre `getBoundingClientRect()` e
  `getComputedStyle().width` neste ambiente (~15% de diferença, uniforme
  em toda a árvore — provável artefato do sistema de densidade da UI
  aplicando escala). Como não dava pra confiar em medir pixel a pixel
  aqui, a confirmação foi por screenshot isolado (markup real, CSS
  compilado do app): antes, as quatro colunas paravam a ~85% da largura
  do card; depois, vão de ponta a ponta.

---

## ✅ Diário: total da refeição, layout empilhado (print de referência) — 23/09/2026

**Quarta correção na mesma tarde — a `justify-center` da entrada logo
abaixo nunca chegou a ser testada no celular real do Pedro**, que mandou
outro print ainda mostrando "3,5 Gord" preso na esquerda. Junto, mandou uma
referência visual de outro app (valor grande em cima, rótulo pequeno
embaixo, quatro colunas iguais) e foi direto: "Os 4 devem estar na mesma
linha, altura, mas devem estar mais centralizados doq os dos alimentos".

- ✅ **Parar de tentar consertar o wrap, e tirar o wrap do caminho.**
  `layout="inline"` (o de sempre) põe cada figura como "valor unidade"
  lado a lado — a largura de cada uma é a SOMA dos dois. Com quatro
  figuras grandes, essa soma não cabe na largura de um card de celular,
  não importa o que aconteça com `justify-content`. `layout="stacked"`
  (novo, só para o total da refeição) põe o valor em cima do rótulo — a
  largura de cada coluna é o MAIOR entre os dois, quase sempre o valor
  sozinho, já que os rótulos daqui são curtos (kcal/Prot/Carb/Gord). Isso
  sobra folga de sobra pra caber numa linha só, sempre, e o `grid-cols-4`
  centraliza as quatro colunas por construção — não tem wrap pra
  centralizar errado.
- ✅ **`macro-summary.tsx`** — `center` sai (não sobrevive nem uma entrada
  inteira), entra `layout?: "inline" | "stacked"`. `"inline"` continua
  sendo o padrão, sem nenhuma mudança pros outros dois lugares que usam
  `size="lg"` (`MealItemDetailScreen`, os fallbacks sem perfil).
- ✅ **`meal-card.tsx`** troca pra `layout="stacked"`.
- ✅ **Verificado isolado, reproduzindo a largura real de um card de
  celular** (com o botão ⋮ tirando espaço do lado, como no app de
  verdade) — cabe numa linha, as quatro grandes, centralizadas, visual
  batendo com o print de referência.
- ⚠️ **Suíte de testes completa instável nesta sessão** (máquina com
  Chrome/Steam/VPN rodando junto, muitos ciclos de `verify`/`build`
  seguidos — falhas dispersas em arquivos sem nenhuma relação com esta
  mudança, cada rodada num arquivo diferente). `tsc`, `eslint` e a suíte
  inteira de `src/features/diet` (319 testes) rodaram limpos, isolados,
  mais de uma vez.

---

## ✅ Diário: as quatro figuras maiores, de verdade centralizadas — 23/09/2026

**Terceira correção na mesma tarde.** A entrada logo abaixo trocou pra só
kcal crescer, achando que resolvia o pedido original com menos risco. Pedro
foi direto: "eu nao quero que apenas a KCAL esteja grande... é pra ter os 4
campos maiores e centralizados!! Nao erre dessa vez". As quatro, sempre foi
isso — o problema real nunca foi o tamanho, foi a centralização não
funcionar quando a linha quebrava.

- ✅ **A causa raiz de verdade, desta vez.** `justify-center` estava num
  `<div>` embrulhando `MacroSummary` por fora — isso centraliza o bloco
  inteiro como uma unidade só. Quando as quatro figuras não cabem numa
  linha (fecho num celular estreito) e quebram em duas, é o `dl` — o
  próprio container com `flex-wrap` — que precisa do `justify-center`,
  porque `justify-content` se aplica por linha, não pelo bloco todo.
  Reproduzido isolado antes de mexer: a versão errada deixava "3,5 Gord"
  pregado na borda esquerda da segunda linha; com `justify-center` no
  `dl`, a segunda linha centraliza sozinha, igual à primeira.
- ✅ **`macro-summary.tsx`** — `emphasizeKcal` sai, entra `center`
  (booleano, no próprio `dl`). `size="lg"` continua intocado — os dois
  lugares que já usavam as quatro figuras grandes de propósito
  (`MealItemDetailScreen`, os fallbacks sem perfil) nunca tiveram esse
  problema, porque nunca dividem a largura da tela com nada ao lado.
- ✅ **`meal-card.tsx`** — volta a `size="lg"`, agora com `center` em vez do
  `<div className="flex justify-center">` de antes.
- ✅ **Verificado isolado de propósito no cenário que quebra** — não só o
  caso feliz (cabe numa linha), mas forçando a largura estreita o
  suficiente pra reproduzir a quebra real do print do Pedro, e confirmando
  que a segunda linha centraliza também.

---

## ✅ Diário: só kcal cresce no total da refeição, não as quatro figuras — 23/09/2026

**Segunda correção na mesma tarde.** A entrada logo abaixo usou `size="lg"`
nas quatro figuras do total da refeição. Pedro: "Voce deixou muito grande
agora, fora que nem deixou ele centralizado" — print real mostrando "192
kcal 7 Prot 32,3 Carb" numa linha e "3,5 Gord" sozinho, à esquerda, na linha
de baixo.

- ✅ **Causa raiz: quatro figuras em `text-xl` juntas não cabem na largura
  de um card de celular.** `justify-center` no bloco todo não tem efeito
  visível quando o bloco já ocupa quase a largura inteira do card — o que
  "centralizar" quer dizer quando não sobra espaço nenhum dos dois lados?
  E a segunda linha, sozinha, nunca fica centralizada por conta própria —
  ela fica onde o `flex-wrap` a colocou, à esquerda.
- ✅ **`macro-summary.tsx` ganha `emphasizeKcal`** — só a figura de kcal vai
  pra `text-xl font-medium`; Prot/Carb/Gord continuam exatamente no tamanho
  padrão. `size="lg"` continua existindo do jeito que estava, pros dois
  lugares que já usavam as quatro figuras grandes de propósito
  (`MealItemDetailScreen`, o fallback sem perfil de `food-log-screen`/
  `diet-editor`) — nada ali mudou.
- ✅ **`meal-card.tsx` troca `size="lg"` por `emphasizeKcal`** — mesma
  centralização de antes, mas agora com algo real pra centralizar: a linha
  inteira cabe numa linha só, então o espaço em branco dos dois lados
  aparece de verdade.
- ✅ **Verificado isolado de novo** (markup real, CSS já compilado do app,
  sem tocar dado nenhum) — a versão nova cabe numa linha, "192" claramente
  maior que "7"/"32,3"/"3,5", centralizada com folga visível dos dois lados.
  3 testes novos em `macro-summary.test.tsx`.

---

## ✅ Diário: total da refeição maior e centralizado (corrigido) — 23/09/2026

**Corrige a entrada anterior, que tinha entendido "kcal do dia" errado.** Eu
tinha lido como o total do topo da tela (`MacroProgress`, "1.450/1.930") e
deixado só a figura de kcal ali maior/centralizada. Pedro mandou um print
circulando outra coisa: o total da própria refeição ("192 kcal 7 Prot 32,3
Carb 3,5 Gord", logo abaixo de "Café da manhã") — "não quero essa barra, eu
quero essa aqui... essa outra pode manter igual as outras, sem problema".

- ✅ **`macro-progress.tsx` revertido para antes da entrada anterior** —
  commit `0de7041` desfeito neste arquivo (`git show 0de7041^:...`, byte a
  byte). O total do topo volta a tratar kcal igual a Prot/Carb/Gord.
- ✅ **`meal-card.tsx` — o total da refeição ganha `size="lg"` e
  centralização**, não só a proximidade do nome que a entrada de duas atrás
  já tinha corrigido. `MacroSummary` já tinha essa variante grande pronta
  (usada em `MealItemDetailScreen` e no fallback sem perfil de
  `food-log-screen`/`diet-editor`) — reaproveitada aqui, não reinventada.
  Cada alimento embaixo (`MealItemRow`) continua no tamanho padrão.
- ✅ **Verificado sem risco de dado real, duas vezes** — primeiro no site de
  produção de verdade (`lacalle-life-2.vercel.app/diario`, dados reais do
  Pedro), removendo a splash por `style.display` em vez de `.remove()` (a
  primeira tentativa tirou o nó da árvore que o React ainda esperava
  controlar, e derrubou a página num `ErrorBoundary` — inofensivo, mas
  corrigido). Depois, pra esta correção especificamente, o markup real
  injetado isolado (mesma técnica de sempre), comparando lado a lado a
  linha da refeição (20px, centralizada) contra a linha de um alimento
  (14px, à esquerda, sem mudança nenhuma).
- ✅ **De brinde:** um teste de `app-data-boot.test.tsx` (RM11) que usava
  `toISOString().slice(0, 10)` em vez de `dayKey()` quebrou de verdade às
  21h locais — o mesmo problema de fuso que `dayKey` existe pra evitar,
  citado no próprio comentário de `diario/page.tsx`. Corrigido para usar
  `dayKey`, a mesma função que o componente testado usa.

---

## ✅ Diário: total da refeição colado no nome, caixas de nutriente alinhadas — 23/09/2026

Pedro, olhando duas telas reais do Diário: "1) jogar as calorias da
refeição mais próximo do nome da refeição, hoje parece que as kcals da
refeição toda é um alimento específico" e "cliquei no alimento e ficou meio
bugado o design, os boxes ficaram desalinhados".

- ✅ **`meal-card.tsx` — o total da refeição sobe pro bloco do nome.**
  `MacroSummary` usa exatamente a mesma tipografia pro total da refeição e
  pra cada alimento embaixo dela — sem estar colado no nome, "192 kcal 7
  Prot..." lia como o primeiro alimento da lista (que é literalmente o que
  Pedro descreveu), não como a soma da refeição inteira. Antes ficava solto
  ao lado do ⋮, numa segunda linha só dele com `justify-between` empurrando
  tudo pras pontas; agora fica empilhado logo abaixo do nome e do horário,
  dentro do mesmo bloco — a `border-t` que já separa a lista de alimentos
  faz o resto do trabalho de dizer "isto aqui é outra coisa". O ⋮ virou um
  botão solto, sem o `div` que só existia para segurar os dois juntos.
- ✅ **`meal-item-detail-screen.tsx` — `items-end` no grid de nutrientes.**
  "Gordura saturada (g / 100 g)" quebra em duas linhas, "Sódio (mg / 100 g)"
  cabe numa só — o grid esticava cada rótulo pra altura da linha e o texto
  ficava ancorado no topo, então as duas caixas de input da mesma linha
  saíam em alturas diferentes. Alinhando pelo fim da célula, é o input — o
  último elemento de cada rótulo — que bate no mesmo lugar dos dois lados,
  não o texto acima dele. Reproduzido isolado (HTML solto, sem tocar o app
  nem dado nenhum) antes de aplicar, pra confirmar a mecânica do CSS sem
  risco: o "antes" reproduziu o desalinhamento exato do print, o "depois"
  corrigiu.
- ⚠️ Não verificado com dado real do Diário no navegador desta vez — o
  ambiente de dev local está com o dia de hoje vazio, e criar refeição de
  teste ali arriscava sincronizar lixo pra conta real do Pedro se a sessão
  estiver logada nela. Os dois testes acima (isolado + suíte de testes)
  cobrem a mecânica; vale conferir na tela de verdade.

---

## ✅ Splash de abertura: preto → gradiente do ícone do app — 23/09/2026

Pedro, depois de ver a splash de verdade no celular (RM09, entrada mais
abaixo): "vamos transformar ela em verde esmeralda, igual a da logo".

- ✅ **Reaproveita `ICON_GRADIENT`** (`design-system/brand/mark.ts`), o
  mesmo gradiente que `apple-icon.tsx`/`icon.svg` já usam — não um verde
  digitado de novo em `boot-splash.tsx`. Se a constante mudar (ela ainda é o
  emerald literal do V1.1, não o Verdant do resto do design system — ver o
  comentário da própria constante), a splash acompanha de graça.
- ✅ **Verificado ao vivo no navegador desta vez** — círculo verde com o
  símbolo branco por cima, igual ao ícone do app. Teste novo
  (`boot-splash.test.tsx`) compara o `background` computado do overlay
  contra o mesmo `linear-gradient(...)` montado a partir de `ICON_GRADIENT`,
  em vez de comparar string hexadecimal direto — jsdom normaliza `#10B981`
  para `rgb(16, 185, 129)` ao ler `style.background` de volta.

---

## ✅ Roadmap Mestre — RM11: carregamento e sincronização global — 23/09/2026

Fecha o último item do Roadmap Mestre. Antes, cada aba (Diário, Treinos,
Evolução...) só abria o próprio repositório — e só então sincronizava — na
primeira vez que alguém entrava nela; navegar pela primeira vez a cada aba
pagava esse custo na ordem em que a pessoa foi clicando.

- ✅ **`AppDataBoot`, novo componente em `app/_components/`** — montado em
  `(app)/layout.tsx`, que só existe uma vez por entrada no app e nunca
  remonta entre `/hoje`, `/diario`, `/treinos` etc. (comentário do próprio
  arquivo). Embrulha `{children}` com `FoodLogDataProvider` +
  `WorkoutDataProvider` + `BodyDataProvider` — a essência da mudança: fazer
  isso aqui, e não em cada página, dispara a abertura de todo IndexedDB em
  paralelo no instante em que o app aparece, em vez de tela por tela.
- ✅ **Nenhuma tela precisou mudar.** Cada fábrica de repositório em
  `data-providers.tsx` já memoiza a própria promise (`once<T>`) — a mesma
  instância resolvida volta instantânea pra quem pedir de novo. O provider
  que cada página já embrulha (`FoodLogDataProvider` em `/diario`, etc.)
  continua exatamente como estava, só que agora recebe de volta algo já
  resolvido em vez de abrir do zero. Deixei essas chamadas no lugar de
  propósito — cada tela continua documentando ali mesmo de que repositório
  precisa, e ganhar isso de graça pelo layout quebraria silenciosamente se
  `AppDataBoot` um dia sumisse.
- ✅ **O pull de sincronização entra pela mesma porta, uma vez, ao montar** —
  perfil, dietas, rotinas, sessões e corpo (cada um cobre todo o histórico) e
  o diário do dia de hoje, o único que a abertura do app pode adivinhar, já
  que o diário é por dia. Silencioso de propósito, mesma convenção do push
  debounçado que `data-providers.tsx` já tinha: uma falha aqui (rede fora,
  sem sessão) não aparece em lugar nenhum — as `*-sync-status.tsx` de cada
  tela continuam rodando o próprio sync ao montar e mostrando um erro de
  verdade, se ele persistir.
- ✅ **Não é o carregamento global estrutural que a entrada anterior
  descrevia como grande** — não moveu nenhum provider de rota nem mudou quem
  possui a UI de conflito de cada tela; só adiantou o que cada fábrica já
  fazia. O resultado prático pedido (navegar rápido entre abas) é o mesmo, com
  bem menos superfície de risco.
- ⚠️ **Não verificado ao vivo no navegador desta vez** — mesma limitação de
  automação já registrada nas duas entradas anteriores. 4 testes novos
  (`app-data-boot.test.tsx`) cobrindo os repositórios chegando aos filhos, os
  seis syncs disparando uma vez cada, a guarda de Supabase não configurado, e
  que uma falha de sync não derruba o app.

---

## ✅ Roadmap Mestre — RM07: editar treino ativo — 23/09/2026

Trocar ou adicionar exercício sem sair do treino em andamento, o mesmo padrão
que o editor de rotina já tinha (folha do `ExerciseBrowser` por cima da
tela), agora também na execução.

- ✅ **`addSessionExercise`** — adiciona um exercício que a rotina nunca
  previu ("hoje vou fazer isso também"), com uma série em branco pra
  começar; o botão "Série extra" que cada card já tem cobre o resto. Também
  funciona numa sessão avulsa que começou sem nenhum exercício.
- ✅ **`replaceSessionExercise`** — troca qual exercício preenche um slot,
  mesma convenção do `replaceExercise` do editor de rotina (`edit-routine.ts`):
  o id do slot não muda, só a referência ao catálogo e o nome.
- ✅ **A guarda que o item do roadmap pedia — "sem corromper séries já
  registradas".** `replaceSessionExercise` recusa (no-op) assim que qualquer
  série do slot já está concluída, e o botão de trocar (`session-exercise-card.tsx`)
  aparece desabilitado nesse caso. Uma série concluída é um registro do que
  foi levantado de verdade — Evolução e recordes pessoais leem direto de
  `exerciseId` — e re-rotulá-la sob outro exercício reescreveria esse
  histórico. Trocar é para "errei o exercício" ou "a máquina está ocupada",
  decidido antes da primeira série, nunca depois.
- ✅ **Fora da tela de editar treino já concluído.** `SessionEditor`
  (correção pós-treino) reusa o mesmo `SessionExerciseCard`, mas nunca passa
  `onSwap` — o comentário do próprio arquivo já dizia que ali é sobre
  corrigir o que foi registrado, não sobre mudar qual exercício foi; RM07 é
  só sobre o treino ainda em andamento.
- ⚠️ **Não verificado ao vivo no navegador desta vez** — mesma limitação de
  automação já registrada na entrada de RM01/RM03 abaixo, que aqui não pesa
  tanto (nada depende de tempo real): 10 testes novos determinísticos
  (`edit-session.test.ts`, `session-exercise-card.test.tsx`) cobrindo as duas
  funções e a guarda do botão.

---

## ✅ Roadmap Mestre — RM01/RM03: long press pra reordenar, no Diário e nos Treinos — 23/09/2026

O handle de arrastar permanente saiu da tela normal do Diário e do editor de
rotina. Segurar o card (~2s) abre uma folha dedicada só com a lista e os
handles — a mesma filosofia nos dois lugares, primeira vez que o app precisou
de um long press de verdade.

- ✅ **`useLongPress`, a primitiva que não existia** — novo hook em
  `design-system/hooks/`, Pointer Events (toque, mouse e caneta pela mesma
  API), cancela se o dedo se move mais que 8px (mesmo limiar que
  `PointerSensor` do `SortableList` já usa pra não confundir um scroll com
  um toque) e nunca começa a contar num `input`/`textarea`/`select` — seguraria
  o campo de gramas ou de observações e roubaria a seleção de texto que o
  celular já oferece ali.
- ✅ **`ReorderSheet`, um componente novo em vez de três folhas quase
  iguais** — `design-system/components/`, reaproveitado pelas refeições do
  dia, pelos alimentos de uma refeição e pelos exercícios de uma rotina.
  Nome + handle, nada mais; `SortableList` por baixo já traz o sensor de
  teclado, então nenhuma das três perdeu a alternativa sem arrastar.
- ✅ **Nunca o único jeito de reordenar** — no Diário, "Mover para
  cima/baixo" continua atrás do ⋮ de cada refeição (already existia,
  17/09/2026); nos Treinos, as setas ao lado de cada exercício continuam
  visíveis sem precisar segurar nada — comentário do próprio
  `routine-exercise-card.tsx`: "dragging a card with one thumb at the gym
  is worse than tapping an arrow". O long press é o jeito rápido de mover
  vários de uma vez, não a única porta.
- ✅ **Escopo: só onde o roadmap mostrou telas — Diário e editor de
  rotina.** `MealCard`/`MealItemRow` são compartilhados com `DietEditor`
  (a tela de Dietas), que continua exatamente como estava — `dragHandle`
  virou opcional nos dois componentes, e o editor de dieta nunca deixou de
  passá-lo. Zero mudança lá.
- ⚠️ **Não verificado ao vivo no navegador desta vez.** A mesma aba
  automatizada que atrapalhou a verificação da splash (RM09, entrada
  anterior) sofre o mesmo throttling severo de timers — e um long press
  depende de exatamente 2 segundos reais pra disparar, o pior caso possível
  pra essa limitação. Pra não repetir o incidente da sessão de treino
  encerrada sem querer, não tentei de novo. Em vez disso: 22 testes novos
  com timers falsos (determinísticos, sem essa dependência de tempo real)
  cobrindo `useLongPress` isolado e os quatro componentes que o usam — vale
  você experimentar segurando um card de verdade na próxima vez que abrir
  o app.

---

## ✅ Roadmap Mestre — primeiro lote: RM02(a), RM04, RM05, RM08, RM09, RM10 — 23/09/2026

Pedro trouxe um PDF ("LaCalle Life — Roadmap Mestre") com 11 itens de UX
(RM01–RM11) vistos usando o app. Antes de implementar, investiguei os 11 em
paralelo para dar um custo real por item, e entreguei os que saíram baratos
e sem ambiguidade nesta rodada. RM01/RM03 (long press pra reordenar —
primitiva nova, ainda não existe no app), RM06 (timer de descanso — **já
estava pronto**, nada a fazer), RM07 (editar treino ativo) e RM11
(carregamento global) ficaram para depois — o último em especial é mudança
estrutural grande (mover todos os `*DataProvider` pro layout raiz), não
uma tarde de trabalho.

- ✅ **RM10 — o par de bugs que o Pedro lembrou de cabeça.** "A gente tinha
  corrigido 1, era pra vc ter corrigido o outro também": o corte de rótulo
  de semana já resolvido em `volume-chart.tsx` (17/09/2026, commit
  `2c88958`) nunca chegou em `adherence-chart.tsx` (evolução de aderência
  da dieta) — cópia estrutural do mesmo componente, nunca compartilhada, daí
  o fix de um não ter propagado pro outro. Portado o mesmo `labelStep` +
  `whitespace-nowrap`, com teste de regressão de 12 semanas que reproduz o
  corte antes do fix.
- ✅ **RM04 + RM08 — alinhamento e o "#" na tela de Treinos.** O cabeçalho da
  lista de séries desalinhou da linha quando uma borda de foco foi
  adicionada só às linhas (17/09/2026) — `session-exercise-card.tsx` ganhou
  a mesma borda que `performed-set-row.tsx` já tinha. O "#" (decoração de
  cabeçalho, não texto por série) virou "Série" nos dois lugares que o
  reaproveitam (sessão ativa e editor de rotina).
- ✅ **RM02(a) — kcal e macros na mesma linha.** `meal-item-row.tsx` juntou
  os quatro números num só `MacroSummary` (o mesmo componente que a
  refeição já usa pro total) em vez de kcal isolada ao lado do nome e P/C/G
  numa linha à parte — exatamente a queixa do roadmap.
- ✅ **RM05 — recorde histórico batido, toast discreto.** O cálculo
  (`personalRecords`, todo o histórico, nunca só o treino atual) e o
  componente de toast já existiam prontos; faltava ligar um no outro. Uma
  série concluída que bate o peso mais pesado ou o 1RM estimado de todo o
  tempo mostra "Recorde batido: X kg em [exercício]." — sem confetti, sem
  badge.
- ✅ **RM09 — splash escura.** O manifest já tinha fundo escuro configurado
  pro PWA instalado, mas o Pedro confirmou que o flash branco aparece de
  qualquer jeito — a janela entre o HTML cru e a interface pronta, que o
  manifest não cobre. A pedido dele, portei a mesma transição que o
  LaCalle Finance já usa (`LaCalleReveal`, `Finance/src/components/ui.jsx`):
  símbolo branco sobre preto, cobre a tela desde o primeiro frame, recua
  revelando o app ~2s depois. Componente novo, `boot-splash.tsx`, montado
  no layout raiz — como layouts do Next.js não remontam em navegação
  client-side, aparece sozinho uma vez por abertura real do app, sem
  precisar rastrear sessão à mão.
- ✅ **RM02(b) — página de detalhes do alimento, com os 4 nutrientes
  opcionais.** Perguntei ao Pedro qual das duas leituras era a certa: a
  ficha genérica do alimento no catálogo, ou o que foi registrado
  *naquele dia específico*. Ele confirmou a segunda. `MealItem` (e `Food`,
  pela mesma razão que já copia `per100g`/`practicalUnit`) ganharam `brand`
  e os 4 opcionais — gordura saturada, sódio, fibras, açúcares — nunca
  dentro de `Macros` (o motor de soma/escala do app não muda). Vazio
  significa "não informado", nunca um 0 inventado. Clicar num alimento
  dentro de uma refeição do Diário agora abre `/diario/alimento`, uma
  página própria com o registro daquele dia e os campos editáveis; o
  clique na refeição em si continua intocado.
- ⚠️ **Achado durante a verificação no navegador, não um bug de código:** a
  aba automatizada usada para conferir o RM09 sofre throttling severo e
  imprevisível de timers/scheduler do React (confirmado com um
  `setInterval` de controle rodando ~3x mais devagar, e casos onde nem isso
  bastou para explicar o atraso) — não reflete um navegador real em uso
  normal. A lógica da splash está coberta por teste determinístico
  (`boot-splash.test.tsx`, timers falsos) e um bug real que achei nesse
  processo (a tela cobria só a partir da fase "in", não desde o primeiro
  frame) já foi corrigido. Vale conferir a olho a próxima vez que o Pedro
  abrir o app de verdade.
- ⚠️ **Sem querer, encerrei uma sessão de treino de teste** ("Treino A",
  1/1 séries já completas, parada havia 6 dias) clicando num lugar que eu
  achava ser "Retomar" durante essa mesma verificação — o layout deve ter
  se movido sob o atraso da aba. Sem perda de dado real (a sessão já
  estava 100% feita, só não fechada), mas registrando porque não pedi
  permissão antes.

---

## ✅ Catálogo: 38 alimentos raros removidos, com curadoria contra a lista automática — 23/09/2026

Pedro trouxe `lista_limpa_com_acoes.csv`: uma auditoria de todo o catálogo
(1597 linhas — 1593 do catálogo + 4 alimentos pessoais dele), classificando
cada item em MANTER (1473), UNIFICAR/RENOMEAR (61) ou DESATIVAR/REMOVER (63).

**Não apliquei a lista como veio.** Duas checagens antes de apagar qualquer
coisa (memória: nunca excluir em massa sem revisar em caso de ambiguidade)
acharam problemas reais na própria auditoria:

- ✅ **8 itens marcados para remover eram contradição direta com o que eu
  tinha acabado de adicionar** a pedido do Pedro no dia anterior: os 6
  queijos gourmet (brie, camembert, feta, gorgonzola, gruyère, mascarpone) +
  Copa fatiada + Panceta suína + Pastrami fatiado. Mantidos.
- ✅ **3 "duplicatas exatas" eram do escopo errado** — Mel, Toddy e
  Bisnaguinha do catálogo foram marcadas como duplicata só porque o Pedro
  tem uma versão pessoal de cada uma na própria conta. Apagar do catálogo
  compartilhado tiraria esses alimentos comuns de todo mundo, não só
  resolveria a duplicata dele — mantidas. A duplicata em si é dado pessoal
  dele (IndexedDB do navegador), fora do alcance de uma edição neste
  repositório; ele resolve apagando a cópia própria pelo app.
- ✅ **"Whey protein" marcado como "raro ou pouco cotidiano"** — claramente
  errado para um app de dieta/treino. Mantido.
- ✅ **Grupo limítrofe perguntado ao Pedro** (Quinoa cozida, Jiló cru, Kefir
  de leite, Kombucha adoçada, Tofu, "Soja, queijo (tofu)", Tempeh, Truta,
  Ovo de codorna, Salgadinho de milho, Biscoito salgado cream cracker) — ele
  pediu para manter todos.
- ✅ **UNIFICAR/RENOMEAR (61 itens) foi pulado por inteiro.** A coluna de
  nome sugerido quase sempre repetia o nome original (nenhuma fusão real
  proposta), e nos poucos casos com um nome diferente pelo menos 3 juntavam
  **cru com assado** (ex.: "Frango peito com pele cru" → "Frango peito com
  pele assado") — o oposto exato da regra que o Pedro deu ("preparações
  nutricionalmente diferentes devem continuar separadas"). Base fraca demais
  para decidir sozinho sem risco de fundir itens errados; catálogo
  inalterado nessa parte.
- ✅ **38 itens removidos de verdade**: os que sobraram depois de excluir os
  24 acima — em geral frutas/vegetais regionais raros (umbu, graviola,
  jurubeba, cará, taioba, caruru, catalonha), bacalhau (4 variações), miúdos
  de porco, lula/polvo, licores, xaropes.
- ⚠️ **Limitação conhecida, não resolvida agora:** `seedCatalogue` só
  adiciona o que falta, nunca remove — então estes 38 continuam no
  IndexedDB de quem já tinha semeado o catálogo antes desta mudança
  (inclusive o próprio Pedro). Isso limpa o catálogo para instalações
  novas; uma limpeza retroativa em dispositivos já semeados seria uma
  migração à parte, no molde de `refreshFoodPracticalUnits`.

---

## ✅ Diário: refeição não pula mais de posição depois de sincronizar + 110 alimentos-base novos — 22/09/2026

Bug relatado pelo Pedro: no Diário, a última refeição editada "pulava" para o
topo (ou qualquer posição) depois de sincronizar. Causa raiz em
`composition/sync/food-log-merge.ts`: a união de refeições entre
dispositivos ordenava por `Meal.time` e depois por `Meal.id` — mas a maioria
das refeições do Diário nunca tem horário preenchido, então na prática a
regra quase sempre desempatava por um UUID aleatório, sem relação nenhuma
com a ordem em que a pessoa foi adicionando.

- ✅ **`Meal` ganha `order: number`** — cunhado uma vez, quando a refeição
  entra na lista (criação, duplicação, um check/abrir de refeição
  planejada), nunca recalculado pelo merge. É conteúdo da refeição, igual a
  `id`: qualquer dispositivo que una o mesmo conjunto de refeições chega ao
  mesmo array. Detalhe completo, e por que a decisão de 24/08/2026
  (`time`+`id`) não resolvia, em `docs/arquitetura-sincronizacao.md` §19.5.
- ✅ **Um arrastar-e-soltar só toca a refeição movida.** `moveMeal`/
  `reorderMeals` (`edit-diet.ts`) recalculam o `order` só da refeição que
  mudou de posição, para um valor entre seus novos vizinhos — mover uma
  refeição não faz as outras parecerem editadas no próximo merge.
  Refeições que predatam o campo (dado já sincronizado) recebem `order` pela
  posição no array de cada lado, dentro do próprio `mergeFoodLogMeals`.
- ✅ **110 alimentos-base adicionados ao catálogo** (1483 → 1593): queijos,
  frios, molhos/condimentos, cortes de carne/frango/porco, conservas e
  guarnições que faltavam para montar refeições comuns (sanduíche, hambúrguer,
  marmita). Lista trazida pelo Pedro
  (`ingredientes_base_faltantes_v2.txt`), macros conforme fornecidos.
  A lista do app já é alfabética por leitura (`local-food-repository.ts`
  ordena com colation pt-BR), então nenhuma mudança de código era necessária
  para isso — só adicionar as entradas.

---

## ✅ Lista de compras da semana em Dietas: tela, texto e PDF — 21/09/2026

Ideia do Pedro: uma página em Dietas para baixar um PDF com o que comprar
para passar a semana. Serve a "montar dieta" (regra 1) e não sugere nada
(regra 3): só soma o que já está montado.

**Decisão dele, e que define o escopo:** a lista mostra **só o que a dieta
pede, do jeito que pede**. "300 g de arroz cozido" sai como "300 g de arroz
cozido"; sem conversão de peso cozido para cru, sem aviso, sem arredondar
para embalagem ou unidade caseira. (Eu tinha proposto sinalizar os 253
alimentos cozidos/grelhados do catálogo; ele preferiu que a pessoa se vire.)
Ele também pediu "Copiar texto" além do PDF.

- ✅ **A conta** (`services/shopping-list.ts`, pura e testada): cada dieta com
  dias marcados entra tantas vezes quantos forem os dias, e o mesmo alimento
  é somado entre refeições e dietas (por `foodId`; sem `foodId`, por nome e
  unidade; g e ml ficam separados). Fora da conta: dieta sem dia marcado e as
  alternativas salvas de uma refeição, porque a lista segue o que está
  montado hoje. Quantidade arredondada **para cima** (sobrar é melhor que
  faltar), com duas casas antes do teto para o ruído de ponto flutuante não
  virar uma grama a mais. Mil ou mais sobe de unidade (1,4 kg, 1,5 L).
- ✅ **Agrupada por categoria** do catálogo (o item da dieta só guarda o
  `foodId`, então a categoria é consulta ao catálogo). Sem categoria (alimento
  criado à mão, ou removido do catálogo) cai em "Outros". Se o catálogo falhar
  ao carregar, a lista continua certa e só perde o agrupamento.
- ✅ **PDF escrito à mão** (`services/shopping-list-pdf.ts`, ~140 linhas),
  sem biblioteca: uma lista é texto em linhas, e PDF 1.4 com Helvetica cobre.
  Zero peso no pacote de um app que funciona offline. Só Latin-1 (cobre o
  português; todos os nomes do catálogo cabem); o que não cabe vira `?`. A4,
  várias páginas, caixinha ao lado de cada item. Validado com um leitor
  independente (pdf.js): texto e acentos extraídos certos e página renderizada.
- ✅ **Tela:** botão "Lista de compras" em `/dietas` abre um `Dialog` (é
  consulta, regra 6) com a lista, "Copiar texto" e "Baixar PDF" **no alto**,
  para não depender de rolar a lista inteira no celular. O catálogo só é
  carregado com o modal aberto.
- ⚠️ `DietDataProvider` agora também dá o repositório de alimentos (só a
  lista de compras usa). Item de dieta gravado antes de existirem líquidos
  não tem `unit`; a lista lê como "g", como o resto do app.

Testes: 14 da conta, 7 do PDF (tabela de referências cruzadas, tamanho do
stream, escapes, quebra de linha, várias páginas) e 4 do modal. Provei que
os da conta pegam o bug: estraguei quatro comportamentos (ruído de ponto
flutuante, `unit` ausente, multiplicar pelos dias, dieta sem dia) e cada um
derrubou pelo menos um teste. Conferido no navegador nos dois temas.
`npm run verify` (1780/1780) e `npm run build` limpos. Uma rodada do
`verify` falhou por timeout de 5 s em `identity-isolation.test.ts` com a
máquina saturada; passa sozinho em 2,4 s e passou na rodada seguinte.

---

## ✅ Botão de sincronizar some de vez, logado ou não — 18/09/2026

O aviso de texto tinha saído no dia anterior, mas o botão manual
"Sincronizar" continuava aparecendo pra quem tinha conta — decisão
explícita daquela rodada. Pedro testou logado e o botão ainda incomodava.
Perguntei se era sessão ativa (era) e o que fazer: esconder também
autenticado, ou sair da conta — escolheu **esconder também autenticado**.

- ✅ Os cinco componentes de status
  (`food-log-sync-status.tsx`, `routine-sync-status.tsx`,
  `diet-sync-status.tsx`, `body-entry-sync-status.tsx`,
  `session-sync-status.tsx`) perderam o botão manual de vez — não mais
  condicionado a `auth === "authenticated"`, porque `auth` em si saiu:
  o rastreamento de sessão (`getUser`/`onAuthStateChange`,
  `createSupabaseAuthRepository`) não tinha mais nenhum outro consumidor
  depois que o botão foi embora, e ficaria como estado morto.
- ✅ **A sincronização automática ao montar a tela continua intacta** —
  o efeito que chama `runXSync()` sozinho nunca dependeu de `auth`, só de
  `isSupabaseConfigured()`. O que sumiu foi só o controle manual; a
  sincronização em si roda do mesmo jeito pra quem tem conta.
  Conflito de verdade e falha real do auto-sync continuam aparecendo —
  são os únicos dois motivos que restam pra estes componentes existirem
  na árvore.
- ✅ Login, cadastro e as rotas de conta (`/entrar`, `/cadastro`,
  `/conta`) não foram tocados — a funcionalidade de conta em si segue de
  pé, só o botão de sincronizar manual que anunciava ela dentro das telas
  é que não existe mais.

Testes reescritos em `food-log-sync-status.test.tsx` e
`session-sync-status.test.tsx` — trocam a checagem de "botão aparece
autenticado" por "nada aparece depois de um auto-sync limpo" e um teste
novo pra falha real do auto-sync. `diet-sync-status.tsx`,
`body-entry-sync-status.tsx` e `routine-sync-status.tsx` não têm teste
dedicado; `npm run verify` (1755/1755) e `npm run build` limpos.

---

## ✅ Encolher no toque chega a todo link também — 18/09/2026

Pedro testou o encolhimento universal do dia anterior e achou um buraco
real: abrir um treino (`routine-list.tsx`) não encolhia nada. O motivo é
que aquele card inteiro é um `<Link>`, e a regra global de `globals.css`
só mirava `<button>` — decisão explícita da entrada anterior, que excluía
`<a>` de propósito pra não pegar link corrido dentro de parágrafo. Pedro
pediu de novo, sem deixar margem: **"tudo que seja clicável, tudo mesmo"**.

- ✅ `globals.css`: a regra que já encolhia todo `<button>` agora também
  encolhe todo `<a>` da página — mesmo `--press-scale`, mesma transição.
  Inclui o link corrido que a versão anterior excluía de propósito; não
  excluir mais é escolha explícita desta vez, não descuido.
- ✅ **`html a`, não só `a`.** Um seletor de elemento sozinho perde de
  especificidade pra qualquer `transition-colors` que o próprio link já
  declare — `button` ganhava esse empate de graça com `:not(:disabled)`,
  que não faz sentido num link (não existe `<a disabled>`), então `html a`
  faz o mesmo trabalho com um segundo elemento em vez de um pseudo-seletor
  emprestado.
- ✅ Itens de navegação (`sidebar-nav.tsx`, `bottom-nav.tsx`) já tinham
  `--animate-side-marker`/`--animate-pop` como feedback de seleção — o
  encolhimento some por cima disso, não substitui nada.

Testado ao vivo: abrir "Treino A" em `/treinos` continua navegando
certinho pra `/treinos/[id]` depois da mudança. `npm run verify` e
`npm run build` limpos, 1756/1756 testes (o flake de
`identity-isolation.test.ts` não repetiu desta vez).

---

## ✅ Encolher no toque virou universal, não só de quem já tinha a classe — 17/09/2026

Pedro pediu uma animação de clique nas "pílulas" (os campos de peso/reps/
duração da série, chamados assim no próprio código de
`performed-set-row.tsx`) crescendo e entrando na tela. Perguntei qual grupo
ele queria antes de mexer, e a resposta ampliou o pedido: **"todos os
botões"**.

- ✅ A pág. 25 do brandbook já documenta o clique de um botão encolhendo a
  0,98 — é o que `Button` e o check de concluir série já faziam, então
  "crescer" contrariaria uma decisão de marca escrita, não uma lacuna.
  Perguntei de novo: crescer em todos (reescrevendo a pág. 25), encolher só
  onde faltava, ou encolher mais forte em todos. Pedro escolheu **encolher
  mais forte, em todos os botões**.
- ✅ **`--press-scale` (tokens.css): 0,95, não mais 0,98.** Universal agora
  via uma regra em `globals.css` (`@layer base`) que aplica a todo
  `<button>` da página, não só a quem já tinha a classe escrita à mão —
  cobre os chips de filtro (`food-filters.tsx`, `exercise-filter-bar.tsx`),
  remover série, RPE, e qualquer outro botão sem feedback próprio até
  então. `Button` (`button.tsx`) e o check de série
  (`performed-set-row.tsx`) passaram a ler o mesmo token em vez de repetir
  um número (0,98 e 90 respectivamente, cada um dono do seu próprio
  valor antes).
- ✅ **Só `<button>`, não `<a>`.** Itens de navegação (`sidebar-nav.tsx`,
  `bottom-nav.tsx`) são links e já têm o próprio feedback de seleção
  (`--animate-side-marker`, `--animate-pop`); estender a todo link do app
  pegaria texto corrido dentro de parágrafo, que nunca pediu nada disto.
- ✅ A regra global usa `:not(:disabled)` por dois motivos: excluir o
  botão desabilitado, e ganhar especificidade suficiente pra vencer
  qualquer `transition-colors`/`transition-[...]` que o componente já
  declare — sem isso, a lista de propriedades de quem chegasse depois na
  cascata apagaria `scale` dela, e o encolhimento saltaria sem suavizar.
  A lista de propriedades da regra global é a de `transition-colors` do
  Tailwind mais `scale`, de propósito, pra nenhum botão que já
  transicionava cor perder isso.

Testado ao vivo em `/alimentos` → Filtros: o chip "Proteínas" continua
alternando corretamente (208 alimentos filtrados) depois da mudança de CSS.
`npm run verify` e `npm run build` limpos (só o flake conhecido de
`identity-isolation.test.ts` sob carga, que passa isolado).

---

## ✅ Página ainda mais lenta + aviso de sincronizar sai da tela — 17/09/2026

Dois pedidos do Pedro, sem relação entre si.

- ✅ **`--duration-page` subiu de 600ms para 900ms** — segundo "mais
  devagar" no mesmo dia sobre a mesma transição (entrada 17/09 acima).
  De propósito acima de `--duration-hero` (800ms): emprestar o número do
  tier de splash/onboarding prenderia os dois a mudar juntos por
  coincidência, não por serem o mesmo papel.
- ✅ **"Dados salvos neste dispositivo. Entre na sua conta para
  sincronizar."** saiu das cinco telas onde aparecia (Treinos — duas
  vezes, uma já resolvida em 02/09 —, Dietas, Diário, Evolução). Antes de
  mexer, perguntei o escopo: só o aviso, ou a funcionalidade de
  conta/sync inteira (login, Supabase, botão de sincronizar)? Pedro
  confirmou só o aviso — a funcionalidade continua existindo
  (`/entrar`, `/cadastro`, `runRoutineSync` e companhia), só parou de
  ser anunciada pra quem está sem conta. Sem sessão, os cinco
  componentes de status agora retornam `null` em vez do parágrafo.
  Página de aterrissagem (`hero.tsx`, `account-section.tsx`) não foi
  tocada — é o único lugar cujo propósito inteiro é explicar a conta
  pra quem ainda não tem uma, diferente do aviso repetido dentro do
  app.

Teste reescrito em `food-log-sync-status.test.tsx` (as duas asserções que
checavam o texto agora checam ausência total, `container` vazio);
`session-sync-status.test.tsx` não precisou mudar, já retornava `null`
antes por outro motivo (evitar duplicar a mensagem que `RoutineSyncStatus`
mostrava — motivo que também desapareceu, comentário atualizado).
`npm run verify` e `npm run build` limpos.

---

## ✅ Bounce na transição de página — exceção de marca, decidida e mais lenta ainda — 17/09/2026

Fecha a entrada anterior (mesmo dia, "Transição de página mais lenta +
experimento de bounce"), que ficou em aberto até o Pedro conseguir
testar. Testou pela URL de rede do `next dev` (`localhost` não abre por
wifi) e respondeu: **"gostei do bounce, pode deixar"** — pedindo também
mais devagar ainda.

- ✅ **Bounce virou exceção de marca de verdade, não mais experimento.**
  `--ease-bounce` (`cubic-bezier(0.34,1.56,0.64,1)`), token novo,
  registrado em `docs/brandbook.md` ("Bounce na transição de página")
  com o mesmo cuidado do "Number Update": por que a decisão de "sem mola"
  não bloqueia este caso, e o que isto **não** abre precedente para —
  nenhum outro `--animate-*` ganha overshoot por associação. Bloco
  "EXPERIMENTO — NÃO ADOTADO" saiu de `globals.css`; `page-transition.tsx`
  perdeu a flag `ENTER_CLASS` e usa `animate-page-enter` direto.
- ✅ **Mais devagar ainda** — `--duration-page`, um sétimo tier (600ms
  nesta rodada, era 450ms/`signature`; subiu de novo para 900ms na
  mesma tarde, ver entrada acima). Tier próprio, não `signature`
  inflado: subir `signature` em si arrastaria o LaCalle Reveal da
  Landing, que usa o mesmo tier e não pediu nada disto.

`npm run verify` e `npm run build` limpos.

---

## ✅ Mais cobertura de motion — trocar de aba e selecionar algo — 17/09/2026

Pedro, depois da entrada anterior (mesmo dia): "eu queria deixar ele com
mais animações, tipo as animações que o proprio iphone tem, quero que
tudo tenha animação... e que seja bem visivel". "Tipo o iPhone"
especificamente significa física de mola/bounce — e isso é a decisão que
a pesquisa de Motion System v1 (07/09/2026, `docs/brandbook.md`) já tomou
e registrou por escrito **para não ser reaberta por engano**: "nenhuma
física de mola entra como token", justamente comparando contra o
60fps.design, que é "quase todo spring physics nativo" tipo iOS. Perguntei
antes de mexer; Pedro escolheu manter sem bounce e só ampliar cobertura.

**Achado real no caminho:** o design system já tinha um componente `Tabs`
completo — `role="tablist"`/`"tab"`, `aria-selected`, roving tabindex,
indicador animado — e **nunca tinha sido importado em lugar nenhum do
app**. Todo toggle de aba real (Evolução) e todo item de navegação
(sidebar, barra inferior) foi reimplementado à mão, sem a animação que já
existia pronta.

**Trocar de aba:**
- ✅ **Evolução (Volume/Duração)**: os dois `<button aria-pressed>` viraram
  o `Tabs` de verdade — ganha o indicador animado de graça, e a semântica
  de aba que faltava.
- ✅ **Barra lateral (`sidebar-nav.tsx`)**: a marca de 3px do item ativo só
  montava/desmontava sem transição, um corte seco a cada troca de rota.
  Token novo, `--animate-side-marker` — a versão vertical (cresce em
  altura) de `--animate-tab-indicator`, que já existia mas escala no eixo
  errado para uma marca vertical.
- ✅ **Barra inferior (`bottom-nav.tsx`)**: a pílula do ícone ativo só
  trocava de cor; ganhou `--animate-pop` (a mesma queda de escala sem
  overshoot do check de série) pousando na aba nova, nas quatro abas e no
  botão "Mais".

**Selecionar algo:**
- ✅ **Favoritar** (`exercise-row.tsx`, `food-row.tsx`): a estrela também
  só trocava de cor/preenchimento. Mesma técnica de `--animate-pop` do
  check de série, incluindo o mesmo cuidado — presa ao *toque*
  (contador de cliques), nunca ao dado (`isFavorite`), para reabrir um
  catálogo com itens já favoritados não fizer todas as estrelas saltarem
  de uma vez.

**Não é "tudo tudo tudo" ainda, de propósito — bounded e testado antes de
seguir.** Candidatos óbvios para uma próxima rodada: o seletor de fase do
exercício (`exercise-photos.tsx`, já tem cross-fade de foto, falta o
mesmo cuidado nos botões de fase), os filtros multi-seleção de
alimento/exercício (chips, não abas — não cabem no `Tabs`, mas cabe uma
seleção mais visível), o toggle de tema e o de densidade.

Três testes novos onde não havia nenhum (`evolution-screen.test.tsx`,
que também não existia; casos novos em `exercise-row.test.tsx`,
`food-row.test.tsx`, `bottom-nav.test.tsx`). `npm run verify` (1756
testes) e `npm run build` limpos; verificado ao vivo no navegador que a
troca Volume/Duração funciona com os dados reais e a barra da sidebar
renderiza certo nos dois estados.

---

## ✅ Amplitude/duração maiores em três primitivas de motion — 17/09/2026

Pedro testou de novo com "reduzir movimento" **confirmadamente desligado**
e ainda leu o app como sem animação: "acho que podemos deixar elas mais
fortes e talvez um pouco mais lenta". Não era mais o `prefers-reduced-motion`
(entrada anterior, mesmo dia) — as animações rodavam exatamente como
desenhadas, só que pequenas e rápidas demais pra registrar num olhar
casual. `tokens.test.ts` não trava nenhum valor de motion (só contraste de
cor), então os três abaixo tinham espaço pra mudar sem contrariar teste
nem os quatro tiers oficiais da pág. 38, que não foram tocados:

- **`--animate-rise`**: distância de 6px para 12px — o teto da faixa de
  4–12px que a pág. 36 já permite, mesma resposta que a Landing recebeu
  em "Mais intensidade de motion" (09/09/2026). Efeito amplo de propósito:
  é o token de entrada usado em quase toda tela (transição de página,
  toast, item novo em lista, stagger).
- **`--animate-pop`** (check de série): escala de partida de 0,9 para
  0,8 — queda maior, ainda sem overshoot (nunca passa de 1, nunca volta).
- **Barra de foco na próxima série** (`performed-set-row.tsx`): saiu de
  `--duration-micro` (150ms) para `--duration-standard` (250ms) — o
  próprio "mais lenta" do pedido, aplicado à interação mais repetida do
  app.

Nenhum dos três muda o valor final (opacidade 1, escala 1, cor de
descanso) — só o quadro de partida e/ou a duração, então não há como
isto ter quebrado layout: `translate`/`scale` de keyframe não reservam
espaço. `npm run verify` (1748 testes) e `npm run build` limpos;
verificado ao vivo que completar/desmarcar série e navegar entre telas
continuam corretos.

**Se ainda ficar sutil demais:** o próximo degrau é subir o *tier*
inteiro de uma superfície (o que a Landing já fez, standard→signature),
não inflar as quatro durações oficiais em si — mudar o que "micro"
significa quebraria a consistência que os tiers existem para dar.

---

## ✅ Delete/Collapse chega a todo ponto de remoção do app — 17/09/2026

Pedro testou a entrega anterior (Motion System, mesmo dia): criou um
treino de teste e apagou, sem ver nenhuma animação. Achado real — o
Delete/Collapse só tinha entrado nos quatro pontos que a auditoria de
12/09 nomeou (série, exercício, refeição, alimento), nunca em "apagar o
treino inteiro da lista", que é um componente diferente
(`routine-list.tsx`). Pedro: "Todas as animações devem estar em todos os
lugares que sejam possíveis" — mapeados todos os `onRemove` do app que
sobravam e fechados os cinco que faziam sentido, reusando o mesmo
`useCollapsibleRemove`:

- ✅ **Treino inteiro** (`routine-list.tsx`, lista `/treinos`) — o caso
  exato que o Pedro testou.
- ✅ **Dieta inteira** (`diet-list.tsx`, lista `/dietas`) — mesmo padrão,
  mesmo `Card as="li"` virando `Card` dentro de um `<li>` de colapso.
- ✅ **Sugestão de refeição salva** (`meal-alternatives-dialog.tsx`,
  folha "Outras sugestões").
- ✅ **Alimento do catálogo** (`food-row.tsx`, `/alimentos`) — só
  alimentos próprios (`isCustom`) têm o que colapsar; o catálogo curado
  nunca teve botão de excluir.
- ✅ **Medição de peso/medida** (`body-history.tsx`, Evolução).

`routine-list.tsx` e `diet-list.tsx` foram os dois únicos sem teste
próprio nenhum antes desta entrega (nem de remoção, nem de mais nada) —
os outros três ganharam teste novo (`food-row.test.tsx`,
`body-history.test.tsx`, `meal-alternatives-dialog.test.tsx`).
`routine-list`/`diet-list` ficaram sem teste automatizado por causa do
custo de montar os repositórios múltiplos que `useRoutineList`/
`useDietList` exigem — verificados ao vivo no navegador em vez disso:
criei um treino e uma dieta de teste, apaguei os dois, os dois
encolheram e sumiram sem cortar, sem deixar buraco. `npm run verify`
(1748 testes) e `npm run build` limpos.

---

## ✅ Fecha os três pontos pendentes do Motion System — 17/09/2026

Pedro perguntou de novo se as animações do brandbook estavam no Life
("não está com as animações ainda, ou se tiver, estão muito leves"). Antes
de mexer em código: confirmado que o Motion System já estava
implementado (auditorias de 09/09 e 12/09 acima) e que a causa real era
`prefers-reduced-motion` ativo no ambiente do Pedro — capando toda
animação a 120ms, o que explica "leve demais". Sobravam só três itens
reais da auditoria de 12/09, dois esperando decisão dele e um sem
trigger definido. Pedro respondeu "Pode implementar os 3".

- ✅ **Shimmer vs. Pulse.** `Skeleton` usava `--animate-pulse-soft`
  emprestado — o brandbook reserva "Pulse" pra sincronização em segundo
  plano (`SyncingOverlay`, único uso que sobrou) e nomeia "Shimmer" como
  o padrão de carregamento, brilho varrendo a superfície. Token novo
  `--animate-shimmer` + `--shimmer-highlight` (um valor por tema — no
  escuro `elevated` é mais escuro que `muted`, então o passo "mais claro"
  não é o mesmo token dos dois lados) e o utilitário `skeleton-shimmer`
  em `globals.css`.
- ✅ **Focus Transition.** A série seguinte em `performed-set-row.tsx`
  ganhou a mesma barra lateral de 3px que `Card` já usa pra "este é o
  destaque" (pág. 24) — reservada e transparente mesmo fora do estado,
  pra a barra chegar como transição de cor, nunca como salto de layout.
  A mensagem "a duração não muda, só o dia" saiu, obsoleta desde que a
  duração ganhou campo próprio (entrega anterior, mesmo dia).
- ✅ **Delete/Collapse.** Item encolhe (`grid-template-rows` `1fr`→`0fr`)
  antes de sumir, em vez do array cortar na hora. Um hook só,
  `useCollapsibleRemove` (`design-system/hooks/`), reusado nos quatro
  pontos que a auditoria de 12/09 já tinha nomeado — série (viva e
  planejada), exercício (rotina), refeição, alimento — em vez de
  reimplementar a dança de duas fases quatro vezes. `onRemove` só roda
  quando a transição de `grid-template-rows` termina de verdade, nunca
  por um `setTimeout` que arriscaria dessincronizar do
  `--duration-standard` ou do corte pra 120ms do `prefers-reduced-motion`.

Testado no navegador (não só os testes): as três séries do Treino A, uma
com confirmação de dois toques, colapsaram e sumiram sem deixar buraco;
a barra de acento migrou de série em série ao confirmar cada uma.
`npm run verify` (1744 testes — 1 falha de timeout em
`identity-isolation.test.ts`, não relacionada, não reproduz isolada,
saturação de máquina) e `npm run build` limpos. Commit `2ce3917`.

---

## ✅ Catálogo de alimentos importado (580 → 1483) + porção vira só referência — 17/09/2026

Pedro pediu, depois de uma dúvida sobre como classificar a unidade de medida
dos 580 alimentos existentes: "adicione essa base nova", um arquivo com 1483
alimentos (`alimentos_completos_100g_unidade_ml.txt`, TBCA/TACO), cada um já
com grama ou mililitro definido e uma porção de referência. Pediu também que
"1 porção = X gramas" apareça como texto, nunca como um botão de "adicionar 1
porção" — a pessoa só ajusta a gramatura, não uma contagem de porções.

- ✅ **Dados validados antes de qualquer código** (princípio "Validar o
  instrumento antes da conclusão"): os 580 alimentos antigos batem 100% por
  nome com o arquivo novo, macros idênticos, zero divergência — só os rótulos
  de medida caseira do arquivo novo são mais genéricos ("1 porção" vs. "1/2
  unidade média"), por isso os 580 mantiveram sua própria medida caseira
  curada em vez de herdar a do arquivo. Todos os 1483 batem os limites do
  schema (kcal ≤900, cada macro ≤100 g, soma ≤100 g).
- ✅ **`Food.unit` novo** (`"g" | "ml"`), copiado para `MealItem.unit` na
  hora de adicionar — a mesma regra de sempre (`per100g`/`practicalUnit`
  também são cópia, nunca lookup). Opcional no tipo, mas obrigatório em todo
  alimento seedado; um registro anterior a este campo lê como `"g"` (mesma
  convenção de `isFavorite`).
- ✅ **Categoria nova, `beverage`** ("Bebidas"), para as 100 entradas
  líquidas — `FOOD_CATEGORIES` é fonte única, então o chip de filtro e o
  schema já vieram de graça.
- ✅ **803 alimentos sólidos novos, sem categoria no arquivo-fonte:**
  heurística por palavra-chave (laticínio/fruta/vegetal, calibrada contra os
  580 já categorizados) com fallback por macro dominante (Atwater 4/4/9).
  Aproximada, ao contrário do resto dos dados — que vem exato do arquivo.
- ✅ **Porção virou texto somente-leitura** em `meal-item-row.tsx`: saiu o
  seletor g/ml manual (o alimento já diz) e o campo de "quantas medidas"
  (`UnitQuantityField`) — sobrou só a gramatura, editável, com "1 porção = X
  g" ao lado, nunca um controle. Comentário desatualizado sobre o campo
  removido, corrigido em `meal-card.tsx`.
- ✅ **Backfill estendido:** `refreshFoodPracticalUnits` (revisão 2) agora
  também atualiza `unit`, não só `practicalUnit`, para quem já tinha
  semeado o catálogo antes deste campo existir.
- ✅ **`CustomFoodForm` ganhou "Medido em"** (Gramas/Mililitros), e
  `/alimentos/selecionar` rotula o campo de quantidade "Gramas" ou
  "Mililitros" conforme o alimento.

`npm run verify` (typecheck + lint + 1729 testes) e `npm run build` verdes;
confirmado ao vivo no navegador — 1483 alimentos carregados, "Água mineral"
sob "Bebidas", porção como texto na refeição, "Medido em" no formulário de
alimento novo.

---

## ✅ Ajustes de Dieta/Diário/Treino depois do teste real — 17/09/2026

Pedro usou a entrega anterior (item abaixo) e voltou com 5 pontos:

- ✅ **Dieta:** a barra fina colorida saiu do cabeçalho do card — "mostra os
  números mesmo, não esse graficozinho". Voltou `MacroSummary` (kcal +
  Prot/Carb/Gord por extenso).
- ✅ **Diário:** uma refeição planejada só saía da lista compacta marcando-a
  como comida. `openMeal` (novo) pulled a refeição pro dia sem marcar
  comida — tocar a linha abre, tocar o check continua marcando direto.
- ✅ **Treino:** o check não alinhava com os campos de peso/reps/RPE — a
  legenda "planejado" embaixo de cada campo tornava aquele bloco mais alto,
  `items-center` centralizava pela altura errada. `items-start` resolve.
- ✅ **Treino:** Peso e Repetição trocaram de posição (Peso primeiro) nas 4
  telas que mostram as duas colunas — execução e planejamento não discordam
  mais sobre a ordem.
- ✅ **Treino:** RPE virou um mostrador de meio círculo com ponteiro —
  "gostei bastante da ideia". Mesma técnica de arco que `CalorieRing`
  (`TodayEnergy`) já usa. A grade de botões da folha de seleção não mudou,
  só o gatilho fechado.

`npm run verify` (1713 testes) e `npm run build` verdes; confirmado ao vivo
no navegador. Commit `e3af48b`.

---

## ✅ Sincronização vira "mais recente vence" automático + 4 telas — 17/09/2026

Pedro relatou perda de dado real: editou dieta/refeições/treino no celular,
abriu o PC depois, e o app manteve a versão mais antiga do PC por cima da
edição mais recente do celular. Pedido: corrigir a sincronização pro app
inteiro (prioridade 1, nunca apagar dado mais novo), e mais 6 ajustes de UI
em Treino/Dieta/Diário com Macros/Hevy como referência de densidade — sem
virar cópia visual deles. Detalhe completo da decisão e do que mudou em
`docs/arquitetura-sincronizacao.md` §26.

**Parte A — Sincronização, entregue e testada:**

- ✅ **Investigação primeiro.** O motor **não era** "último dispositivo que
  sincronizou vence" — já existia conflito visível com controle de
  concorrência otimista contra `server_updated_at` (carimbado pelo Postgres,
  nunca pelo relógio do cliente). O incidente relatado era essa mesma tela
  de conflito. Perguntado se mantinha conflito visível (mais seguro) ou
  trocava por "mais recente vence" automático mesmo quando o conteúdo
  diverge de verdade (risco de descartar uma edição real sem perguntar),
  **o Pedro escolheu o automático, sabendo do risco.**
- ✅ **LWW automático por `updatedAt`** em `Profile`, `Diet`, `Routine`,
  `BodyEntry`, `Session` e `FoodLog` (por `Meal.id`) — lado mais novo aplica,
  lado mais antigo permanece pendente e vence no próximo push pela mesma
  escrita condicional de sempre (`save_*`/RPC), nunca um `UPDATE` direto.
  Empate exato de timestamp continua em conflito visível — único caso que
  sobrou. Commit `6fcda84`.
- ✅ **Bug real encontrado e corrigido:** `pullFoodLog` carimbava
  `updatedAt: Date.now()` em toda leitura, contaminando o timestamp que a
  nova regra compara. Corrigido para o maior dos dois `updatedAt` reais.
  Mesmo commit.
- ✅ **Causa do "preciso dar refresh manual":** nenhuma tela sabia que outra
  tela (ou um pull de sync em segundo plano) tinha escrito no mesmo store.
  `core/storage/store-events.ts` novo, central para todo o app — toda
  escrita local e todo pull avisam, os hooks de leitura (`useDietList`,
  `useFoodLogDay`, `useRoutineList`, `useSessionHistory`, `useBodyLog`)
  assinam e recarregam sozinhos. `useProfile` ficou de fora de propósito —
  já tem mecanismo próprio (`onProfileChanged`), usado pela tela de loading
  do botão de sincronizar manual. Commit `299da9d`.
- ✅ **Testes:** os 6 `*.adversarial.test.ts` (um por entidade) reescritos
  para a nova regra, cobrindo as duas direções (PC velho + celular novo, e o
  inverso), entidades diferentes sobrevivendo em paralelo, edição offline
  vencendo depois de sincronizar, idempotência de sync repetido, e o novo
  `use-diet-list.test.tsx` provando que uma dieta criada em outro lugar
  aparece sem F5. `npm run verify` (typecheck + lint + 1687 testes) verde.

**Parte B — 4 telas, entregue e testada:**

- ✅ **Treino: steppers removidos.** Os botões −1/+1/−2,5/+2,5 abaixo de
  reps/peso saíram de `performed-set-row.tsx`, com `stepped()`/`Step`
  (só existiam para eles). Digitação direta continua igual. Commit `ce377dd`.
- ✅ **Treino: RPE vira bottom sheet.** `RpeSelect` deixou de ser um
  `<select>` nativo — agora é um botão compacto que abre `Dialog
  placement="sheet-bottom"` (reaproveitado, não um componente novo) com os
  8 valores como grade de botões, estilo Hevy mas com o Brand System da
  própria LaCalle Life. Mesmo commit.
- ✅ **Diário: prévia dos alimentos.** "Planejado para [data]" mostra os
  nomes dos alimentos de cada refeição numa linha compacta abaixo do nome —
  mesmo padrão de `MealAlternativesDialog`. Commit `3da0f2a`.
- ✅ **Dieta: cards mais compactos.** `MealCard` reorganizado com o Macros
  como régua: "kcal/Prot/Carb/Gord" por extenso virou um número de kcal +
  uma barra fina colorida (`MealMacroBar`, novo, mesma paleta de
  `MacroProgress`); os 4 botões de ação (duplicar/mover/excluir) viraram um
  ⋮ que abre o mesmo `Dialog` em bottom-sheet. Mesmo commit.
- ✅ **Dieta/Diário: "Adicionar alimento" vira página.** `/alimentos/selecionar`
  substitui o dropdown inline — reaproveita o conteúdo do `FoodPicker`
  (busca, filtros, criar alimento) com um `chrome={false}` que troca só o
  container, e acrescenta o passo que faltava: confirmar a quantidade em
  gramas antes de voltar pra refeição, como o Macros. A escolha viaja de
  volta pela URL (`addFoodId`/`addMealId`/`addGrams`), lida por
  `useApplyPickedFood` (novo, compartilhado por Dieta e Diário). Bug real
  achado e corrigido no caminho: sem uma trava por instrução, o alimento
  podia ser adicionado duas vezes (o `router` do teste — e, em tese, de
  qualquer client router — não garante ser a mesma referência entre
  renders). Commit `3535515`.

`npm run verify` (typecheck + lint + 1707 testes) e `npm run build` verdes
depois de cada parte; principais fluxos confirmados ao vivo no navegador
(servidor de dev local): sheet do RPE, kebab da dieta, e o fluxo completo de
adicionar alimento pela nova página, do clique em "Adicionar alimento" até o
item aparecer na refeição certa com a quantidade certa.

---

## ✅ Três bugs visuais mobile achados em uso real: campos do Treino, gráfico da Evolução, densidade do Diário — 16/09/2026

Pedro testou o app no celular esta semana e trouxe 3 problemas concretos,
com capturas de tela, comparando contra Hevy e MacroFactor como referência
de densidade. Dois dos três eram bugs de CSS reais, não só estética —
confirmados ao vivo (Chrome DevTools MCP, viewport mobile, `next dev`
local) antes de mexer em qualquer coisa.

- ✅ **Treino: campo de reps/peso minúsculo, texto some ao preencher, RPE
  com tamanho diferente dos outros dois.** Causa raiz real: `tokens.css`
  contrazooma `input, select, textarea` para manter o texto em 16px reais
  (evita o zoom do Safari iOS no foco — decisão correta, não mexida). Um
  campo dentro de uma coluna `flex-1` com `width:100%` resolve a
  porcentagem errado quando o próprio campo tem `zoom` — medido ao vivo:
  21,86px de largura renderizada onde deveriam caber ~58px, menor que o
  próprio padding do campo. `RpeSelect` nunca teve esse bug porque seu
  wrapper já era uma largura **fixa** (`w-16`), não uma calculada por
  flex-grow — e é por isso que RPE também parecia "de outro tamanho".
  Corrigido em `performed-set-row.tsx`: os três campos (reps, peso, RPE)
  agora têm largura fixa e autorada (`w-14`/`w-16`), o mesmo padrão que já
  funcionava, replicado. `session-exercise-card.tsx` ganhou o mesmo ajuste
  no cabeçalho de colunas. `planned-set-row.tsx` (editor de rotina) já
  usava `flex-1` direto no campo, sem o wrapper problemático — conferido
  ao vivo, não precisou de mudança.
- ✅ **Evolução: gráfico de volume, reestruturado por robustez, não por bug
  confirmado.** Não consegui reproduzir "gráfico totalmente vazio" com
  dado real no Chrome desktop emulando mobile — a barra desenhou certo.
  Mas o padrão de código (altura em `%` numa `<span>` filha de um
  `<button>` flexível) é um ponto conhecido de inconsistência entre
  motores, principalmente Safari/WebKit, e o app já tinha duas outras
  instâncias da mesma família de bug (o zoom acima; o autofill do Finance
  que pintava campo escuro de branco por cima). `volume-chart.tsx`
  reestruturado: a barra virou uma `<span>` irmã posicionada
  (`position:absolute`) dentro do `<li>` (uma div comum), e o `<button>`
  virou um overlay `inset-0` só para o toque — resolve a altura contra um
  elemento sem esse histórico de inconsistência. Visualmente idêntico
  quando funciona; testes de `volume-chart.test.tsx` continuam passando.
  **Pedro, confira de novo no celular depois do deploy** — não dá pra
  confirmar 100% que essa era a causa exata sem o aparelho real.
- ✅ **Diário: cards de refeição ocupando espaço demais.** Não era bug —
  cada peça (nome, macros, itens, "Adicionar alimento", observações) já
  existia, só o espaçamento entre elas era generoso demais e "Adicionar
  alimento"/"Observações" tinham cada um sua própria linha mesmo numa
  refeição vazia. `meal-card.tsx`: `mt-3` → `mt-2` entre seções, e as duas
  ações da última linha (adicionar alimento + observações) dividem a
  mesma linha agora, numa refeição que não está com o buscador aberto.

**Achado à parte, fora de escopo, registrado para não esquecer:** a lista
de resultados do buscador de alimentos (`FoodPicker`, aberto de dentro de
uma refeição) tem itens que renderizam parcialmente atrás da barra de
navegação inferior fixa — cliques nesses itens acabam ativando a aba
"Treinos" por baixo, em vez do item. Achado testando o fix do Diário, não
mexido: é um problema do picker, não desta entrega.

**Trabalho não commitado encontrado nos mesmos arquivos antes de começar:**
a animação Delete/Collapse (item ⏳ registrado em 12/09/2026, acima) tinha
uma tentativa em andamento — `meal-card.tsx`, `meal-item-row.tsx`,
`planned-set-row.tsx`, `routine-editor.tsx`, `routine-exercise-card.tsx`,
`diet-editor.tsx`, `food-log-screen.tsx`, `meal-alternatives-dialog.tsx`,
`tokens.css` — mas **`npm run verify` não passava**: 4 testes falhando,
incluindo um `src/scratch-animationend.test.tsx` (não rastreado) que é uma
investigação aberta de um bug real do jsdom (`fireEvent.animationEnd` não
dispara `onAnimationEnd` do jeito que o novo código espera). A pedido do
Pedro, isso ficou de lado — `git stash` (mensagem "WIP: animação
Delete/Collapse (testes quebrando, retomar depois)"), não commitado, não
descartado. Retomar exige primeiro entender por que o jsdom não dispara o
evento como o componente espera.

**Retomado em 17/09/2026, por uma rota diferente — ver o topo deste
arquivo.** Não foi o `git stash` acima que voltou: a implementação que
entrou usa `grid-template-rows` como `transition`/`onTransitionEnd`, não
`animation`/`onAnimationEnd`, e por isso nunca esbarra no bug do jsdom
que travou esta tentativa. O stash continua parado no repositório,
agora superado — candidato a `git stash drop`, verificado com o Pedro
antes de descartar dado alheio.

---

## ✅ Auditoria do Motion System no código + Bottom Sheet ganha slide direcional — 12/09/2026

Pedido do Pedro: "eu queria colocar todas as animações dentro do lacalle
life, as animações estao no brandbook". Antes de mexer em qualquer coisa,
uma fork leu a seção de Motion do brandbook único (24 padrões documentados,
6 deles atribuídos explicitamente ao Life) e cruzou cada um contra o código
real — `tokens.css`, `globals.css`, uso de `animate-*` pelo app inteiro —
em vez de presumir a partir do que o roadmap já registrava.

**Resultado: quase tudo já estava implementado e correto.** Entry Insert,
Number Update, Progress Fill, Chart Enter, Success State, Press, Stagger,
Fade/Toast — os oito primeiros conferidos linha a linha contra o componente
real, não só por nome de classe. Morph/Flip/Parallax/Swipe/Shared
Element/Sequence continuam de fora por decisão já tomada e registrada na
entrada "Catálogo de motion do ChatGPT" (09/09/2026) — relitigar teria sido
retrabalho, não achado novo.

**Duas lacunas reais, e só uma foi mexida agora:**

- ✅ **Bottom Sheet ganhou o slide direcional próprio** que o brandbook
  documenta (translateY de baixo pra cima, translateX da esquerda pra
  dentro) em vez do scale+fade do modal centralizado — as duas folhas
  (`sheet-bottom`, `sheet-left`) usavam a mesma regra CSS genérica de
  `dialog`, tratando um drawer como se fosse um modal. `Dialog` agora
  carimba `data-placement` no próprio elemento `<dialog>` (único jeito
  estável de selecionar por variante em CSS, já que a combinação de
  classes utilitárias muda por breakpoint); `globals.css` ganhou duas
  regras espelhando exatamente a técnica que já existia para o modal
  (`@starting-style` + `allow-discrete`), só trocando `scale` por
  `translate`. Tier de duração novo, `--duration-sheet: 350ms` — mesma
  lógica do `--duration-data` já existente: o brandbook nomeia Bottom
  Sheet como padrão próprio, com timing próprio, não um caso do tier
  `standard`. Confirmado no navegador via `getComputedStyle` (não só
  visual): `transitionProperty` inclui `translate`, `0.35s`,
  `data-placement="sheet-bottom"` presente.
- ✅ **Delete/Collapse** (um item sendo removido encolhe antes de sumir, em
  vez de cortar na hora) — fechado em 17/09/2026, ver a entrada do topo
  deste arquivo. Ficou sem implementar por mais uma rodada depois desta
  (16/09/2026, ver "Trabalho não commitado encontrado" acima): uma
  primeira tentativa usou `animation`/`onAnimationEnd`
  (`--animate-dismiss`, opacidade+escala) e travou porque o jsdom não
  dispara `animationend` do jeito que esse código esperava — ficou em
  `git stash`, nunca commitada. A versão que entrou é técnica diferente
  (`grid-template-rows` como `transition`, `onTransitionEnd`), que não
  esbarra nesse problema — `fireEvent.transitionEnd` funciona no jsdom
  sem gambiarra — e também encolhe o espaço de verdade, não só
  opacidade+escala com um salto de layout escondido no fim.
- ✅ **Focus Transition** — fechado em 17/09/2026. O gatilho era o
  candidato óbvio mesmo ("destacar a próxima série em
  `performed-set-row.tsx`"): Pedro respondeu "Pode implementar os 3" em
  vez de decidir diferente.
- ✅ **Shimmer vs. Pulse** — fechado em 17/09/2026. Resolvido como o
  brandbook já descrevia: `Skeleton` vira Shimmer (token
  `--animate-shimmer` novo), `SyncingOverlay` fica com Pulse
  (`--animate-pulse-soft`, único uso que sobra dele).

`npm run verify` e `npm run build` limpos.

---

## ✅ Diário sempre mostra o dia inteiro; o check só marca "comi" — 12/09/2026

Pedido do Pedro: "eu queria que todas as refeições estivessem na aba Diário,
e eu usar o check para aprovar que eu comi. Hoje quando eu tiro o check ele
some da aba diário, e aí fica ruim do usuário ver o que ele precisa fazer no
dia."

**Causa raiz:** `log.meals` usava a própria presença no array como sinal de
"comido" — `checkMeal` adicionava, `uncheckMeal` removia. Isso significava
duas coisas ruins: (1) desmarcar uma refeição já registrada a apagava do
Diário de verdade, não só do estado "comido"; (2) `startDayFromDiet`
("Começar de X") carimbava toda refeição copiada como já comida
("Starting the whole day this way is 'I ate everything as planned'", dizia
o comentário antigo) — então o dia inteiro entrava marcado, e desmarcar uma
única refeição era a única forma de dizer "isto eu não comi ainda", o que
tirava ela da tela.

**Mudança:** `Meal` ganhou `eaten?: boolean` (opcional, `false` só quando
alguém desmarca de propósito — ausência do campo, em dado antigo, continua
lendo como comido, então nenhum dia já registrado muda de leitura).
`startDayFromDiet` agora carimba `eaten: false` em cada refeição copiada:
começar o dia é "aqui está o plano", não "já comi tudo". `checkMeal`/
`uncheckMeal` viraram troca de flag, nunca mais adicionar/remover do array —
a refeição fica visível e editável no Diário o dia inteiro, comida ou não.

Duas funções novas em `meal-execution.ts`: `isMealLogged` (existe uma cópia
no dia, comida ou não — o que a lista compacta "Planejado para X" agora usa
pra decidir o que ainda nem foi puxado pro dia) e `isMealEaten` (comida de
verdade). `eatenMeals`/`eatenMacros` — só o que foi realmente comido conta
nos totais de calorias/macros do Diário e do "Hoje" (`TodayEnergy`,
`TodayMeals`); sem isso, o anel de calorias contaria comida ainda não
comida, o oposto do que um diário alimentar existe pra fazer.
`diet-adherence.ts` também precisou trocar de "presença no log" para
"`isMealEaten`" — senão todo dia que alguém começasse de uma dieta contaria
100% de aderência mesmo sem tocar em nada.

`mealSchema` em `backup-schemas.ts` ganhou `eaten` como opcional, mesma
razão de sempre (não quebrar backup/sync de dado anterior a este campo).

`npm run verify` limpo (1670 testes, incluindo os reescritos em
`meal-execution.test.ts`/`start-day.test.ts`/`food-log-screen.test.tsx` para
a nova semântica) e `npm run build` limpo. Verificado no navegador: vincular
"Cutting" ao dia da semana de hoje, "Começar de 'Cutting'" mostra a refeição
inteira e editável já na tela, desmarcada (total do dia em 0 kcal); marcar
soma ao total; desmarcar de novo mantém a refeição visível, com todos os
itens, e volta o total a 0 — nunca mais some.

---

## ✅ Nome do exercício sobrepondo as etiquetas na folha de seleção — 12/09/2026

Achado real de uso, com captura de tela do Pedro: "Agachamento Búlgaro"
(e a maioria dos nomes de dois termos) quebrava linha e a segunda linha
ficava por cima do texto de "COMPOSTO UNILATERAL INTERMEDIÁRIO" à direita —
literalmente sobreposto, não só apertado.

Causa: `ExerciseRow` reservava uma coluna de largura fixa (`shrink-0`) pras
três etiquetas, ao lado do nome (`flex-1 min-w-0`). Numa folha de ~470px
úteis, thumbnail + etiquetas + favorito + adicionar sobravam menos de 20px
pro nome — qualquer palavra que não coubesse nesse resto ultrapassava a
própria caixa, por cima da coluna vizinha.

Removidas as três etiquetas (Composto/Unilateral/dificuldade técnica) da
linha da lista — pedido explícito do Pedro: só o nome completo do
exercício, com espaço pra não quebrar na maioria dos casos. A informação
não desaparece: já existe na ficha de detalhe que a mesma linha abre ao
tocar (`exercise-detail.tsx`), mesma convenção que o resto da tela já usa
("linha é o essencial, detalhe é tudo"). `npm run verify` limpo (uma falha
isolada em `identity-isolation.test.ts` por máquina saturada, mesmo padrão
já visto antes nesta sessão — confirmada por rodar sozinha em 3,5s).
Verificado no navegador buscando "aga": os 12 resultados agora cabem numa
linha só, sem sobreposição.

---

## ✅ Ordem do multi-seletor, folha protegida contra fechar sem querer, sugestões de refeição — 12/09/2026

Três pedidos do Pedro, achados reais de uso.

**Exercícios entravam em ordem alfabética, não na ordem que foram
adicionados.** A causa: `ExerciseBrowser` guardava a seleção múltipla como
`Set<string>` e, ao confirmar, filtrava `state.exercises` (o catálogo
inteiro, sempre ordenado alfabeticamente por `use-exercise-catalogue.ts`) em
vez do lote escolhido — então a ordem de exibição vencia a ordem de clique.
Virou um array que preserva a ordem de seleção, e a confirmação mapeia os
ids nessa ordem de volta para os exercícios. Regressão coberta em
`exercise-browser.test.tsx` (o teste antigo até evitava afirmar a ordem, com
comentário próprio dizendo que ela não importava — importava, só que o bug
escondia isso).

**Fechar a folha "Adicionar exercício" com exercícios já marcados e ainda
não confirmados perdia o lote inteiro** — relatado depois de acontecer duas
vezes seguidas com clique fora sem querer. `Dialog` ganhou um prop
`confirmClose` opcional, chamado antes de qualquer uma das três formas de
fechar (X, Escape, clique fora) — devolver `false` cancela o fechamento. A
folha de exercícios usa isso com `window.confirm` quando há seleção
pendente. Coberto em `dialog.test.tsx` (X, evento `cancel` nativo e o
fallback de clique de fundo para navegadores sem `closedby`).

**"Outras sugestões" na Dieta** — pedido para não ter que reeditar alimento
por alimento toda vez que muda o que vai comer numa refeição (o exemplo do
Pedro: marmita de arroz ou de macarrão). `Meal` ganhou `alternatives?`, uma
lista de sugestões nomeadas independentes dos itens ao vivo — salvar não
sincroniza de volta, e trocar não perde a sugestão anterior a menos que ela
já tivesse sido salva. Botão "Outras sugestões" ao lado de "Adicionar
alimento" em `MealCard`, só quando `DietEditor` passa os callbacks (o
Diário/`FoodLogScreen` não ganhou o botão — um dia já comido não tem o que
sugerir). Novas funções em `edit-diet.ts`
(`saveMealAsAlternative`/`applyMealAlternative`/`renameMealAlternative`/
`removeMealAlternative`), todas seguindo a convenção de retornar a mesma
referência num id desconhecido. `mealSchema` em `backup-schemas.ts` ganhou
o campo opcional — mesma lição documentada ali sobre `sourceDietId`: sem
isso, backup/sync de uma refeição com sugestão viraria `"invalid-payload"`.

Verificado no navegador nos três fluxos (ordem de seleção, swap de
sugestão persistindo entre reload, contagem no botão). `npm run verify`
(typecheck + lint + 1661 testes) e `npm run build` limpos.

---

## ✅ Catálogo de motion do ChatGPT — triado, não copiado — 09/09/2026

O Pedro trouxe um HTML gerado pelo ChatGPT (`preview.html`, "LaCalle Motion
Catalog") com ~28 padrões de transição e pediu para adicionar todos. Em vez
de colar, cada um foi comparado contra o que já existe e contra as decisões
já fechadas na pesquisa de Motion System v1 — o próprio catálogo já vinha com
`--duration-fast/normal/slow` (180/280/450ms) e uma seção "07. Padrões
avançados" com o aviso "devem ser usados com muito mais critério", ou seja,
mesmo a fonte pedia triagem.

**Já existia, sob outro nome — nada a fazer:** Fade/Reveal-on-scroll (Reveal
da Landing), Stagger (Hoje, Evolução, Landing, rotina de treino), Success
State (`--animate-pop`), Toast (`useToast`), Progress Fill/Chart Enter
(`--duration-data`, inclusive o gráfico de evolução que já se desenha),
Bottom Sheet (`Dialog placement="sheet-bottom"`), Shimmer (`Skeleton` já usa
`--animate-pulse-soft`), Press (`active:scale-90` já padrão nos botões de
check).

**Implementado agora, achado real com lugar certo:**
- ✅ **Entry Insert** — item novo entra com `--animate-rise` ao ser
  adicionado a uma refeição (Diário e Dietas). O próprio catálogo chama isto
  de o padrão mais importante para o conceito de Cronista. Commit `9503185`.
- ✅ **Number Update (flash de cor + bump)** — tinha sido rejeitado abaixo por
  contrariar a pág. 48 do Brandbook (cor sempre acompanhada de ícone+texto).
  O Pedro pediu explicitamente para ignorar essa leitura e implementar mesmo
  assim, registrando a exceção no próprio `docs/brandbook.md` em vez de só
  no código — decisão e razão completa na nova seção "Number Update —
  exceção pontual à pág. 48" desse arquivo. Aplicado em `Metric` (usado nos
  macros de `TodayEnergy`) e à mão no número de kcal restante do
  `CalorieRing`. Token `--animate-value-change` deliberadamente sem
  `fill-mode: both`, para não congelar o `tone` de cada instância — coberto
  por teste em `metric.test.tsx`. Commit `f826dbb`.

**Rejeitado, com o motivo escrito para não ser reaberto por engano:**
- **Pulse** (indicador de sincronizando) — `DietSyncStatus`/`FoodLogSyncStatus`
  são **deliberadamente sem spinner** ("transparente", comentário no próprio
  código) — adicionar um pulso contradiria uma decisão de produto já tomada.
- **Morph, Flip 3D, Long Press, Sequence, Slide genérico** — nenhum tem uma
  tela real no LaCalle Life que precise deles hoje; adicionar seria inventar
  UI só para ter o que animar, o efeito-sem-função que a Regra de Ouro do
  Motion System já rejeita por princípio.
- **Parallax** — Level 5/Cinematic, já decidido só para landing/marketing, e
  mesmo lá com moderação (pesquisa de 07/09).
- **Shared Element** — já identificado como "maior risco técnico, testar
  antes de adotar" na pesquisa original; continua não implementado, de
  propósito.
- **Swipe (gesto real)** — exigiria uma biblioteca de gesto ou handler de
  toque manual, escopo bem maior que uma transição CSS; nenhuma tela do app
  usa swipe-to-edit/delete hoje (usa botões com revelação por hover/grupo).
- **Delete/Collapse (linha encolhe antes de sumir)** e **Focus Transition**
  — candidatos reais, não implementados nesta rodada: o primeiro exige
  adiar a remoção de verdade até a animação terminar (duas fases, mais
  arquitetura que os outros itens desta lista), o segundo precisa de um
  lugar concreto (ex.: destacar a próxima série em `session-runner.tsx`) que
  ainda não foi decidido.

---

## ✅ Mais intensidade de motion — Landing e abas do app — 09/09/2026

Pedido do Pedro depois da primeira entrega de motion na Landing: mais peso
ali, e o mesmo cuidado espalhado pelas abas do app de verdade.

**Landing (commit `03c1e4d`):** `Reveal` subiu de Level 2 (`--duration-standard`,
250ms) para Level 3 (`--duration-signature`, 450ms) com escala além de
opacidade/translação; distância dobrada; estágio entre irmãos dobrado. Hero
com cascata de 0/80/160/240ms em vez de 0/40/80/120ms. Ainda as duas curvas
oficiais, ainda sem física de mola — mais peso vem de distância/escala/
duração, nunca de curva nova. A cerca do Hero (nada de gradiente/blob atrás
do texto, pág. 20 do brand system) continua de pé.

**Abas do app — três lacunas reais encontradas, não decoração nova:**

- ✅ **`/evolucao`** — o gráfico de tendência (peso/gordura/medidas) não
  tinha nenhuma entrada; a linha aparecia pronta. `--animate-draw-line`
  (token novo): a linha se desenha com `stroke-dashoffset`, sem
  `getTotalLength()`, continua Server Component. Commit `5178ca5`.
- ✅ **Diário** — o check de "comer uma refeição" só trocava de cor; o
  Treino já tinha `--animate-pop` no check de série equivalente e o Diário
  não. Mesma técnica exata (contador de toques + `key` + `active:scale-90`),
  copiada de propósito. Commit `2a70627`.
- ✅ **Perfil** — o botão de tema claro/escuro trocava de ícone sem nenhum
  toque. Mesma técnica de novo. Commit `433aec9`.

Nas três, a animação está presa ao toque, nunca ao estado lido do banco —
reabrir a tela nunca deve disparar a animação sozinha, mesmo cuidado que já
valia para o check de série original.

---

## ✅ Landing Page (`/`) sempre visível, com motion — 09/09/2026

Pedido do Pedro: parar de pular `/` direto pra `/hoje` pra quem já usa o
app, e usar a pesquisa das seis fontes de motion o máximo possível na
página que fica pública.

- **`LandingRedirect` removido de vez** (não só desligado) — junto com
  `hasEnteredAppBefore`/`markAppEntered`/`entered-app.ts`, que só existiam
  pra alimentar esse redirecionamento. Commit `239e335`.
- **Entrada em stagger na página inteira**: Hero anima ao carregar
  (`--animate-rise`, não `IntersectionObserver` — é a primeira coisa que
  a visita vê); Pilares, as três seções de funcionalidade e os cards
  Sem conta/Com conta revelam ao rolar, via `use-reveal.ts` +
  `reveal.tsx` (hook e wrapper próprios, sem biblioteca). Os dois
  mockups que já imitavam a interface real (`VisualWorkout`,
  `VisualEvolution`) ganharam motion de verdade: o gráfico de volume
  cresce com `--duration-data` (mesma transição do gráfico real em
  `volume-chart.tsx`), os checks de série assentam com `--animate-pop`
  (mesma microinteração de `performed-set-row.tsx`). Commit `1337684`.

**Onde parei antes do "máximo possível", de propósito:**

- **Nada de gradiente ou blob de fundo no Hero.** A pág. 20 do Brand
  System já proíbe isso por auditoria anterior à V1 ("sem gradiente
  sobre o texto, sem sombra difusa, sem blob de fundo") — é exatamente
  o estilo GetLayers que a pesquisa de motion também já tinha isolado
  como "só landing, com moderação". Aqui a landing É o contexto, e
  mesmo assim a regra explícita do Brandbook vale mais.
- **Nada de física de mola.** Mesma decisão da pesquisa de Motion
  System v1 (`docs/brandbook.md`) — as duas curvas oficiais, sem
  exceção, dentro ou fora do produto.
- Se quiser ir além disso (um gradiente WebGL numa área sem texto, por
  exemplo, ou algo mais próximo do 60fps.design em intensidade), isso é
  uma decisão de imagem de marca que passa pelo Pedro antes — não uma
  omissão técnica.

**Achado real, só apareceu no navegador:** `VisualWorkout`/`VisualEvolution`
chamavam `useReveal` (hook client-side) sem `"use client"` — quebrava a
página inteira (Server Component chamando hook de Client Component), e nem
o typecheck nem o build pegaram, só abrir a tela de verdade. Corrigido junto
com um mismatch de hidratação real em `use-reveal.ts` (o estado inicial
dependia de `typeof window`, servidor e cliente discordavam sobre o valor
— reescrito para nascer sempre `false` dos dois lados; `prefers-reduced-motion`
virou responsabilidade só do CSS, nunca do estado inicial).

---

## ✅ Motion System v1 chega no código — 09/09/2026

Implementação do que a pesquisa de motion (07/09) e a emenda do
`docs/brandbook.md` já tinham decidido — não é pesquisa nova, é aplicar o
que já foi aprovado.

**Estava marcada "EM ANDAMENTO"; não estava mais.** A auditoria de
12/09/2026 ("Auditoria do Motion System no código", mais acima neste
arquivo) conferiu esta lista item a item contra o código real e achou tudo
entregue, com só duas lacunas novas (Bottom Sheet, fechada na própria
auditoria, e Delete/Collapse, que segue aberta) — nenhuma delas é o que
este bloco "Ainda no mapa" listava.

**Entregue:**

- ✅ `--duration-data: 550ms` formalizado em `tokens.css` (o quinto tier,
  proposto e ainda não ratificado no PDF — ver a emenda). Commit `4f48b3b`.
- ✅ Migradas as 5 animações reais de progresso/dado que usavam
  `--duration-standard` por engano — anel de calorias, barra de macro,
  gráfico de aderência da dieta, gráfico de volume de treino, barra de
  séries do treino em andamento. Mesmo commit.
- ✅ Resumo de treino ("treino concluído") ganhou entrada em stagger nos
  três números (Duração/Séries/Volume) — Level 4/Celebration do mapa, não
  tinha nenhuma animação de entrada até agora. Só os três números fixos,
  nunca a lista de exercícios sem teto abaixo. Commit `5f0d79f`.

**Ainda no mapa, por prioridade** (`docs/melhorias-teste-real-08-09-2026.md`
não cobre isto — ver a pesquisa de Motion System v1, seção 14, para a lista
completa com nível/duração/fonte):

- Streak — **não implementável ainda**: não existe conceito de streak no
  modelo de dados hoje. Seria feature nova, não motion; fora de escopo até
  virar pedido de produto.
- Bottom sheet para ações rápidas — parcialmente feito: o seletor de
  exercício já é sheet (item acima). Falta o Finance (parcelas, metas).
- Timer de descanso, empty states, loading — já existiam antes desta
  rodada, conferidos contra o mapa e certos.
- Toast de confirmação, cross-fade de filtro, count-up — só existem no
  Finance ainda, repositório separado.

Life e Finance são repositórios diferentes — o que falta no Finance
(toast, filtro, `--duration-data` lá também) precisa ser retomado
naquele repositório.

---

## ✅ Seletor de exercício vira folha, com multi-seleção — 09/09/2026

Pedido do Pedro depois das melhorias acima, com referência visual de um app
de treino (duas capturas de tela): o painel de "Adicionar exercício" crescia
inline e empurrava o treino inteiro para baixo pela altura do catálogo — a
mesma razão que já tinha tirado o filtro de exercícios do fluxo normal (ver
comentário em `exercise-browser.tsx`).

- **`ExerciseBrowser`** ganhou `selectionMode` (`"immediate"`, o padrão —
  preserva o fluxo de trocar exercício de um slot só — ou `"multiple"`):
  tocar num exercício marca no lote (ícone vira check), nada é reportado até
  apertar "Adicionar" na barra fixa — mesmo padrão que o rodapé do filtro já
  usava. A contagem sobrevive a uma troca de filtro que não bate com nada,
  para não perder o que já foi escolhido.
- `autoFocus` virou prop explícita (off por padrão — `/exercicios` não deve
  puxar o teclado sozinho ao navegar; ligado só na folha).
- `routine-editor.tsx`: os dois painéis inline (adicionar e trocar) viraram
  `Dialog placement="sheet-bottom"` — o mesmo componente que o filtro de
  exercícios e o drawer do menu já usam, não um terceiro tipo de modal
  escrito à mão. Trocar continua imediato e um a um, de propósito.

12 testes novos/reescritos em `exercise-browser.test.tsx`. Verificado também
no navegador: a folha abre por cima de tudo, busca com foco automático,
barra fixa com contagem e "Adicionar" desabilitado até escolher algo.
`npm run build` limpo, suíte de workouts inteira (394 testes) verde. Commit
`eaba5dd`.

---

## ✅ Melhorias de teste manual real: Dietas, Alimentos, Treinos — 08–09/09/2026

Pedido do Pedro depois de usar o app de verdade, espec completa em
`docs/melhorias-teste-real-08-09-2026.md`. Regra do pedido: investigar antes
de mexer, sem refatoração desnecessária, sem quebrar o que já funciona,
migração segura de dado existente, melhorias cirúrgicas — não uma reescrita.
**Os oito itens estruturais foram entregues em 09/09/2026.**

### Relatório de aceitação

**Implementado**, um commit por item, todos com `npm run verify` (typecheck +
lint + testes) verde antes do commit:

1. Criar alimento sem sair do fluxo da dieta/diário (`6fc9121`)
2. Mensagem de calorias/fibra simplificada (`a310f15`)
3. e 4. Trocar exercício no slot + feedback ao adicionar (`a0bb55f`)
5. Hierarquia visual da unidade caseira (`fc93658`)
6. Deduplicação de alimento (mussarela) (`c7229d6`)
7. Medida caseira em alimento personalizado (`c23cddb`)
8. Porção, kcal e macros na busca de alimento (`75aef42`)

**Decisões de arquitetura:**

- **Unidade/porção**: o modelo `PracticalUnit` (`label` + `grams`) já
  existia e já cobria os exemplos do pedido — o trabalho real foi de
  exposição (itens 5, 7, 8), nunca de schema novo no catálogo.
- **Gramas**: continuam a única unidade nutricional de verdade; toda medida
  caseira é convertida para grama no momento de entrada (`grams = quantidade
  × unit.grams`), nunca armazenada como uma segunda grandeza.
- **Calorias**: `kcal` continua um valor digitado (do rótulo), nunca
  derivado — a estimativa por Atwater (4/4/9) é só uma sugestão, com a
  ressalva de fibra correta desde sempre, só a explicação no texto mudou.
- **Alimentos personalizados**: ganharam paridade com o catálogo curado —
  podem ter medida caseira (item 7) e podem ser criados sem sair da dieta
  (item 1), os dois pela mesma `useFoodEditor`/`CustomFoodForm` que
  `/alimentos/novo` sempre usou, sem duplicar validação nem serviço.
- **Troca de exercício**: `replaceExercise()` distingue exercício (o que
  preenche o slot) de slot (id, sets, restSeconds, notes) — só o primeiro
  muda numa troca.

**Testes**: suíte inteira rodada como verificação final — 1618 de 1619
passando, `npm run build` limpo. O único que falhou
(`in-progress-banner.test.tsx`) era pré-existente e não relacionado a
nenhum dos oito itens — o arquivo não tinha sido tocado em nenhum commit
desta entrega, confirmado por `git diff`. **Corrigido à parte, a pedido do
Pedro** (commit `8007bc1`): causa raiz real, não um teste "flaky" — o teste
comparava uma sessão com data absoluta (`2026-09-02`) contra `Date.now()`
de verdade, então a partir de 2026-09-03 a sessão "de hoje" virou "de dias
atrás" pelo calendário, e o banner passou a mostrar "iniciado há N dias"
em vez de "começou há". `vi.useFakeTimers({ shouldAdvanceTime: true })` +
`setSystemTime` (mesma convenção de `manual-sync-button.test.tsx` e
`toast.test.tsx`) fixam o relógio, sem tocar fixture nem componente. Suíte
inteira agora: **1619 de 1619**. Testes novos adicionados para: criação de
alimento pela dieta, cálculo de calorias, medida caseira (schema +
formulário + create/update), troca de exercício, porção/macros na busca.

**Riscos conhecidos, não alterados de propósito:**

- **Duplicidade de alimentos**: só a mussarela foi confirmada e resolvida.
  Uma varredura fuzzy no catálogo inteiro (581 alimentos, todas categorias)
  não achou outro caso real — os ~20 pares parecidos que apareceram são
  alimentos genuinamente diferentes ("com gordura" vs. "sem gordura", "tipo
  1" vs. "tipo 2"). Não é garantia formal contra o futuro, é o que a
  varredura atual mostrou.
- **Shared element / FLIP na troca de exercício**: cogitado na pesquisa de
  Motion System, não implementado — o card troca de conteúdo no lugar, sem
  animação de "voo" entre posições. Decisão de manter simples até haver
  sinal de que faz falta.

### Detalhe por item

- ✅ **Item 2** — mensagem de calorias/fibra simplificada; cálculo (Atwater
  4/4/9) confirmado correto como estimativa, só o texto mudou. Commit `a310f15`.
- ✅ **Item 5** — o número da unidade caseira ("1 fatia") usava
  `text-ink-muted`, lendo como placeholder mesmo sendo valor real. Corrigido
  para `text-ink`, e os dois campos de quantidade agora selecionam o valor
  inteiro ao focar, para que digitar substitua em vez de concatenar. Commit `fc93658`.
- ✅ **Itens 3 e 4** — `replaceExercise()` troca o exercício de um slot
  preservando id/sets/restSeconds/notes (reusa o mesmo `ExerciseBrowser` do
  fluxo de adicionar); o card recém-adicionado toca `--animate-rise` uma
  vez, disparado pela ação de selecionar — nunca por estado persistido da
  rotina. Commit `a0bb55f`.
- ✅ **Item 6** — investigado e resolvido: duas entradas reais para
  mussarela, uma do catálogo original (`queijo-mozzarella`, 280kcal) e uma
  da importação TACO (`queijo-mozarela`, 330kcal) — dedup daquela
  importação só comparava por id exato, nunca por nome. Pedro decidiu manter
  a grafia com dois zz; a entrada da TACO foi removida (581→580 alimentos,
  nenhuma referência externa a ela existia). Commit `c7229d6`.
- ✅ **Item 1** — `FoodPicker` (compartilhado por `MealCard` e
  `food-log-screen`) ganhou um "Criar alimento" sempre visível, pré-preenchido
  com o texto já buscado. Reusa `useFoodEditor(null)` + `CustomFoodForm` — o
  mesmo caminho de `/alimentos/novo` — só muda o que acontece depois de
  salvar (`onSaved`/`onCancel` novos, opcionais, sem tocar o comportamento da
  tela standalone). `useFoodEditor.save()` passou a devolver o `Food` salvo,
  não só um booleano, pra selecionar o alimento recém-criado sem reler o
  catálogo. Commit `6fc9121`.
- ✅ **Item 7** — investigado antes de mexer: `PracticalUnit` já cobre os
  três exemplos do pedido (pão francês, pão de forma, ovo — 554 de 580
  alimentos já têm medida caseira). O gap real era outro: alimento
  personalizado nunca teve como declarar uma medida. `CustomFoodForm` ganhou
  um toggle opcional "Adicionar medida caseira", off por padrão;
  `practicalUnitSchema` ganhou mensagens em português (nunca tinha, só era
  usado internamente para o catálogo). Commit `c23cddb`.
- ✅ **Item 8** — cada linha do `FoodPicker` passou a mostrar categoria +
  porção de referência (medida caseira quando existe, senão 100 g) junto com
  kcal e os três macros escalados pra essa porção, usando a cor que
  `MACRO_CODING` já define em todo o resto do app. Estrutura inspirada no
  app Macros, identidade visual do Brandbook. Sem marca/fonte porque `Food`
  não tem esse campo — inventar seria pior que omitir. Commit `75aef42`.

Espec completa, com os oito fluxos de teste e o texto de cada item na
íntegra: `docs/melhorias-teste-real-08-09-2026.md`.

## 📋 Pesquisa entregue — Motion System v1 (histórico) — 07/09/2026

**Entrada histórica: o "pendente, sem código" do título não vale mais.** O
que saiu desta pesquisa foi implementado nas entradas de 09/09 e 12/09
acima — `--duration-data`, a decisão de nunca usar física de mola, e os
doze padrões priorizados abaixo, todos conferidos contra o código real na
auditoria de 12/09. Mantida como registro do que a pesquisa original
encontrou, não como lista de trabalho pendente.

Pesquisa de motion feita contra seis fontes (60fps.design, React Bits,
Uiverse, Curated, Motion Sites, GetLayers), lida contra o Brandbook e os
tokens que já existem em `src/design-system/tokens.css`. Nenhum arquivo foi
alterado, nenhuma dependência instalada — na época.

**Relatório completo:** https://claude.ai/code/artifact/ff5fc5a5-3f99-477b-9080-c15e90cac5e7
(mesmo relatório está anotado no roadmap do Finance, é a mesma pesquisa para
os dois produtos.)

O que sair daqui quando for retomado:

- **Token novo de baixo risco:** `--duration-data` (~550ms), para o nível
  "Data" (gráficos, contadores, progresso) que hoje não tem token próprio —
  o Finance usa números soltos (520ms/600ms) para o mesmo papel.
- **Decisão já tomada, não reabrir:** nada de spring physics (`spring-soft`,
  `spring-standard`, `spring-bouncy`) nem uma terceira curva de easing. O
  Brandbook certifica no QA (pág. 53) que só as duas curvas oficiais
  (`--ease-out`, `--ease-in`) valem — física de mola exigiria emenda ao
  Brand System, não é decisão de implementação isolada.
- **Doze padrões priorizados** para virar backlog de produto (streak reveal,
  check com feedback imediato, bottom sheet, timer de descanso, resumo de
  treino com stagger, entre outros) — lista completa e com risco anotado no
  relatório, seção 14.
- **Maior risco técnico identificado:** shared element transition na troca
  de exercício (custo de FLIP) — testar com lista real de 15+ itens antes de
  adotar.
- **Restrição confirmada, 07/09/2026: só plano gratuito das seis fontes.**
  Nenhuma recomendação depende de 60fps PRO, React Bits Pro, Curated Pro ou
  GetLayers Unlimited/Full Stack — checado fonte a fonte na seção 01b do
  relatório. Duas conferências pendentes na hora de implementar: Count
  Up/Carousel/Dock do React Bits ainda no tier Starter, e o gradiente de
  hero do GetLayers vindo do conjunto gratuito (não dos templates pagos
  citados só como referência de tom).

## Produção destravada + ajustes finais — 26/08/2026

- **Env vars do Supabase configuradas na Vercel, com redeploy.** O
  Blocker #1 da auditoria abaixo está resolvido — login, cadastro,
  recuperação de senha e conta funcionam em produção agora. Confirmado
  ao vivo em `lacalle-life-2.vercel.app/entrar`.
- **Perfil corrigido para usar `PageShell`** como toda outra tela —
  achado do Pedro: no desktop, só essa tela tinha margens fixas em vez
  das responsivas do resto do app, e lia como uma coluna de celular
  presa no meio da página.
- **Confortável é o padrão de densidade em telas de desktop** (>=1024px,
  o mesmo breakpoint da sidebar) — pedido do Pedro, "a tela do PC é
  maior". Só o padrão muda com a tela; uma escolha explícita continua
  valendo em qualquer largura. Depois disso, a escala inteira subiu mais
  um degrau a pedido dele: Compacto = Padrão antigo, Padrão = Confortável
  antigo, Confortável = ainda maior que isso.
- **Conta (e-mail, trocar senha, sair) agora vive dentro de Perfil.**
  Existia só em `/conta`, uma rota que nenhuma navegação linkava — por
  isso nunca tinha sido testada. Perfil passa a ser também a única tela
  do app que leva a `/entrar`/`/cadastro`.

## Auditoria externa de produção — 26/08/2026

Auditoria pedida pelo Pedro contra `lacalle-life-2.vercel.app` (commit
`03ab45c`), investigação sem alteração de código. Achou dois blockers reais.

- **⚠️ Pendente, só o Pedro resolve**: `NEXT_PUBLIC_SUPABASE_URL` e
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` não estão configuradas no projeto Vercel
  de produção — nenhuma requisição a domínio Supabase acontece em toda a
  sessão auditada. Sem isso, **login, cadastro, recuperação de senha e a
  tela de conta ficam inacessíveis para todo mundo**. Precisa ser
  configurado em Vercel → Project Settings → Environment Variables
  (ambiente Production), com redeploy depois.
- **Corrigido — nenhum error boundary em todo o app.** `(auth)/layout.tsx`
  cria o cliente Supabase dentro de `useState(fn)`, durante a própria
  renderização, fora de qualquer `try/catch` — com a env var ausente, as
  4 rotas de auth quebravam com a tela crua do navegador ("This page
  didn't load"), sem nada que o app pudesse dizer. `src/app/error.tsx`
  (pega qualquer throw abaixo do layout raiz) e
  `src/app/global-error.tsx` (o único nível acima, para um throw no
  próprio layout raiz) resolvem isso — verificado ao vivo com um build
  de produção sem as env vars, mostrando a tela tratada em vez da crash
  nativa, com o resto do app continuando funcional.
- **Corrigido — log repetido no console durante sincronização automática.**
  O auto-sync do Diário tratava "Supabase não configurado" como falha
  transitória igual a qualquer outra, tentando de novo a cada dia
  carregado. `isSupabaseConfigured()` (não-lançante) deixa esse caso ser
  tratado como estado permanente e silencioso, igual "não autenticado" já
  era.
- **Confirmado, não é bug** (os 3 itens que o próprio pedido de auditoria
  citou como suspeitos): meta de fibra sem "consumido" (por desenho — sem
  dado real de fibra no catálogo), validação de nome curto em exercício
  personalizado, e a animação de exercícios (corrigida no mesmo dia,
  commit `e5a0d3c`).
- Achados menores registrados, não corrigidos: 404 em `/favicon.ico`
  (cosmético), botão de concluir série aceita confirmação vazia sem dados
  preenchidos (UX).

## Correções pós-teste real em iPhone — 26/08/2026

Segunda rodada da mesma sessão, depois que o Pedro testou os itens da rodada
anterior no próprio iPhone/Safari e reabriu três pontos. Mesma trava: nada de
sync/Supabase/Auth/RPC/RLS além do estritamente necessário.

- **Fibra** — removido o aviso e o cálculo escalado por caloria
  (14 g/1000 kcal). `FIBER_REFERENCE_G` (35 g/dia) é uma meta de referência
  fixa do produto, igual para qualquer perfil — nunca uma recomendação
  médica personalizada. O dashboard de Hoje mostra só a meta, sem
  "consumido": nenhum alimento do catálogo carrega dado de fibra, e um
  número aqui seria sempre "0 g" — dado real parece, mas é ausência de dado
  (na dúvida, omitir).
- **Criar dieta a partir do Diário** — link direto para `/dietas` ao lado de
  "Adicionar refeição" no dia vazio, sem duplicar o fluxo de criação
  existente.
- **Animação de exercícios "quebrada" — não era bug, causa raiz confirmada
  no dispositivo real.** "Reduzir Movimento" estava ligado o tempo todo —
  as duas negativas anteriores (Baixo Consumo, e depois "desligado
  também") estavam erradas; só confirmado de verdade com print de
  Ajustes → Acessibilidade → Movimento, depois de um overlay de depuração
  temporário direto na tela (sem inspetor remoto disponível pro aparelho).
  O app sempre respeitou `prefers-reduced-motion` corretamente. O bug real
  era outro: o botão de play/pause desaparecia inteiro com a preferência
  ligada, sem deixar nenhum jeito de pedir a animação por escolha própria.
  Corrigido — nada mais toca sozinho com a preferência ligada, mas o botão
  continua alcançável e funciona quando tocado (WCAG 2.3.3: movimento
  pedido explicitamente é diferente de movimento automático).
- **"Criar" (dieta/treino) e "Adicionar refeição" sem reação no toque —
  causa raiz real, corrigida.** `crypto.randomUUID()`, usado para todo id
  novo, não existe fora de um contexto seguro (HTTPS, ou
  `http://localhost` especificamente). Testando pelo IP da máquina na rede
  (`http://192.168.0.18:3000`, um contexto HTTP puro), a função nem existe,
  e todo clique que cria uma entidade lançava `TypeError` em silêncio —
  "toda vez, nada muda na tela". `createEntityId` agora cai para
  `crypto.getRandomValues` quando `randomUUID` está ausente, montando à mão
  o mesmo formato de UUID v4. Provado por reverter-e-conferir: o teste novo
  falha com o erro exato do log real quando a correção é desfeita.
- **Tabela de alimentos desalinhada no iPhone — causa raiz real, corrigida.**
  Não era só o cabeçalho quebrando linha: a soma das colunas fixas (estrela,
  kcal, Prot, Carb, Gord, espaço de editar/excluir) já passa da largura de
  um iPhone, e o espaço que sobrava pro nome do alimento ia a zero — o nome
  inteiro sumia, não só quebrava. Encurtar texto não resolve quando o
  espaço disponível é zero. A tabela agora rola de lado
  (`overflow-x-auto` + piso de largura) em vez de esmagar qualquer coluna
  até ficar ilegível ou invisível.
- **Achado lateral, não corrigido**: o servidor de dev ficou servindo um
  bundle Turbopack desatualizado depois de um `taskkill` largo demais que
  eu rodei sem querer durante a investigação — o código-fonte já tinha a
  correção da tabela, mas o navegador recebia JS antigo. Resolvido reiniciando
  o servidor com o cache `.next` limpo. Vale lembrar disso se um fix "não
  aparecer" de novo sem motivo aparente: conferir se o chunk servido
  realmente contém o texto/classe esperado antes de suspeitar do código.

## Terceira rodada: densidade de botão virou escala de interface — 26/08/2026

Ainda a mesma sessão. O Pedro reabriu "Tamanho dos botões" (Perfil) várias
vezes seguidas, cada vez achando mais um elemento que não acompanhava —
até pedir explicitamente que a preferência deixasse de ser só sobre botão e
passasse a escalar título, texto, ícone, imagem e espaçamento do app
inteiro, mantendo tudo alinhado.

- Botões tracejados de "Adicionar" (Diário, editor de dieta, editor de
  treino) tinham `py-3.5` fixo, fora do sistema de densidade — trocado por
  `h-(--control-h-lg)`.
- Os dois seletores de Perfil (Tema e o próprio "Tamanho dos botões") eram
  os únicos controles que não acompanhavam a própria densidade — `h-8`/
  `size-8` fixo em vez de `--control-h-sm`.
- Seletor de Tema trocado de 3 rádios (Claro/Escuro/Sistema) por um botão
  só, alternando claro ↔ escuro — pedido à parte, motivado pelo tamanho
  pequeno do controle de 3 opções. `ThemeContextValue` passou a expor
  `resolved` para o botão saber qual ícone mostrar.
- Linhas clicáveis do dashboard (peso → `/evolucao`, sessão de treino
  finalizada) ganharam `min-h-(--control-h-sm)` — um piso, não um valor
  fixo, então onde o conteúdo já é mais alto que o piso (a linha de peso,
  hoje) o tamanho continua vindo do conteúdo.
- **A peça central**: `--control-h*` não cobre título, texto corrido, ícone
  solto ou imagem, e a escala tipográfica do brandbook (pág. 17) é toda em
  px absoluto, presa ao tamanho por desenho — reescrevê-la em cada
  componente não era uma opção real. `zoom` no `html`, dirigido por um novo
  token `--ui-scale` (0.85 / 1 / 1.15) nos mesmos blocos `[data-density]`
  que já existiam, resolve isso numa linha: redesenha a página inteira na
  escala escolhida, mantendo tudo alinhado porque continua sendo a mesma
  proporção. Campo de formulário cancela o zoom ambiente
  (`zoom: calc(1 / var(--ui-scale))`) por motivo funcional: a pág. 26 fixa
  a fonte do campo em 16px pra não reabrir o zoom automático do Safari no
  iOS, e um campo que também encolhesse no Compacto reabriria exatamente
  esse bug.
- Verificado por medição de layout (`getBoundingClientRect` confere a
  proporção exata), não só visualmente — o ambiente de teste usado nesta
  sessão fixa o viewport da captura de tela, o que mascara o zoom nos
  screenshots mesmo com o cálculo correto por baixo. Confirmado bom pelo
  Pedro no iPhone real.
- O bundle Turbopack desatualizado (achado lateral acima) se repetiu mais
  duas vezes ao longo desta rodada, sempre resolvido do mesmo jeito
  (reiniciar com `.next` limpo). Terceira vez que isso aconteceu na mesma
  sessão — se voltar a acontecer em sessões futuras, vale investigar a
  causa de verdade em vez de só contornar.

## Correções P0/P1/P2 — 26/08/2026

Rodada de correções pedida pelo Pedro depois de usar o app de verdade em
`/diario`, com uma trava explícita: não alterar sync/Supabase/Auth/RPC/RLS
nem a arquitetura multi-device além do estritamente necessário. Nada disso
foi tocado.

**P0/P1 — dois fluxos reportados como quebrados:**

- **"Criar uma Dieta" não funciona** — investigado a fundo, **não é um bug
  do app**. Era efeito colateral de um patch de teste que eu mesmo apliquei
  antes, direto no IndexedDB, para contornar o crash pré-existente do
  campo `weekdays` ausente numa dieta de teste ("Dieta Cutting") — zerei as
  refeições dela sem querer. Selecionar essa dieta específica no
  "Começar de uma dieta" volta para a mesma tela vazia (0 refeições →
  0 refeições), o que parece "nada aconteceu". Com qualquer dieta que
  realmente tem refeições, o fluxo funciona perfeitamente — confirmado ao
  vivo. Nenhum código mudou aqui.
- **"Adicionar" exercício personalizado não funciona — real, corrigido.**
  `custom-exercise-form.tsx` exige nome com pelo menos 3 letras
  (`disabled={name.trim().length < 3}`), mas não mostrava nenhuma mensagem
  explicando por quê — o botão parecia clicável e o clique não fazia nada.
  Reproduzido ao vivo (nome de 2 letras, botão sem resposta nem aviso) e
  corrigido: agora mostra "Dê um nome com pelo menos 3 letras." assim que o
  nome fica curto demais, usando a mesma mensagem que o schema já tinha.
  Provado pelo ritual de sempre — reverter, ver o teste novo falhar,
  restaurar, ver passar — com um teste novo para o componente, que não
  tinha nenhum antes (`custom-exercise-form.test.tsx`).

**P2 — UX/conteúdo:**

- **Controle de tamanho dos botões** — confirmado ao vivo (densidade
  compacta, pixel a pixel) que já afeta botões reais em toda a tela, não
  só o botão de exemplo — não era um bug, só o exemplo sendo o feedback
  mais óbvio. Removido o botão de exemplo mesmo assim, como pedido.
- **Tabela de Alimentos** — achado e corrigido um desalinhamento real de
  32px entre o cabeçalho (`kcal/Prot/Carb/Gord`) e os números de cada
  linha, medido em pixels na página real: o cabeçalho reservava `w-8` no
  fim da linha, as linhas reservam `w-16` (o espaço de editar/excluir, que
  toda linha aloca mesmo quando vazio). Corrigido igualando o cabeçalho a
  `w-16`.
- **Dashboard Hoje** — proteína/carboidrato/gordura agora mostram
  "consumido / meta" em vez de só o consumido, só quando existe meta
  configurada (nunca inventa uma).
- **Mensagem da fibra no Perfil** — mantida, não removida. O próprio
  comentário no código já justifica por quê: fibra não é somada por
  alimento no app, então a mensagem evita prometer uma medição que não
  existe. Decisão registrada aqui para o Pedro reverter se discordar.
- **Travessões tipográficos removidos do texto visível da UI** — 16
  arquivos com texto que realmente aparece na tela, reescritos em
  português natural (vírgula, dois-pontos, ponto, parênteses — nunca
  " - " como substituto, que ainda é um travessão). 311 arquivos
  confirmados como travessão só em comentário/JSDoc e **não tocados**,
  varredura linha a linha da árvore inteira. Deixado de propósito: o
  glifo `"—"` que `formatDecimal` e ~12 componentes usam para "sem valor"
  (`placeholder="—"`, `value ?? "—"`) — não é pontuação de prosa, é um
  símbolo de design deliberado para ausência de dado, categoria diferente
  do que foi pedido.
- **Visualização de exercícios** — o loop início/fim com controle manual
  que o Pedro descreveu **já existe** (`exercise-photos.tsx`, ~1,1 s por
  fase, botões de fase + play/pausar). Nunca houve vídeo real no código.
  Nada mudado aqui.

`npm run verify` (typecheck + lint + 1208 testes) e `npm run build` limpos
depois de tudo. Testado manualmente ao vivo: os dois fluxos, a densidade,
a tabela de alimentos, o dashboard e uma amostra das telas com texto
reescrito.

---

## Entregue

| Módulo | Estado |
| --- | --- |
| Fundação local-first | Contrato `Store<T>`, dois adapters conformes, migrações declarativas |
| Design system | Tokens OKLCH, dark mode sem flash, contraste asserido por teste |
| Alimentos | 581 — 216 curados da V1 + 365 da TACO (ingrediente simples), busca sem acento, favoritos, personalizados |
| Dietas | Refeições, itens, totais automáticos, metas opcionais |
| Motor nutricional | TMB, TDEE, metas, macros, validações — fonte única em `core/nutrition` |
| Perfil | Opcional de ponta a ponta; sem ele a dieta funciona igual |
| Exercícios | 183 curados à mão, busca com índice, filtros na URL, personalizados |
| Fotos dos exercícios | 105 pares verificados à mão, CC BY-SA 4.0 atribuída, via CDN |
| Treinos | Criar rotina, montar, configurar séries/reps/peso/descanso/RPE |
| Execução | Marcar série, cronômetro, edição inline, finalizar, resumo |
| Retomar e histórico | Treino em andamento, `/historico`, abrir/editar/apagar sessão |
| "Última vez" | Última performance por exercício durante a execução |
| PRs e volume | Recorde por exercício, volume por período, 1RM estimado |
| Drag and drop | Refeições, itens e exercícios da rotina — setas mantidas |
| Duplicar e copiar | Refeição, alimento entre refeições, exercício, rotina e dieta inteiras |
| Detalhe do exercício | Duas fases do movimento animadas, curadoria completa, fotos no treino |
| Evolução corporal | Peso, gordura e 9 medidas por dia, gráfico de tendência com média móvel |
| Identidade visual | Esmeralda da V1, escuro por padrão, contraste asserido nos dois temas — **as superfícies verdes serão revertidas**, ver a sprint abaixo |
| Densidade por contexto | Desktop mais denso que o celular, não menor — 1152px de conteúdo, cartão de 24px |
| Números em pt-BR | `formatDecimal` em toda superfície: 2,7 e 2.220, e travessão no lugar de `NaN` |
| Tela de hoje | Anel de calorias, macros contra a meta e o treino do dia — funciona sem perfil |
| Navegação no celular | Barra inferior de 5 abas ao alcance do polegar; o resto atrás de "Mais" |
| PWA e offline | Instalável, e abre sem rede — shell, assets e payloads de rota em cache |
| Incremento rápido | −1/+1 rep e ∓2,5 kg na série em execução, partindo do planejado quando o campo está vazio |
| Peso decimal digitável | O separador era engolido ao ser digitado: 6·2·vírgula·5 gravava 625 kg |
| Total à prova de dado corrompido | Um valor ilegível some da soma em vez de virar `NaN` e levar a tela inteira |
| Aviso de peso desatualizado | O perfil oferece usar a última pesagem quando divergem em 1 kg ou mais — oferece, não sincroniza |
| Toast de confirmação | Para as escritas que não deixam rastro na tela: salvar perfil, criar e editar alimento |
| Nome do exercício legível | O cabeçalho da rotina quebra no celular; o nome saiu de 3px para 139px em duas linhas |
| Página 404 própria | Diz o que aconteceu e oferece dois caminhos de volta, com a navegação do app |
| Rótulo de confirmação | `confirmLabel` virou obrigatório — o tipo impede cair no genérico |
| Tempo restante da confirmação | Barra que esvazia no ritmo do desarme, ligada ao mesmo `DISARM_AFTER_MS` |
| Filtro sobreposto | Sheet no celular, modal no desktop, com a contagem de resultados viva enquanto se escolhe |
| Regra modal vs inline | Escrita no `AGENTS.md` e em `dialog.tsx`, com o caso difícil nomeado |
| Criar exercício ao buscar | Antes só existia no estado vazio: com 8 resultados e nenhum sendo o seu, não havia saída |
| Ícone de tela inicial no iOS | PNG gerado pelo Next a partir do próprio traço, sem binário no repositório |
| Catálogo TACO | 365 alimentos da Tabela Brasileira de Composição de Alimentos somados aos 216 da V1 — só ingrediente simples, pratos compostos ficaram de fora; `seedCatalogue` passou de "só roda se o banco está vazio" para diff por id, senão a expansão não chegava a quem já tinha o app instalado |
| Fundo consistente em Hoje | Alimentação e Treino sempre com o cinza do `Card` padrão — antes só o treino em andamento tinha superfície, e o verde continua reservado só para esse estado |
| Corrigir início de treino travado | Campo "Início" na execução: uma sessão esquecida aberta parava de mostrar "começou há 56 horas" só depois de finalizada — agora dá para corrigir o horário sem sair do treino |
| Corrigir conflito falso em Treinos/Dietas | `use-diet-editor`, `use-routine-editor`, `use-session-runner` chamavam `persist()` de dentro do updater de `setState` — o React (`reactStrictMode: true`) invoca esse updater duas vezes de propósito, então uma única edição disparava duas gravações e a segunda perdia a corrida, aparecendo como "alterado em outro lugar" numa única aba. Corrigido com uma `ref` síncrona em vez do padrão funcional de `setState`. Achado pela auditoria externa de 19/08 (BUG-008) |
| `Select` no design system | Todo `<select>` nativo do app (unidade g/ml, mover item, RPE, categoria, sexo/atividade/objetivo) ganhou borda, hover e chevron próprios — o popup continua nativo de propósito, mesma razão do `RpeSelect` original. Pedido depois que o seletor g/ml saiu "meio invisível" |
| Tamanho de botão personalizável | Preferência por aparelho (Compacto/Padrão/Confortável) em Perfil → Aparência, mesma arquitetura do tema. Só afeta altura/padding de botão — input fica fixo em 44px por regra do brandbook, card tem eixo de densidade próprio |
| Dieta vinculada a dia da semana | Iniciativa E do roadmap, decidida e entregue: uma dieta pode ocupar vários dias, um dia aponta pra uma dieta só, o Diário sugere direto em vez de precisar abrir a lista. Atalhos de "fim de semana" e um preset pessoal de "dias de treino" |
| Gráfico de duração em Evolução | Alternância Volume/Duração nos gráficos semanal e mensal de Treinos — mesmo componente de barras, generalizado com `metric`/`formatMetric` em vez de duplicado. Inspirado num app de referência que o Pedro trouxe; único item das sete telas comparadas que valia a pena, o resto (feed social, conta/assinatura, donut de macro) não coube na arquitetura ou na regra de "um destaque por tela" |

**Marco atingido:** criar treino → adicionar exercícios → configurar séries →
salvar → executar → rever no histórico.

---

## Sprint atual — redesign visual

Pedido em 10/08/2026, a partir de duas auditorias independentes (uma da V1,
uma da V2). Escopo **exclusivamente visual**.

### O diagnóstico

A V2 parece um **dashboard técnico / terminal / SaaS de desenvolvedor**. Deveria
parecer um app de saúde, nutrição, treino e bem-estar: moderno, confiável,
agradável, acolhedor.

### A regra

**V1 é a referência visual. V2 é a referência funcional e estrutural.**

Não é copiar componente da V1, nem inventar uma terceira linguagem. É entender o
que fazia a V1 parecer um app de saúde e reproduzir esses **princípios** aqui,
preservando o que a V2 evoluiu. O teste é olhar para a tela e pensar "é
claramente o mesmo produto que a V1".

Quando a estrutura da V2 for melhor — a barra inferior é o exemplo — **mantém-se
a estrutura e troca-se a aparência**.

### Isto reverte uma decisão desta mesma trilha

Registrado porque o `tokens.css` argumenta o contrário, por escrito, e quem ler
só o comentário vai desfazer o redesign de boa fé.

O verde nas superfícies foi pedido ("deixa o verde mais forte, é pra ser o msm
verde que está na V1") e implementado de propósito. O raciocínio na época: a V1
concentra cor numa sidebar de 256px em croma 0.08, a V2 não tem sidebar, então a
cor que ela carregaria foi **espalhada pelas superfícies**.

A medição feita então continua valendo e agora aponta para o outro lado: **na V1
os cartões são neutros — croma 0.01**. A cor mora num elemento só. Espalhar foi
o erro; a saída não é menos verde, é verde concentrado.

### P0 — Identidade ✅ entregue

- [x] **Superfícies neutras de verdade.** Croma caiu de 0.03–0.065 para
      0.005–0.008 no escuro; a profundidade passou a vir de claridade, em
      degraus de ~5 L\* medidos no navegador (2,8 → 7,8 → 13,1 → 18,3).
- [x] **O verde ganha valor ao recuar.** Medido na tela: a superfície tem a\*
      −1,9 e o accent −72,8. O esmeralda é, por larga margem, a coisa mais
      saturada em vista — e agora só aparece na aba ativa, no CTA e no progresso.
- [x] **Números param de parecer log.** As 50 ocorrências saíram; `tabular-nums`
      ficou onde a monoespaçada estava, então o alinhamento sobreviveu à troca.
      A Geist Mono não é mais carregada.
- [x] **Escuro é dark fitness app, não green terminal.**
- [x] **Claro não é o escuro invertido.** Página neutra clara, cartão branco
      destacando por claridade antes da sombra.

Tokens de estado (`warning`, `info`) criados junto — não existiam, e é por isso
que tudo caía em verde ou vermelho. Sucesso é o accent e erro é `danger` de
propósito: um segundo verde ao lado de uma marca verde não é um estado, é ruído.

### P1 — Hierarquia

- [x] **Caloria como herói.** O anel foi de 128px para 144/176px e o número de
      `text-2xl` para `text-3xl sm:text-4xl`.
- [x] **Desktop usa a largura.** Alimentação e treino lado a lado a partir de
      `lg`, dois terços contra um — a proporção diz qual é o principal.
- [x] **Cor de macro sobrevive ao dia zerado.** As barras já usavam
      `protein/carbs/fat`, mas com 0 g a largura é 0% e só o trilho cinza
      aparecia; um ponto colorido ao lado do rótulo carrega a identidade quando
      a barra não pode. Marca identidade, não estado: mantém o tom quando a
      barra fica vermelha por estouro.
- [x] **Refeições e progresso no Hoje.** Saiu junto com o preenchimento da tela:
      `TodayMeals` e `TodayProgress` respondem o que foi comido e para onde o
      peso está indo. A tela passou de duas perguntas para quatro.
- [x] **Cartões com identidade.** O `Card` ganhou três tons — `hero`, `default`
      e `quiet` — que diferem por **superfície e luz, nunca por geometria**:
      mesmo raio e mesmo padding, porque cartão que também muda de forma deixa
      de parecer da mesma família. `hero` é a única coisa que a tela existe para
      mostrar, no máximo um por tela; `quiet` é o cartão sem conteúdo ainda.

      Junto foram embora **onze superfícies escritas à mão** — seis contêineres
      de lista e cinco estados vazios. Não era só duplicação: por serem escritos
      à mão nunca receberam a hairline do topo, então no escuro a lista de
      alimentos parecia um buraco recortado na página enquanto os cartões ao
      lado pareciam elevados. Os cinco estados vazios também discordavam entre
      si sobre o padding (`py-12` contra `py-14`).
- [x] **CTA primário inconfundível** em toda tela que tenha um. O achado não foi
      falta de destaque — foi o CTA principal **desalinhado do campo ao lado
      dele** nas três telas de lista. Em Dietas e Treinos o "Criar" era `lg`
      (46px) contra um campo de 40px; em Alimentos o "Novo" nem vinha do
      primitivo: `h-11` escrito à mão, 44px, quatro pixels pendurados abaixo da
      busca. O botão passou a ler a altura dos mesmos tokens de densidade que o
      campo, e os dois `Link` estilizados à mão como botão primário — Alimentos
      e o fim da sessão — passaram a usar `buttonClasses()`.

      **Hoje continua sem CTA, de propósito.** A tela responde perguntas e a
      navegação está três centímetros acima; o item pede CTA em toda tela *que
      tenha um*.

### P2 — Design system

- [x] **Macros com codificação consistente.** A tripla estava definida em **seis
      lugares** com rótulo e cor próprios, e o "sumir na outra" era literal: no
      formulário de alimento personalizado — a única tela onde alguém *digita*
      proteína, carboidrato e gordura — não havia cor nenhuma. Agora há uma
      tabela só, `design-system/macros.ts`, com rótulo curto e longo (um cabe
      num cabeçalho de refeição, o outro num resumo de perfil).

      **Achado medido: `carbs` como texto reprovava em AA no tema claro** —
      3,58:1 contra o mínimo de 4,5. Os três tokens foram afinados para área
      (barra, ponto, gráfico) e são asseridos a 3:1, que é o que um gráfico
      deve; mas cinco telas imprimem esses números como texto pequeno. Daí
      `--protein-text`, `--carbs-text` e `--fat-text`, a mesma separação que
      `--accent-text` já fazia — só a claridade muda, hue e croma continuam
      idênticos. Nove duplas novas no `tokens.test.ts` fecham a lacuna.
- [x] **Estados visualmente distinguíveis.** Componente `Notice` com quatro
      tons, substituindo a receita da caixa de alerta escrita à mão em **19
      lugares, todos vermelhos** — o app só sabia dizer uma coisa. Cada tom
      leva ícone, porque cor sozinha falha para quem não separa vermelho de
      âmbar e falha para todo mundo no sol segurando o celular entre séries.
      O `role` vem do tom e não do call site: `alert` interrompe leitor de tela,
      `status` espera a vez — nota de rodapé não grita.
- [x] **Estourar meta virou âmbar, não vermelho.** Era o mesmo `danger` de
      "não consegui ler seus dados". Comer 30 g de carboidrato além da meta
      merece ser notado e não é falha; vermelho fazia uma terça-feira normal
      parecer defeito.
- [x] **Advisories do perfil saíram do cinza.** A única mensagem que diz "mudei
      o que você pediu" era renderizada em `bg-muted text-ink-muted`, idêntica
      a uma legenda inerte.
- [x] **Iconografia.** Cada rota já tinha um glifo no cabeçalho; o que faltava
      era eles concordarem. **Dois dos quatro tabs abriam numa tela com outro
      ícone** — Hoje era casa na barra e calendário na página, Diário era talher
      na barra e caderno na página. Ícone que muda entre o toque e a chegada é
      pior que ícone nenhum: gasta a atenção do leitor e depois se contradiz.

      Agora vem tudo de `design-system/icons.ts`. Dois empates desfeitos, com o
      raciocínio registrado lá: **Hoje é calendário** (a tela se chama Hoje e a
      marca no topo já leva ao início) e **Diário é talher** (as duas coisas são
      verdade, e o desempate foi para o glifo que o app já usava três vezes).

      A folha "Mais" ganhou os quatro ícones que não tinha — era o único lugar
      onde alguém está *procurando* uma tela, e o único sem os glifos. O cartão
      de Treino no Hoje era o único dos quatro sem um.

      Fora de escopo: **a navegação do desktop segue só texto.** Oito links num
      cabeçalho lêem bem, e o item pede ícone para reconhecer, não para encher.
- [ ] **Nada de valor solto no componente.** Cor, tipografia, radius, sombra e
      espaçamento centralizados em token. As doze superfícies e os dois botões
      primários escritos à mão saíram; o que resta são os controles — input,
      chip e botão de ícone repetem a mesma receita de borda em cerca de quinze
      arquivos.

      Dois saíram desde então: o **controle de Filtros**, que Alimentos e
      Exercícios implementavam em separado, e o botão de ícone, que ganhou
      regra única na Sprint 2.

      **O raio do botão contra o do campo estava listado aqui como decisão em
      aberto — foi resolvido na Sprint 1.** Os dois leem `--corner-md`. A
      direção escolhida foi a que a sprint pedia: arredondar mais, com o botão
      indo de 12 para 18px no celular.

### P3 — Consistência

- [ ] **Uma linguagem só entre desktop e mobile.** A barra inferior fica; ganha a
      identidade da V1. No desktop, navegação reconhecível e com hierarquia.
- [ ] **Mobile não paga a conta do desktop.** Alvo de toque, legibilidade,
      pouco esforço visual — o app é usado durante a refeição e durante o treino.
- [ ] **Alimentos parece planilha.** A lista pode continuar lista; a tela precisa
      parecer app de alimentação. (Ver a decisão tabela-vs-cartão mais abaixo: a
      forma foi escolhida por causa do dado, e continua valendo. O que muda aqui
      é o acabamento — hierarquia, agrupamento, busca, filtro, estado.)

      **Busca e filtro saíram na Sprint 3B** — chips recolhidos, contagem viva
      na folha, contador no botão. Faltam hierarquia, agrupamento e estado.
- [ ] **Exercícios:** o filtro foi apontado como um dos melhores componentes
      atuais. Preservar a ideia — chips, categorias, modal, badges — e trazer
      para a mesma linguagem. O controle que **abre** o filtro já veio para a
      receita compartilhada na Sprint 2; os chips e o modal continuam como
      estavam, de propósito.
- [ ] **Evolução:** os dados ficam, o tratamento muda. Progresso é conquista, não
      tabela de métricas.
- [x] **Passar em todas as rotas** com dado de verdade no banco — perfil, cinco
      pesagens, dieta de três refeições, diário do dia, treino de três
      exercícios e uma sessão concluída, tudo semeado pelos formulários do
      próprio app. Três defeitos que só existem com dado dentro:

      1. **`72.5 kg` com ponto** no resumo da sessão, e mais nove superfícies
         chamando `toLocaleString("pt-BR")` direto — separador certo, mas
         pulando o travessão que `formatDecimal` põe no lugar de `NaN`. As duas
         coisas estão listadas como entregues aqui em cima e nenhuma tinha
         teste. Agora `core/format/number-format.test.ts` varre o código e
         falha apontando arquivo e linha.
      2. **135px de buraco no Hoje** entre Treino e Progresso. Os dois eram
         filhos diretos do grid, então a altura vinha das linhas que a coluna
         da esquerda definia — enquanto todo o resto da tela usa 12px.
      3. **Os dois cartões do Hoje se tocavam no celular.** O espaçamento era
         `lg:space-y-3`, e conferido na folha compilada essa regra vive dentro
         de `@media (min-width:64rem)`: abaixo disso não havia regra nenhuma.
         Num app cuja premissa é o celular, na tela que ele abre primeiro.

      Conferido e **não** é defeito: campo de data e hora saem em `MM/DD` e
      `AM/PM` neste navegador porque controle nativo segue o locale do
      navegador (`en-US` aqui), não o `lang` da página — o valor gravado é
      `2026-08-12`. E as miniaturas de exercício carregam (`falhas: 0`); elas
      parecem vazias no tema claro porque são fotos sobre fundo branco.
- [ ] Preservar o que a V2 já corrigiu da V1: 404 com identidade própria,
      skeleton neutro, tema persistente, sem navegação redundante, componente
      reutilizável.

### P4 — Polimento

- [x] **Série concluída.** O toque mais repetido do app, dado de pé e sem olhar
      com atenção — ali o retorno é funcional, não enfeite. O check assenta com
      leve ultrapassagem em 220 ms.

      **Atrelado ao toque, nunca ao estado.** Uma animação ligada a
      `isCompleted` dispararia também na montagem, e reabrir um treino de 24
      séries faria 24 checks pularem juntos — a diferença entre um app que
      reconhece você e um que te parabeniza por rolar a tela. O invariante tem
      teste próprio.
- [ ] **Microinteração no resto:** alimento registrado, treino concluído, meta
      atingida, peso registrado. Os três primeiros já têm toast; o que falta é
      o momento da meta batida.
- [ ] Estados vazios no padrão da V1: ícone + mensagem clara + CTA relevante.

### As cinco sprints implementadas

12 a 14/08/2026, depois que a marca chegou. Sprints 1 e 2 estão no GitHub; **3 a
5 ficam em commits locais até a trilha ser validada** — decisão tomada, não
esquecimento.

- **Sprint 1 — raio e área de toque.** O raio passou a expressar **papel** e não
  tamanho: inline, controle, contêiner, marcador. Eram seis valores sem regra
  nenhuma, e cinco apareciam na mesma tela a 388px. Na prática mudou uma coisa —
  **o botão adotou o raio do campo**, 12 → 18. `--radius-xl` deixou de ser
  mapeado de propósito, para que um `rounded-xl` esquecido fique errado na hora
  em vez de funcionar quieto e reintroduzir um quinto vocabulário. Os 183 alvos
  pequenos da auditoria eram um controle só repetido, a estrela de favoritar: o
  desenho fica em 32px e a área cresce por pseudo-elemento, fora do layout —
  crescer a estrela cresceria a linha, e a densidade é o que torna 183
  exercícios navegáveis.
- **Sprint 2 — a assinatura.** O anel ganhou o degradê da marca e é o único
  lugar do produto que tem um; **estouro segue âmbar chapado**, porque vestir um
  aviso com a assinatura seria mentir. O botão de ícone voltou a ser controle: a
  Sprint 1 o tinha feito círculo, e círculo é fechado e estático onde a marca é
  fita aberta e direcional. Tipografia: só título de tela, só tracking e peso —
  o H1 media −0,84px, que é convenção de neo-grotesca e o oposto do wordmark. E
  o `9/9` virou dois pixels na borda da barra fixa, sem trilho atrás: não é
  componente, é linha de percurso, e não pode competir com o anel.
- **Sprint 3 — composição do Hoje.** O anel saiu da moldura compartilhada. Era o
  elemento mais proprietário do produto dentro da mesma caixa, no mesmo raio,
  com o mesmo cabeçalho dos três cartões abaixo — que é exatamente como uma
  assinatura lê como widget. As macros desceram, Refeições, Treino e Progresso
  viraram seções abertas, e o agrupamento passou a vir do espaço: as bordas
  estruturais da Home caíram de 6 para 3. Na **3B**, o anel ganhou estado vazio
  — tracejado no trilho, nunca no progresso — e os filtros de Alimentos foram
  recolhidos: abertos custavam ~200px em toda visita e empurravam a tabela para
  444px no celular; medido depois, 240px.
- **Sprint 4 — Treinos abre na ação.** A tela levava 336px até o primeiro
  treino, 80% da viewport, com um subtítulo reafirmando o título para quem tinha
  acabado de tocar numa aba escrita Treinos. Ficou em 160px sem sessão aberta,
  272px com uma. O espaçamento é desigual de propósito: 12px antes do formulário
  e 28px depois dizem quais dois blocos formam um momento, sem desenhar borda.
  **A composição da Home não virou template** — o que atravessou foi a gramática,
  não o layout.
- **Sprint 5 — trilha de execuções. Entregue e não aprovada.** Cada rotina passou
  a carregar as últimas oito semanas com uma marca por sessão concluída, **na
  posição do tempo real**: com marcas equidistantes, três sessões em dez dias e
  três espalhadas em dois meses desenhariam a mesma coisa, e a tela voltaria a
  mostrar contagem em vez de cadência. Nenhum dado novo — `Session.routineId`
  liga sessão a rotina desde que sessões existem. Só a marca mais recente leva o
  esmeralda.

#### Composição do Hoje em blocos — 14/08/2026

Pedida diretamente, e **não é a Sprint 6**: a trilha de execuções continua
intocada e continua não validada. Escopo fechado no Hoje.

As quatro seções sem contorno viraram **cinco blocos num grid** — calorias,
macros, refeições, treino, progresso — todos com o mesmo raio, o mesmo padding
e a mesma borda. O ranking sai da geometria: o anel é a maior coisa da tela e a
única forma que o app não desenha em nenhum outro lugar, e é isso que o mantém
como assinatura. Vesti-lo diferente dos vizinhos seria hierarquia por
decoração.

**Isto reverte parte da Sprint 3A**, que tirou as bordas de propósito. O
argumento de lá continua verdadeiro — o anel dentro da mesma caixa dos outros
lê como widget — e a resposta agora é outra: todos ganham caixa, e o que
distingue é o conteúdo. Medido no antes: com as seções soltas, Treino tinha
**52px contra 194 de Refeições**, lado a lado na mesma linha. Duas metades do
dia com essa diferença de peso não estavam dizendo nada verdadeiro. Agora medem
244 e 244.

Custo registrado: a página cresceu de **849px para 1209px de altura no
celular** — cinco blocos com padding próprio ocupam mais que quatro seções sem
contorno. Foi contido em 139px ao manter as macros em três colunas no celular e
empilhá-las só a partir de `lg`, que é onde elas precisam de altura para ficar
ao lado do anel. Abaixo disso não há nada para equilibrar, e empilhar custava
altura em troca de nada.

#### A trilha está em validação, não em refinamento

Ela custou **25 a 41px por cartão** (76 → 101–117) numa tela cujas Sprints 3 e 4
existiram justamente para reduzir a distância até a ação. E o caso que
justificaria esse preço — várias execuções espaçadas ao longo de semanas —
**nunca foi visto com dado real**: o banco de teste tem uma rotina com uma
execução. Sete testes cobrem a semântica das marcas e **nenhum deles responde se
alguém decide melhor por causa delas**. Teste verde prova correção técnica, não
valor de produto.

**Não propagar para Dietas, Alimentos, Diário ou Perfil. Não compactar, não criar
prop de densidade, não abrir sprint de refinamento em cima dela.** Com histórico
real acumulado, três perguntas:

1. Com 3–5 execuções **próximas**, a frequência é percebida na hora?
2. Com 3–5 execuções **espaçadas**, a diferença de cadência fica óbvia?
3. Rotina nunca executada ao lado de uma com histórico — a trilha **muda a
   decisão**, ou é informação decorativa?

Três sins → trajetória temporal vira linguagem do produto e vale generalizar,
com cada tela mostrando a dimensão temporal do *seu* dado — não todas ganhando
trilha. Menos que isso → cortar ou simplificar sem apego.

### Dependência e lacunas conhecidas

- **A logo não existe.** O pedido cita "o novo símbolo do LaCalle Life quando
  disponível", para header, mobile, favicon, loading e estado vazio. É o mesmo
  buraco do item _Identidade_ mais abaixo, e continua sendo o único bloqueio
  desta sprint.
- **"Configurações" e "Ajuda" não são rotas da V2.** Aparecem na lista de telas
  a revisar porque existiam na V1. Criar rota é escopo funcional, não visual —
  fica fora até haver decisão.

### O que não muda

Funcionalidade, dado, rota, regra de negócio, cálculo nutricional, lógica de
treino, persistência e modelo de dados. Nada de simplificar recurso para
facilitar o redesign. **A sprint é visual.**

### Antes de dizer pronto

Além do `npm run verify` e do `npm run build` de sempre: conferir as rotas
principais nos dois temas, no celular e no desktop, procurando especificamente
por verde excessivo, contraste insuficiente, número parecendo código, cartão sem
hierarquia, tela vazia demais e componente que destoa do resto.

A pergunta de controle, antes de cada componente: **"isso pertence a um app
moderno de saúde, nutrição e treino?"** Se a resposta for "parece SaaS",
"parece ferramenta de desenvolvedor" ou "parece terminal", refazer.

---

## Roadmap

### 1. Refinamentos restantes de `/exercicios`

Levantados na auditoria de UX. O detalhe do exercício saiu daqui e foi
entregue. **Os quatro abaixo foram trazidos para o bloco atual em
30/09/2026, como item 10** (pedido do Pedro); a lista fica aqui só como origem:

- Navegação por grupo muscular na primeira dobra
- Agrupar os 19 chips de músculo em 6 regiões
- Reduzir o ruído da linha (três tags por linha)
- Recentes e mais usados

### 2. Cobertura de fotos

**25 exercícios sem imagem**, de 78 originais. A segunda passagem no
`free-exercise-db` fechou 47 e o `wger` fechou 6.

As duas fontes livres estão esgotadas. Para os 25 restantes existem três
caminhos, e a escolha é de produto:

1. **Deixar sem foto.** O modelo trata isso como estado legítimo e a tela de
   detalhe funciona sem imagem. Custo zero, lacuna permanente.
2. **Permitir que uma foto sirva a mais de uma entrada** quando o movimento é
   o mesmo e só o equipamento muda — leg press horizontal usando a foto do
   45°, elevação pélvica na máquina usando a da barra. Fecharia cerca de 12.
   Custo: a foto mostra um equipamento diferente do que o nome promete.
3. **Fotografar ou ilustrar sob encomenda.** Fecha tudo, com custo real.

Gerar por IA está fora: contradiz a regra fundadora do projeto.

### 3. Fotos de progresso

A metade da evolução corporal que ficou de fora. Exige infraestrutura que
ainda não existe: redimensionar a imagem antes de guardar (uma foto de celular
tem 4 MB, e uma por semana enche o IndexedDB em um ano) e um store separado,
para que ler um peso não arraste blobs junto.

### 4. Fibra rastreável

Hoje o perfil calcula uma meta de fibra (14 g por 1000 kcal) que o app não tem
como conferir: **nenhum dos 216 alimentos carrega fibra**. A tela passou a
dizer isso em voz alta — é referência para ler no rótulo, não meta acompanhada
— porque um número ao lado de proteína, carboidrato e gordura promete uma
medição que nunca chega.

Fechar de verdade exige fibra na fonte, e a fonte é o problema: inventar valor
para 216 alimentos contraria a regra de omitir na dúvida. O caminho realista é
uma tabela que já traga o dado (a TACO traz) e uma migração que acrescente o
campo, com `null` para o que não for encontrado.

Meia solução é pior que nenhuma: somar só os alimentos que tiverem fibra
mostraria "12 g de 31" para quem comeu 25 — um número errado com cara de certo.

### 5. Sincronização

A camada de repositório foi desenhada para isto desde o primeiro commit:
`updatedAt` em toda entidade, ids gerados no cliente, e a raiz de composição
como único ponto que sabe qual implementação está por trás de cada interface.
Trocar local por remoto é editar `composition/`.

Exigirá tombstones para deleção propagar — decisão adiada de propósito, e que
muda implementações de adapter, nunca portas nem UI.

**Sprint de arquitetura entregue em 24/08/2026, ainda sem código** — ver
`docs/arquitetura-sincronizacao.md`. Mapeou as oito entidades, separou
catálogo de foods/exercises (dado de referência, nunca por usuário) dos
favoritos e customizados (dado real de usuário), e resolveu a pergunta
central por família de entidade — `BodyEntry` e `Profile` sempre em
conflito visível (nunca last-write-wins silencioso, mesmo sendo "só um
número"), `FoodLog` com merge estruturado por `Meal.id` como única
exceção, `Session` em progresso não sincroniza até `finishedAt`.

**As seis perguntas de produto foram fechadas no mesmo dia** (§17 do
documento) e o schema completo do Postgres/Supabase está desenhado (§18):
DDL de todas as tabelas, RLS sem política de `DELETE` (tombstone via
`deleted_at`, apagar de verdade só por `service_role`), trigger de
`server_updated_at` para nunca confiar no relógio do cliente, e a função
RPC que faz o equivalente ao `putIfVersionMatches` local contra o Postgres.

**Revisão adversarial do schema, mesmo dia (§19):** achado P0 real —
RLS de `UPDATE` sozinho não impunha o controle de versão, então qualquer
chamada direta na tabela (bug de sync, ou API do Supabase usada fora do
caminho certo) reintroduzia o last-write-wins silencioso que a arquitetura
inteira existe para evitar. Corrigido revogando `INSERT`/`UPDATE` direto de
`authenticated` e forçando toda escrita por funções `security definer` —
que por sua vez exigiu fixar `search_path` e nunca aceitar `user_id` como
parâmetro, para não abrir a porta clássica de escalonamento de privilégio
que uma função `definer` mal escrita costuma abrir. Também fechou o
mecanismo de apagamento (antes só a UI estava descrita, não a escrita —
agora `delete_*` usa o mesmo guarda de versão) e precisou a mecânica do
merge de `FoodLog` (diff estrutural por `Meal.id`, não por timestamp — a
entidade `Meal` não tem `updatedAt` próprio). Ficou registrada como
recomendação obrigatória para a Sprint de Sync, não do schema: todo
registro que chega por `pull` do Postgres precisa passar pelos mesmos
schemas Zod que já validam um backup importado, antes de tocar o IndexedDB
local — `jsonb` não valida forma nenhuma sozinho.

**Pedro aprovou a direção em 24/08/2026 e pediu duas coisas antes de liberar
a migration de verdade** (§19.10/§19.11 do documento): fechar a ordenação
de `FoodLog` depois do merge, e atacar as funções `save_*`/`delete_*` na
prática — não só reler o SQL. Ordenação fechada: por `Meal.time`, empate
desempatado por `Meal.id` — a recomendação original ("ordem em que
apareceram localmente") não sobreviveu à segunda olhada, porque não é
determinística entre dois dispositivos executando o mesmo merge cada um do
seu lado. Ataque nos oito cenários pedidos (usuário A tentando ler/escrever/
apagar dado de B, alterar `updated_at`, manipular `user_id`, chamar sem
autenticação, versão antiga/futura, IDs aleatórios): todos corretamente
rejeitados pela versão já corrigida. A tentativa de ataque real, e não a
leitura do SQL, ainda achou mais um problema: `search_path` incluía
`pg_temp`, o próprio vetor de sequestro que a regra existia para evitar —
só não era explorável nesta versão porque toda referência de tabela já
estava qualificada por extenso, o que é sorte de estilo, não desenho.
Corrigido para `search_path = public` sozinho.

**Auth pode começar agora**, isolado, sem tocar em nenhuma tabela de
domínio — decisão do Pedro, escopo deliberadamente pequeno (cadastro,
login, logout, sessão persistente, refresh, confirmação de e-mail,
recuperação de senha, `user.id` disponível). Zero migração, zero outbox,
zero sync engine, zero alteração no IndexedDB nesta sprint.

**Sprint 1 — Auth isolado, entregue em 24/08/2026.** Supabase Auth via
`@supabase/ssr`, atrás de `src/features/auth` (mesma fronteira de
repositório de toda outra feature). Cadastro, login, logout, sessão
persistente por cookie, refresh de token em `middleware.ts`, confirmação
de e-mail e recuperação de senha — zero tabela de domínio tocada. Projeto
Supabase real: `rtvscxcfwfsamxatkwit` ("Lacalle-Life"), criado no mesmo
dia.

Achado real só na validação manual no navegador: os quatro formulários
espalhavam `{...control}` do render-prop de `Field` direto no `<input>`,
vazando `describedBy` como atributo DOM inválido — três "issues" no overlay
de dev do Next.js. Nem typecheck, nem lint, nem os 1132 testes existentes
pegaram; só apareceu olhando a tela de verdade. Corrigido nos quatro
formulários, mesma forma que `profile-form.tsx` já usava.

Testado contra o Supabase real: cadastro chega ao servidor (CSP
`connect-src` liberando o domínio), login com credencial errada devolve o
erro real do Supabase mapeado pro português. **O teste de sucesso completo
ponta a ponta (cadastro confirmado → login → sessão sobrevive a refresh →
logout) ficou bloqueado pelo limite de envio de e-mail do SMTP embutido do
plano free do Supabase** — não é bug, é limitação operacional conhecida do
serviço de teste; precisa de SMTP customizado no projeto ou esperar a
janela de rate limit resetar para fechar essa validação manual.

1143 testes (1132 + 11 novos), typecheck/lint/build limpos, zero regressão.

**Revisão de segurança automatizada, mesmo dia:** open redirect em
`/auth/callback?next=` — o parâmetro ia sem validação para
`NextResponse.redirect`. A concatenação com `origin` já bloqueava os casos
óbvios, mas não vale contar com isso: `//evil.com` e `/\evil.com` dependem
de como o navegador normaliza. Fechado com `safeNextPath()` (só aceita
caminho local de uma barra só); provado revertendo a validação e vendo 4
dos 5 testos caírem nos casos maliciosos, restaurando depois.

**Teste obrigatório de vazamento de sessão entre contas, pedido pelo
Pedro:** conta A loga, refresh (remount do zero), `user.id = A`; desloga;
conta B loga, refresh, `user.id = B` — nunca as duas juntas. Não substitui
a validação manual contra o Supabase real; prova a metade que dá para
provar sem rede. 1150 testes no total agora.

**Fluxo E2E real fechado em 25/08/2026 — Status: 🟢 READY FOR SCHEMA.**
Rate limit resetou; e-mail de teste real (`pedrofunesctt@gmail.com`, com
autorização de quem o controla) usado para o fluxo completo contra o
Supabase de produção — não simulado:

1. Cadastro real em `/cadastro` → "Confira seu e-mail" ✅
2. E-mail de confirmação chegou de verdade, link clicado por quem controla
   a caixa de entrada ✅
3. Callback trocou o código por sessão e voltou pro LaCalle Life já logado
   (`exchangeCodeForSession`, sem passo de login manual — o próprio clique
   no e-mail já autentica) ✅
4. `/conta` mostrando `user.id` real (`835d04ec-dae6-48a2-aa55-b940d1555145`) ✅
5. Fechar a aba e abrir uma nova, direto em `/conta`: sessão persistiu por
   cookie sem pedir login de novo ✅
6. Logout: redirecionou para `/entrar` ✅
7. `/conta` depois do logout: volta a mostrar "Você não está logado" ✅
8. Confirmado direto no banco: `auth.users.email_confirmed_at` e
   `last_sign_in_at` preenchidos com timestamps reais de 25/08/2026 ✅

**Uma diferença do roteiro original, registrada por transparência:** o
décimo passo pedido era "confirmar que rota protegida não está mais
acessível". Nesta sprint **nenhuma rota de domínio é protegida por
auth** — foi decisão explícita desde o início ("o resto do app continua
funcionando 100% como hoje, sem depender de login"). O que existe e foi
confirmado é `/conta` refletindo corretamente o estado de sessão nos dois
sentidos. Proteger rota é decisão de uma sprint futura, quando sync de
domínio existir de verdade.

Com isso, a Sprint 1 está fechada.

### 6. Visão ADM: LaCalle Life Pro (B2B / B2B2C)

**Registrado em 28/09/2026, não iniciado.** Especificação completa em
[`docs/visao-adm-pro.md`](visao-adm-pro.md).

Área profissional para nutricionistas (treinadores depois): painel, gestão
de pacientes por convite, criação e publicação de planos alimentares com
histórico de versões, leitura do diário e da evolução autorizados, biblioteca
de modelos. O B2C continua funcionando como hoje; ninguém é obrigado a ter
profissional.

Pontos que pesam antes de qualquer código:

- **Começa por auditoria, não por implementação.** A Etapa 1 da spec é um
  diagnóstico da arquitetura atual (sync, RLS, JSONB, auth) e um plano; nada
  de migração antes disso.
- **Mexe no data layer**, que o `CLAUDE.md` pede para não tocar fora de
  necessidade real. Aqui a necessidade é real: vínculo
  profissional/paciente com revogação é um modelo de acesso novo, e as
  políticas RLS precisam ser revistas contra ele.
- **Conflita com a fase de estabilização** (decidida em 25/09/2026). Entrar
  nesta frente é decisão de quando, não só de como.
- **Nada de IA** na prescrição, coerente com a restrição fundadora.

Fora do escopo desta primeira versão: sistema completo de treinadores,
cobrança, marketplace, chat, IA, marca por clínica, app separado.

**Protótipo visual aprovado como base, 28/09/2026:**
https://claude.ai/artifact/EYmbA15HyK99R7NrbiZxUA (versão 3). Navegável, com
dados de exemplo; nada disso está no código. A implementação parte dele:

- A anatomia é a dos componentes reais (`Sidebar`, `PageHeader`, `Card`,
  `Badge`, `Metric`, `Button`), não um visual novo. A primeira versão, com
  visual próprio, foi rejeitada por "cara de IA".
- Tabelas com uma grade só: no editor, todas as refeições numa tabela, com
  subtotal e total nas mesmas colunas de kcal e macros.
- Largura e escala em tela larga (até 1600px, escala maior a partir de
  1440px) registradas em `docs/brandbook.md`, seção "Largura e escala em tela
  larga: área profissional". Só para a área profissional.
- Telas cobertas: Visão geral, Pacientes (com convite), perfil do paciente
  (Plano, Diário, Evolução, Histórico), editor de plano com versão em
  rascunho, Dietas, Evolução, Biblioteca. Configurações ficou fora da
  navegação.

### 7. Sete novidades vindas de referência de mercado: aprovadas para implementar (29/09/2026)

**Aprovadas pelo Pedro em 29/09/2026, as sete**, depois de ver os protótipos:
https://claude.ai/artifact/79uasBrqa6rpXmiBk7Xxeg. Cada protótipo copia os
componentes reais da tela que muda; a implementação parte dele.

| # | Novidade | Esforço | Decisão tomada no protótipo |
| --- | --- | --- | --- |
| 7.1 | ✅ Série concluída em verde suave, **entregue em 29/09/2026** | P | **Nos dois temas**, não só no escuro (pedido do Pedro ao ver o protótipo). Botão de concluir feito passa de `bg-accent` a `accent-surface` + `accent-text`; o próximo passo e a ação principal continuam em verde cheio. Revisar as outras telas com preenchimento verde repetido pela mesma regra. **Entregue:** só a linha de série (`performed-set-row.tsx`); a borda `border-accent` ficou sólida porque, no claro, `accent-surface` quase some sobre o `bg-muted` da linha feita. Teste de navegador mede a cor resolvida nos dois temas. O check da refeição no Diário e a landing continuam com verde cheio, ainda não revisados. |
| 7.2 | ✅ Recentes no seletor de alimentos, **entregue em 30/09/2026** | M | Seção acima da lista quando a busca está vazia, com a quantidade usada da última vez. Fonte: registros do diário. **Entregue:** `recentFoods` (`diet/services`) percorre os últimos 60 dias, só refeições comidas (`eatenMeals`), primeira ocorrência de cada alimento do catálogo, até 6, com "Ontem · Almoço · 150 g". `useRecentFoods` lê o diário; a página `/alimentos/selecionar` junta diário e seletor (`diet` importa `foods`, nunca o contrário). O `FoodPicker` mostra "Recentes" com busca vazia e sem filtro, só o que ainda existe no catálogo, com kcal e macros na quantidade da última vez; tocar abre a quantidade já nas gramas da última vez. Linha de resultado extraída para `PickRow`, sem duplicar. |
| 7.3 | ✅ Igual a ontem, **entregue em 30/09/2026** | M | Faixa dentro da refeição vazia; "Copiar" traz alimentos e gramas; toast com Desfazer. Refeição equivalente = mesmo nome no dia anterior. Some se ontem ela estava vazia. **Entregue:** `yesterday-meal.ts` (mesmo nome ignorando maiúsculas e espaços, só refeição comida e com itens; cópias com ids novos e mesmas gramas; desfazer tira só o copiado), `useYesterdayLog(day)`, faixa opcional `fromYesterday` no `MealCard` (só o Diário passa; a dieta não muda) e aviso "Almoço copiado de ontem." com Desfazer. `shiftDay` foi movida de `food-log-screen.tsx` para `core/format/day.ts`. Teste de ponta a ponta com repositório e aviso de verdade; teste de navegador da faixa em 6 larguras × 3 densidades (a primeira versão cortava o título em 320px Confortável e escondia as kcal). |
| 7.4 | ✅ Histórico por exercício, **entregue em 30/09/2026** | M | Seção "Seu histórico" no detalhe do exercício: melhor série, 1RM estimado, linha da carga da melhor série por treino, últimos treinos. Vazio quando não há dado. **Entregue:** `exerciseHistory` em `history.ts` (treinos finalizados do exercício, só séries concluídas, melhor série por treino ou `null` sem carga); seção `ExerciseHistory` no detalhe: série mais pesada e 1RM do `personalRecords`, gráfico com 2+ treinos com carga (até 12), 3 últimos treinos e "Ver os outros N", vazio sem treino, sem gráfico nem 1RM para exercício sem carga. O `TrendChart` foi **movido** de `features/body` para `design-system/components` (a tela de peso importa de lá; chave do ponto não depende só do dia). `/exercicios` passou a usar `WorkoutDataProvider` para o detalhe alcançar os treinos. **Ajuste do Pedro (30/09/2026):** o histórico vem antes da ficha (foto, histórico, ficha), e a série passou a ser escrita **peso × reps** ("60 × 8", "60×8") também nos Recordes da Evolução e no resumo do treino, para o app falar de um jeito só. |
| 7.5 | ✅ Dia de descanso, **entregue em 30/09/2026** | M (saiu G) | Botão "Hoje é descanso" no card de treino vazio do Hoje; desfazível. Só "descanso" por enquanto (doença e lesão ficam para depois, se fizer falta). **Entregue:** Pedro escolheu sincronizado. Coleção nova no molde da água: tabela `rest_days` no Supabase (migração 0032, aplicada e testada em produção dentro de uma transação desfeita), store `restDays` no IndexedDB (versão 10), `SyncingRestDayRepository`, `runRestDaySync` na abertura do app, backup e restauração. Existir é a marca; desfazer apaga. **Conflito não trava:** push e depois pull, e quando os aparelhos discordam vale o servidor (o descanso não tem tela de conflito). Treino feito no dia vence a marca. Perfil e Diário foram descartados como lugar: o perfil só existe com metas e "limpar metas" apagaria os descansos; um Diário criado só para isso pareceria "dia começado". |
| 7.6 | ✅ Tipo de série, **entregue em 30/09/2026** | G | Menu da série ganha Normal, Aquecimento, Drop set, Até a falha; o número vira A, D, F. **Aquecimento sai do volume e dos recordes: confirmado pelo Pedro em 30/09/2026.** **Entregue:** campo opcional `kind` na série executada (`warmup`, `drop`, `failure`); normal é a ausência do campo, e voltar a normal apaga o campo, para treino sem série marcada continuar no formato que versões antigas leem (o esquema da sincronização e do backup é estrito, e uma versão antiga pula o treino que não reconhece). Sem migração: o treino já sobe como JSON. Aquecimento fica fora do volume do treino, do volume e da contagem de séries da Evolução, dos recordes, do aviso de recorde e da melhor série do histórico; continua na lista do histórico e no progresso do treino (3/12 séries). Drop set não dispara a pausa. Tipo na folha de ações que o número da série já abria, com a dica embaixo do nome (ao lado, estourava 118px em 320px Confortável); letra A/D/F em âmbar, azul e vermelho no lugar do número, também no resumo do treino finalizado. |
| 7.7 | ✅ Registro rápido, **entregue em 30/09/2026** | G | Ação no rodapé da refeição; calorias obrigatórias, macros opcionais; item "Avulso" sem catálogo; macro em branco fica em branco no total. **Decisão do Pedro (30/09/2026):** o total soma o que se sabe, marca o macro com "*" e avisa embaixo ("* Sem o carboidrato e a gordura de 1 item avulso."), no card da refeição, no total do Diário e no Hoje. **Entregue:** o avulso é um item de refeição comum com `foodId: null`, `grams: 100` e o total em `per100g`, mais o campo opcional `quick.unknownMacros` (só nos avulsos: o dia sem avulso fica no formato de antes, que versões antigas leem). Com isso nenhuma soma do app mudou de conta; o branco vale 0 na soma e nunca aparece como 0: "—" na linha, "*" no total. Folha `QuickLogDialog` para registrar e editar (mesmo id, `replaceItem`); "Registro rápido" só no Diário; a linha mostra a etiqueta "Avulso" no lugar das gramas, e o nome abre a edição. Fora de Recentes (já ignorava `foodId: null`); "Transformar em 1 alimento" não é oferecido com avulso (gramas inventadas). Esquema do backup e da sincronização aceita `quick` e recusa macro desconhecido. |

**Ordem sugerida:** 7.1 (menor e mais visível), depois 7.2 e 7.3 (atrito
diário no Diário), 7.4, 7.5, e por último 7.6 e 7.7, que mudam dado salvo e
sincronizado. Um commit por novidade, cada uma fechando o `verify` antes da
próxima, como pede a fase de estabilização.

Origem e conferência das lacunas no código, abaixo.

#### Pesquisa de origem (Manus, 29/09/2026)

Pesquisa feita pelo Manus sobre quatro apps do Mobbin (MyFitnessPal, Lifesum,
Hevy, Gentler Streak), com as lacunas **conferidas contra o código do `main`
em 29/09/2026**. A primeira rodada dele leu a auditoria de UI de 26/09 como
estado atual (o herói do Hoje já tinha sido corrigido em `f5c0884`) e chamou a
cor de "esmeralda", que saiu em 11/09. A segunda rodada, abaixo, foi pedida
contra o código.

| Candidato | Referência | Confirmado no código | Onde entraria | Esforço |
| --- | --- | --- | --- | --- |
| Distribuição do verde no tema escuro | todos | O escuro é `#0B0D0F` com Verdant `#4FBE86`; os degraus neutros já existem em `tokens.css`. No protótipo do Life Pro, a "cara de IA" sumiu no tema claro. | Uso do acento nas telas, sem trocar a cor da marca nem os tokens | M |
| Alimentos recentes no seletor | Lifesum | Não existe nada de recentes em `features/foods` | `food-picker.tsx` | M |
| Trazer o dia anterior para o diário | Lifesum | Não existe. Parente: dia vazio já oferece começar a partir de uma dieta (`EmptyDay`), e `copyItemToMeal` copia dentro do mesmo dia | `food-log-screen.tsx` | M |
| Histórico e gráfico por exercício | Hevy | Não existe. `exercise-detail.tsx` mostra só catálogo; "última vez" existe só dentro da sessão | `exercise-detail.tsx`, `services/history.ts` | M |
| Dia de descanso marcado, neutro | Gentler Streak | Não existe | `today-workout.tsx`, mais um estado diário persistido | M |
| Tipo de série (aquecimento, drop, falha) | Hevy | Não existe. `PerformedSet` não tem campo de tipo | `types/session.ts`, `performed-set-row.tsx` | G |
| Registro avulso de calorias | MyFitnessPal, Lifesum | Não existe | `types/food-log.ts`, modelo do diário | G |

Descartados na própria pesquisa, coerentes com as restrições do projeto:
reconhecimento por foto ou voz, score, streak, feed social, prontidão baseada
em sono ou sinais vitais.

**Critérios de escopo** (do PDF de evidências visuais do Manus, 29/09/2026,
guardado fora do repositório em `Downloads/Lacalle-Life-evidencias-visuais.pdf`):

- **Recentes:** separado de Favoritos; só o que a pessoa registrou.
- **Igual a ontem:** cópia explícita da refeição equivalente para a data
  selecionada; preserva gramas, deixa editar, nunca grava alimento no
  catálogo. Referência visual: Lifesum, "Same as yesterday?" e "Recent" na
  tela de refeição.
- **Histórico por exercício:** por movimento, com as medidas que já existem
  (reps, peso, duração); sem dado mostra vazio, nunca zero; "última vez" na
  sessão ao vivo continua como está. Referência visual: biblioteca de
  estatísticas por exercício do Hevy.
- **Descanso marcado:** escolha reversível da pessoa; ausência de sessão nunca
  vira descanso automático. O Gentler Streak distingue atividade, doença,
  lesão e pausa, sempre escolhidos por quem usa.
- **Tipo de série:** aparece no menu da série; drop set não inicia pausa
  automática.
- **Tema escuro:** sem trocar `--accent` nem o Verdant; a hierarquia vem dos
  degraus neutros (canvas, surface, elevated, muted) e o acento fica em ação e
  estado. Perdeu urgência em 29/09/2026, quando o claro virou o padrão (ver o
  topo deste documento), mas continua válido para quem escolhe o escuro.

O PDF não tem captura do Lacalle: o Manus tentou subir o app com `pnpm`, e o
projeto usa `npm`.

### 8. Achados no celular do Pedro (29/09/2026)

Relatados em uso real, no iPhone, na noite de 29/09/2026. Cada um passa pelas
6 fases (inspeção, plano, implementação, validação, regressão, relatório)
antes de fechar. A causa abaixo é a da primeira leitura do código, ainda não
confirmada por reprodução.

| # | Achado | Primeira leitura do código | Tipo |
| --- | --- | --- | --- |
| 8.1 | ✅ **Nome do exercício cortado** no card do treino, **entregue em 29/09/2026** ("Pu F..", print do Pedro em 375px) | O cabeçalho do `session-exercise-card.tsx` põe na mesma linha a miniatura (64px), o nome (`line-clamp-2` em `exercise-identity.tsx`) e um bloco `shrink-0` com "0/2" e três botões de 32px separados por 12px (o intervalo que evita toque sobreposto). Sobram ~60px para o nome. `routine-exercise-card.tsx` usa a mesma identidade e deve ter o mesmo problema. **Causa confirmada:** `af9e1ce` (25/09) pôs as setas de ordem sem deixar a linha quebrar. **Entregue:** o cabeçalho do treino quebra abaixo de `sm` como o da rotina; a miniatura encolhe para 48×32 abaixo de 360px (decisão do Pedro, vale para catálogo, rotina e treino); a rotina deixou de mostrar "N séries" embaixo do nome (pedido do Pedro). Teste de navegador: nome inteiro nas 5 larguras × 3 densidades e toque dos botões sem roubo; sem a correção, 14 das 15 falhavam. **Achado fora do escopo, a confirmar:** no print de 320px Confortável o botão de concluir da série parecia cortado na borda direita; o teste de recorte existente passa, então pode ser artefato do print com `zoom`. | Regressão de layout; P0 de uso |
| 8.2 | ✅ **Proibir zoom no app instalado (PWA)**, **entregue em 29/09/2026** | `viewport` em `app/layout.tsx` não limita escala. Duas coisas diferentes: o zoom de pinça (acessibilidade, WCAG 1.4.4, e o iOS ignora `user-scalable=no` no Safari) e o zoom de toque duplo e de foco em campo, que é o que costuma incomodar. O segundo sai com `touch-action: manipulation` e campo em 16px (este já existe, ver `docs/brandbook.md`, divergência 6). **Decidido pelo Pedro em 29/09/2026: só o toque duplo.** A pinça continua. **Entregue:** `* { touch-action: manipulation }` na camada `base` de `globals.css` (em `*` porque `touch-action` não atravessa área com rolagem própria); os `touch-none` das alças e do RPE continuam. Teste de navegador mede o valor resolvido. Falta confirmar no iPhone. | P |
| 8.3 | ✅ **Voltou o erro na seleção do RPE** no celular, **entregue em 29/09/2026, falta confirmar no iPhone** | O RPE já teve três correções (`962f04c`, `65579c0`, `f8ac8cc`), com teste de navegador. Se voltou, ou é caso que o teste não cobre (toque real, arrasto, iOS) ou a correção regrediu. **Precisa de reprodução primeiro:** qual valor, tocando ou arrastando, o que aconteceu. **Reprodução do Pedro:** o quadradinho abre normal; tocar no meio círculo não escolhe nada, e ele não achou ponto que funcionasse. Pediu que a escolha funcione só pela linha. **Investigado com WebKit (motor do Safari), instalado em 29/09/2026:** a conta de posição fecha no Chromium e no WebKit com emulação de celular e toque real; o bug do iPhone **não se reproduziu** fora dele. **Entregue:** a faixa da linha virou um arco invisível por cima do mostrador, e é o navegador quem decide se o dedo acertou; o ângulo vem de `getScreenCTM`. Os testes passaram a tocar no elemento sob o ponto e a esperar a folha terminar de subir (antes disparavam direto no SVG, com a mesma conta do componente, e não pegariam erro nela). | Regressão; investigar |
| 8.4 | ✅ **Contrato de uso** (termos de uso), **entregue em 30/09/2026, com pendências** | Não existe nenhuma página de termos nem de política de privacidade no app. O app tem conta e sincroniza dado de saúde (dieta, peso), então a política de privacidade provavelmente vem junto. **O texto jurídico é do Pedro** (ou de quem ele indicar); o código é a página, o link no rodapé/criação de conta e, se for o caso, o aceite registrado. **Entregue:** a partir dos rascunhos que o Pedro fez com o ChatGPT (30/09/2026), ajustados ao que o app faz de verdade. Três páginas públicas, sem login: `/termos-de-uso`, `/politica-de-privacidade` e `/aviso-de-saude` (componente `LegalDocument`). Resumo do Aviso de Saúde na landing, antes do rodapé; os três links no rodapé. No cadastro, a caixa "Li e aceito os Termos de Uso e a Política de Privacidade", com os links abrindo em outra aba; sem ela o botão fica desabilitado **e** o envio é recusado. Login sem caixa. Correções sobre o rascunho: com conta, os dados vão para o Supabase em São Paulo (não só ficam no aparelho); o app funciona sem conta (aí tudo fica no aparelho); Vercel e Cloudflare Turnstile listados, com processamento fora do Brasil; não há exclusão de conta pela tela (o pedido é pelo canal de contato). Responsável: Pedro Macedo Funes, pessoa física, sem CNPJ (confirmado). **Pendências:** (1) ~~e-mail de contato~~ **resolvido em 30/09/2026:** `lacallepm@gmail.com`, criado pelo Pedro, em `LEGAL_CONTACT_EMAIL` (`legal-document.tsx`); (2) **revisão jurídica** antes de divulgar em escala, sobretudo a base legal para dados de saúde (LGPD art. 11) e a idade mínima, que os rascunhos não definem; (3) o aceite **não é registrado** no servidor (versão e data): fica para quando a revisão pedir, sem tabela nova agora; (4) contas criadas antes desta data não aceitaram nada. | Novo; depende de texto |
| 8.5 | ✅ **Última semana como dica no campo vazio** (padrão do Hevy), **entregue em 29/09/2026** | Hoje o campo vazio mostra `placeholder="—"` (`performed-set-row.tsx`) e a "última vez" aparece só como uma linha de texto acima da grade (`session-exercise-card.tsx`, `lastTime`). Proposta: o placeholder de peso e reps da série N passa a ser o valor da série N da última vez, em tom mais claro. Cuidado: quando há meta planejada ela já aparece embaixo do campo ("60 kg"); dica e meta não podem se confundir. **Entregue** (o Pedro dispensou o protótipo): cada linha recebe a própria série da última vez (`last`), e peso e reps vazios mostram esse valor como placeholder, em `ink-subtle`; sem última vez, "—". Só dica: nada é preenchido. A meta continua embaixo do campo. Cardio (duração) não entrou. | Novo; M |
| 8.6 | ✅ **Zoom automático ao tocar num campo**, **entregue em 29/09/2026, falta confirmar no iPhone** (peso), sempre, no app da tela inicial, densidade Padrão | O iPhone amplia campo com letra abaixo de 16px. O Padrão aplica `zoom: 1.15` na página e o campo compensa com `zoom: 1/1.15`; se o iPhone olhar só o zoom do campo, vê ~13,9px. No WebKit do PC a letra sai 16px; o zoom automático em si não é emulável. **Achado em 29/09/2026 (8.13):** no Padrão a fonte real dos campos da série era 13,9px por causa da regra de zoom fora de camada, a causa clássica desse zoom; corrigida. Não explica o zoom no Compacto, então o `maximum-scale=1` fica. **Teste do Pedro (29/09/2026): no Compacto o zoom continua**, então a hipótese do `zoom` da densidade caiu. O campo de peso (`weight-field.tsx`) usa `text-base` (16px), e no Compacto nada no caminho altera isso: pela regra documentada do iOS ele não deveria ampliar. Causa não identificada; inspecionar o Safari do aparelho exigiria um Mac. **Entregue (decisão do Pedro):** `maximum-scale=1` **só em iOS**, decidido no servidor pelo `user-agent` (`src/app/viewport.ts`, `generateViewport` em `layout.tsx`). No iOS a pinça continua (a Apple ignora a linha para ela); o Android recebe o `viewport` de antes. Conferido no HTML servido pelo build para iPhone e Android. Limite: iPad com iPadOS se apresenta como Mac e não é detectado. Atalho conhecido (`maximum-scale=1`) pode travar a pinça no app instalado, que o Pedro quis manter. | Regressão; investigar |
| 8.7 | ✅ **Seis testes de layout da folha do RPE falham só no WebKit**, **resolvido em 30/09/2026: era a régua, não o app**, na densidade Padrão (UI-03/UI-04 nas 5 larguras e "RPE 8,5 não toca número nem descrição") | Achado ao rodar a suíte do RPE no WebKit em 29/09/2026. Já falhavam antes do 8.3 (conferido com o código anterior). Mais um sinal de que o `zoom` da densidade se comporta diferente no motor do iPhone; pode ter a mesma raiz do 8.6. **Investigado:** rodando a suíte inteira no WebKit apareceram 27 falhas, todas da régua. (1) `scrollWidth - clientWidth`: com o `zoom` da densidade a caixa tem largura fracionária (339,13px de CSS), e o WebKit arredonda `scrollWidth` para cima e `clientWidth` para baixo; nenhum elemento passava da borda e a caixa não rolava. `overflowX` (`src/test/geometry.ts`) passou a descontar 1px, as contas diretas passaram a usar o auxiliar, e a folha do RPE passou a testar rolagem de verdade. (2) Ponteiro do RPE contra a caixa do "8,5": a caixa de texto do WebKit é 0,4px mais alta; o ponteiro entrava 1,2% na área vazia dela, sem encostar no número (print); tolerância de 2%, e os defeitos reais mediam 18% a 43%. Sabotagens provam que as réguas ainda pegam transbordo e cruzamento reais. **Não tem relação com o 8.6.** Novo comando opcional `npm run test:browser:webkit` (`vitest.webkit.config.ts`), fora do `verify` e da CI: 427 de 427 no WebKit. | Investigar |
| 8.8 | ✅ **Percentuais do donut de macros amontoados**, **entregue em 29/09/2026** (resumo do plano no Perfil, print do Pedro) | `macro-donut.tsx` desenha cada percentual **em cima do anel**, no meio da fatia. Em `plan-summary.tsx` o donut tem 64px e o anel ~10px de espessura: "25%" é mais largo que o anel, e duas fatias pequenas vizinhas (proteína 25%, gordura 25%) põem os rótulos a poucos pixels um do outro. Não depende de celular. **Entregue** (decisão do Pedro: fora do anel, em preto): percentuais numa margem em volta do anel, alinhados pelo lado, distância que cresce nas diagonais; cor `fill-ink` (era `fill-white`, de contraste baixo sobre as cores). O donut do Perfil passa de 64 para ~116px de altura. Teste de navegador mede a caixa de cada rótulo em 5 divisões × 2 tamanhos; com o código anterior os 10 casos falham. | Bug visual; P |
| 8.9 | ✅ **Dica da última vez ainda mais clara**, **entregue em 29/09/2026** (refinamento do 8.5, pedido do Pedro em 29/09/2026: "ficou bom, mas acho que podemos deixar mais claro ainda") | A dica já usa `ink-subtle`, o cinza mais claro que ainda mede 4,5:1 como texto. Mais claro que isso fica ilegível e quebra o contraste que o `tokens.test.ts` exige. Caminhos que não dependem de clarear: um marcador ("sem."/ícone de relógio) junto do número, itálico, ou a dica menor que o valor digitado. **Revertido pelo Pedro no mesmo dia: texto normal, sem itálico.** Antes, decisão dele de itálico, entregue: `placeholder:italic` nos campos da série; o valor digitado continua reto. O "—" das séries sem última vez também fica em itálico (mesmo placeholder). Teste de navegador confere o itálico na dica e a ausência dele no valor. | Refinamento; P |
| 8.10 | ✅ **Verde esmeralda nos botões**, **entregue em 30/09/2026** (ex.: "Iniciar treino" no editor de rotina): o Verdant parece escuro demais sobre o branco | **Contraria uma decisão do Brand System V2:** em 11/09/2026 o acento saiu do emerald (`#10B981`) para o Verdant (`#2A9162`), de propósito ("mais pinho, menos menta de wellness"). A splash e o ícone ainda usam o emerald (`ICON_GRADIENT`). Opções: (a) voltar o acento todo para emerald, revertendo a V2; (b) emerald só nos botões, o que cria duas cores de marca e quebra "acento único"; (c) um passo mais claro do Verdant nos botões. Tinta escura sobre emerald mede 7,44:1, então o contraste não é o problema. **Decisão do Pedro em 29/09/2026: opção (c), um Verdant mais claro**, dentro da V2. Próximo passo: um protótipo (Artifact) com tons candidatos lado a lado, na tela do treino e junto do logo verde (8.11), antes de mexer em token. O tom escolhido precisa manter a tinta escura com pelo menos 4,5:1 (`tokens.test.ts`), e o brandbook muda junto. **Entregue:** o Pedro escolheu `#31AA73` no protótipo (https://claude.ai/artifact/XcN4CAVxMfnWzw867XbZ1W) e pediu que **só os botões grandes** mudassem. Token novo `--accent-fill` (`#31AA73`, hover `#2A9162`) usado pelo `Button` primário; o `--accent` (logo, anel de foco, meio círculo, bordas, chips, gráficos, quadrado do play) continua `#2A9162`. Tema escuro sem mudança. Tinta sobre o botão 6,41:1. Registrado em `docs/brandbook.md`. Teste de navegador: botão em `rgb(49, 170, 115)` e acento em `rgb(42, 145, 98)` no claro; no escuro o botão segue o acento. | Decisão de marca |
| 8.11 | ✅ **Logo verde no cabeçalho**, **entregue em 30/09/2026** | O símbolo do cabeçalho (`Signature` em `app-nav.tsx` e na sidebar) é `text-ink`, com só "Life" em verde. O Brand System V2 define a Proposta 01 **em Verdant** para o Life, então isto alinha o app ao brandbook. Mexe em `signature.tsx`, usado também na sidebar e na landing. Se o 8.10 mudar o verde, o logo segue a mesma decisão. **Entregue:** o símbolo da `Signature` passou de `text-ink` para `text-accent` (token, então segue o 8.10); vale no cabeçalho, sidebar e landing. "LaCalle" continua em tinta, "Life" em verde. Teste de navegador: cor resolvida igual ao acento e ≥3:1 contra `surface`, nos dois temas. | Visual; P |
| 8.12 | ✅ **Transição de entrada aparece ao abrir uma aba**, **entregue em 30/09/2026, falta confirmar no iPhone** (deveria aparecer só ao abrir o app) | `BootSplash` fica no layout raiz e aparece "uma vez por carregamento de página". Navegação entre abas não remonta o layout, então quando ela aparece houve um **recarregamento inteiro**: o iPhone recarrega o app que tirou da memória em segundo plano, e a atualização do service worker também pode recarregar. O Finance resolve com uma marca em `sessionStorage` ("no máximo uma vez por sessão"). **Primeiro reproduzir**: descobrir qual recarregamento dispara, antes de escolher a correção. **Investigado:** toda navegação interna é `Link` e nenhum código recarrega a página na troca de aba; o que sobra é o iPhone recarregando o app instalado ao voltar de segundo plano, não reproduzível no PC. **Entregue:** `BootSplashScript` (antes da hidratação, com `nonce`) marca a sessão em `sessionStorage` na abertura e, num recarregamento na mesma sessão, põe `data-splash="skip"` no `<html>`; `globals.css` esconde a transição antes do primeiro paint. A sessão dura até fechar o app de verdade. Testes: o script real em jsdom (abertura, recarregamento, armazenamento bloqueado) e o CSS no navegador (sem a regra, a transição fica visível). Conferido no HTML servido: o script vem antes da transição. | Bug; M |
| 8.13 | ✅ **Número da série desalinhado com peso e reps** (print do Pedro, rotina sem meta), **entregue em 29/09/2026** | **Duas causas.** (1) O número usava `self-center` e centrava no bloco campo + legenda da meta (que ocupa altura mesmo vazia), ~10px abaixo do campo; veio de `b4595c9` (26/09). Agora `h-11 self-start`. (2) **Causa de fundo, aprovada pelo Pedro:** a regra global `input { zoom: 1/ui-scale }` do `tokens.css` estava **fora de camada**, e estilo fora de camada vence qualquer estilo de camada: a correção da grade (`.set-grid input { zoom: 1 }`) nunca teve efeito. No Padrão os campos da série tinham 38px e fonte de 13,9px reais (34px no Confortável), abaixo dos 44px de toque e dos 16px do iOS. A regra foi para `@layer base`; medido depois: 44px e 16px reais nas três densidades, e campo fora da grade continua 16px reais. Teste de navegador: centro do número a ≤1px do centro do campo e campo com 44px, 5 larguras × 3 densidades, com e sem meta; sem a camada, 20 dos 30 casos falham. As 6 falhas do WebKit (8.7) **não** mudaram. | Regressão de layout |
| 8.14 | ✅ **Linha "Última vez" só com a data**, **entregue em 29/09/2026** | Pedido do Pedro: os números já estão na dica de cada campo (8.5). A linha vira "Última vez realizado em 29 de set."; `describeSet` saiu. Consequência: no cardio, a duração da última vez deixou de aparecer (ele não tem dica no campo). | Visual; P |
| 8.15 | ✅ **Campos altos dentro da faixa da série** (print do Pedro: não alinhados com a caixa de borda verde), **entregue em 30/09/2026** | A linha da meta embaixo dos campos (`<Planned>`, `mt-1 h-4`) era desenhada mesmo vazia: numa rotina sem meta sobravam 20px embaixo dos campos. Agora ela só existe quando a série tem alguma meta (peso, reps, RPE ou duração); com meta, nada muda. Teste de navegador: sem meta, centro do campo a ≤1px do centro da faixa, 5 larguras × 3 densidades; sem a correção, os 15 casos falham com 10px. | Visual; P |
| 8.16 | ✅ **"Observações" cortado no rodapé da refeição**, **resolvido em 30/09/2026**, em 320px na densidade Confortável ("Ob") | Achado no print da 7.3, e acontece também sem a faixa "Igual a ontem?": é do rodapé do `MealCard` ("Adicionar alimento" + "Observações"), que já existia assim. Não tratado na 7.3 por ser anterior a ela. **Causa:** o campo tinha `min-w-0 flex-1`, base e mínimo zero, então o `flex-wrap` nunca o descia para a linha de baixo e ele era espremido em qualquer sobra. O teste achou mais cinco casos na Dieta, onde "Outras sugestões" divide a linha (360 a 414px Compacto, 414px Padrão). **Correção:** `min-w-32`; sem espaço, o campo desce e ocupa a linha inteira. Teste em 6 larguras × 3 densidades × Diário/Dieta, visto vermelho antes (6 falhas). | Bug visual; P |
| 8.17 | ✅ **Refeição nova com nome padrão, e "Igual a ontem" sem depender de acento**, **entregue em 30/09/2026** | Ideia do Pedro: quem escreve "cafe da manha" num dia e "Café da manhã" no outro não acharia o de ontem. Duas partes: (1) "Adicionar refeição" usa o primeiro nome livre de Café da manhã, Almoço, Lanche da tarde, Jantar (depois dos quatro, "Refeição N"); dieta nova começa com Café da manhã em vez de "Refeição 1"; vale para Diário e dieta (mesmo `addMeal`). Nunca repete um nome existente. (2) `normalizeMealName` ignora acento, maiúsculas e espaço sobrando, usado pelo "Igual a ontem" e pelo `addMeal`. Refeições já salvas não mudam. 16 testes que conferiam o nome gerado antigo foram atualizados; sabotando cada parte, os testes novos falham. | Melhoria; P |
| 8.18 | ✅ **Água registrada num aparelho não chega nos outros**, **resolvido em 30/09/2026** | Achado na inspeção do 7.5 (30/09/2026): `runWaterEntrySync` (push + pull) não é chamada em lugar nenhum; só o push do repositório roda. O servidor recebe a água, mas nenhum outro aparelho puxa. E um conflito de água fica em "conflict" para sempre, porque não há tela para resolver (o descanso resolveu isso com "vale o servidor"). Bug anterior, não tratado no 7.5. **Resolvido:** `runWaterEntrySync` roda na abertura do app (`AppDataBoot`), como as outras coleções; e `syncWaterEntries` (envia, recebe, resolve) aplica o servidor no que sobra em conflito depois do pull, que é só "apagou de um lado, editou do outro", a mesma regra do descanso (arquitetura §27). Dias que já estavam travados em conflito destravam no primeiro ciclo. Testado com dois aparelhos e servidor falso nas duas direções, e que o dia volta a sincronizar depois. | Bug; P |
| 8.19 | ✅ **Cabeçalho da landing estoura a tela no celular**, **resolvido em 30/09/2026** | Achado no 8.4 (30/09/2026), anterior a ele: o `LandingHeader` (marca, "Entrar" e "Criar minha conta") não cabe e a página rola para o lado em 10 das 15 combinações de celular. Medido: 320px Compacto 10px, Padrão 87px, Confortável 172px; 360px Padrão 47px, Confortável 132px; 375px Padrão 32px, Confortável 117px; 390px Padrão 17px (o aparelho do Pedro), Confortável 102px; 414px Confortável 78px. Afeta a landing e as páginas legais, que usam o mesmo cabeçalho. Sem teste de navegador hoje. **Resolvido:** medido em 320px, marca + "Entrar" ocupa no máximo 261 dos 288px, e nenhuma versão com os dois botões cabe na Confortável (nem só com o símbolo). No celular o cabeçalho mostra só "Entrar"; "Criar minha conta" volta a partir de `sm` (640px). No celular ele continua no hero, logo abaixo, como botão principal, e no fim da página; de quebra, a primeira dobra deixa de ter dois botões principais (brandbook). Teste de navegador em 5 larguras de celular, 640px e desktop, nas três densidades, visto vermelho nas mesmas 10 combinações medidas. O teste das páginas legais voltou a medir a página inteira, cabeçalho incluído. | Bug; P |
| 8.20 | ✅ **A CI do GitHub nunca passou**, **resolvido em 30/09/2026: primeira execução verde** | Achado no 8.4 (30/09/2026): as 158 execuções do workflow `CI`, desde a criação em 02/09/2026, falharam todas, na etapa "Verify"; o build nem chega a rodar. O portão que o CLAUDE.md descreve como rede de segurança nunca funcionou. **Causa provável, não confirmada** (o log exige login no GitHub): o `ci.yml` instala Node `20.9.0`, e o Vite 8 do projeto exige `^20.19.0 || >=22.12.0`. Correção provável: Node 24 no `ci.yml` (é o padrão da Vercel, e o Node 20 sai de suporte em 01/10/2026) e o `engines` do `package.json` alinhado. Confirmar lendo o log na aba Actions ou vendo a execução seguinte passar. **Resolvido, em duas causas:** (1) Node `20.9.0` na CI: com Node 24 (`5c67192`) o verify passou a chegar aos testes, antes morria em 29s; (2) a folha do RPE rolava 2,31px de lado na Confortável só em Linux: a linha "Sem RPE / Confirmar" cabia com folga zero no Windows, e a fonte do Linux (família da do Android) passava 3px. `flex-1` virou `flex-auto` com `flex-wrap` (`7c8b7c5`), e um teste novo simula a fonte mais larga para o defeito aparecer em qualquer máquina. A mensagem do teste de rolagem agora diz quem rola e quem passa da borda. GitHub CLI instalado e logado (`C:/Program Files/GitHub CLI/gh.exe`, fora do PATH do Git Bash) para ler os logs daqui. | Bug; P |

**Confirmado pelo Pedro no iPhone em 29/09/2026** ("Deu certo!!!"), depois da lista de conferência de 8.1, 8.2, 8.3, 8.6 e 8.8.

### 9. Aba Perfil: escopo e limites (handoff de 30/09/2026)

**Origem:** PDF "Lacalle Life — Perfil: escopo, referências visuais e limites de produto", entregue pelo Pedro em 30/09/2026, com baseline em `main @ af91581`. Referências: MyFitnessPal (Goals separado do diário), Lifesum (objetivo e dados pessoais no Perfil), Gentler Streak (assuntos separados em linhas claras) e Hevy como **contraexemplo** (perfil público e social).

**Decisão central:** o Perfil é um **painel privado** de dados pessoais, metas, preferências do app e controle da conta e dos dados. Não é identidade pública, nem um segundo painel de atividade. Visual com os tokens e componentes que já existem: sem trocar a cor da marca, sem gradiente decorativo, sem linguagem de feed ou de gamificação.

| Fica no Perfil | Fica fora do Perfil | Regra para qualquer novidade |
| --- | --- | --- |
| Dados que explicam o plano, objetivo nutricional, aparência, conta e gestão dos próprios dados. | Registro diário de comida e água (Hoje e Diário); histórico e evolução de peso, dieta e treino (Evolução); feed social, seguidores, desafios, streaks, badges, placar, comparação pública; avatar, bio pública, fotos de treino; IA ou reconhecimento automático; seletor de unidades sem decisão de ampliar mercado. | Só entra um controle que mude um comportamento real do app e tenha efeito verificável no fluxo correspondente. Nada entra para "parecer completo". |

**O que o Perfil já tem (conferido no código em 30/09/2026):** conta (entrar ou criar conta, email, trocar senha, sair) e sincronização em `perfil/page.tsx` e `account-status.tsx`; dados pessoais e meta (sexo, idade, altura, peso, atividade, objetivo; gordura e ritmo semanal opcionais) em `profile-form.tsx`; resultado do plano, divisão de macros e aviso de peso desatualizado em `plan-summary.tsx`, `macro-donut.tsx`, `stale-weight-notice.tsx`; aparência em `profile-screen.tsx`; backup, importação e esquecer o aparelho em `backup-panel.tsx`.

| # | Item | Situação | Nota |
| --- | --- | --- | --- |
| 9.1 | ✅ **Reorganização da aba e resumo dos dados do Perfil**, **entregue em 30/09/2026** | Feito | **Escopo confirmado pelo Pedro (30/09/2026): só a aba Perfil muda.** Nenhuma outra tela, fluxo ou dado entra junto. Reorganizar o que já existe (conta e sincronização, dados pessoais e meta, resultado do plano, aparência, backup e dados) em grupos claros, seguindo a tabela acima e os critérios abaixo, com protótipo antes do código. "Já em andamento" no PDF queria dizer que o Pedro já tinha decidido fazer, não que havia código. **Entregue**, pelo protótipo aprovado (https://claude.ai/artifact/Ca8EGZSxpjXQ3xmzhby78L): grupos com título, Seu plano → Seus dados → Aparência → Conta e sincronização → Dados e privacidade; **sem conta, a conta vem primeiro** (pedido do Pedro), com o cartão "Você está usando sem conta" e **Entrar em verde** (exceção de dois primários registrada em `docs/brandbook.md`). "Seus dados" (`ProfileDataSummary`) mostra o que foi informado, uma linha por dado, com etiqueta "opcional" e "Não informado" em branco; Manter não tem ritmo. O formulário ganhou os grupos "Sobre você", "Rotina e objetivo" e "Opcional". "Dados e privacidade" fica aberto (era o `<details>` "Dados e segurança") com o backup, "Apagar dados do perfil" (saiu de perto de "Editar dados") e os links legais. "Sincronizar dados" só com conta. A ordem mora em `app/(app)/perfil/profile-tab.tsx`, que junta conta e perfil. Diferença do protótipo: o painel de backup manteve o próprio layout (exportar, importar e esquecer), em vez das linhas com ícone, para não reescrever um fluxo com prévia e confirmação. |
| 9.2 | **Preferências alimentares e alergias** | Fora do escopo | Não entra: o Pedro quer mudar só a aba Perfil (30/09/2026), e esta preferência só faria sentido com efeito noutro fluxo (o app não gera dieta; a pessoa monta a dela). Sem esse efeito, um campo no Perfil prometeria uma proteção que o app não entrega. Fica registrado para não voltar como checkbox solto. |

**Critérios de qualidade para qualquer mudança no Perfil:**

- a pessoa distingue o que é obrigatório do que é opcional no formulário;
- entende que os números do plano saem dos dados do formulário;
- distingue conta e sincronização das preferências do app;
- acha importar, exportar e apagar dados sem confundir com ações do dia a dia;
- toda ação destrutiva continua pedindo confirmação e dizendo o alcance.

### 10. Refinamentos da tela Exercícios (trazidos da seção 1 em 30/09/2026)

Pedido do Pedro, depois de ver a explicação: os quatro refinamentos adiados de `/exercicios` entram no bloco atual. Só a tela Exercícios muda; nenhum dado novo (os recentes saem dos treinos já salvos). Cada um começa por protótipo, como toda novidade.

| # | Item | O que muda | Hoje no código |
| --- | --- | --- | --- |
| 10.1 | **Grupos musculares logo no topo** | Atalhos por grupo (Peito, Costas, Pernas...) visíveis ao abrir a tela, sem rolar nem abrir filtro. | A lista abre direto; o grupo só pelo filtro. |
| 10.2 | **19 músculos agrupados em 6 regiões** | O filtro de músculo passa a mostrar regiões (algo como Peito, Costas, Ombros, Braços, Core, Pernas), com os músculos finos dentro de cada uma. | 19 botões soltos em `exercise-filter-bar.tsx` (`MUSCLE_GROUPS`), com "Deltoide anterior", "Adutores", "Abdutores"... |
| 10.3 | **Menos texto em cada linha** | Embaixo do nome, só o essencial (por exemplo, o músculo principal). | `exercise-row.tsx` mostra todos os músculos e todos os equipamentos: "Peito · Tríceps | Barra · Banco". |
| 10.4 | **Recentes e mais usados** | Seção com o que foi feito por último e o que mais se faz, como os recentes do seletor de alimentos (7.2). | Só Favoritos. |

### Placar dos itens 7, 8, 9 e 10 (atualizado em 30/09/2026)

✅ entregue · ⬜ falta

- ✅ 7.1 Série concluída em verde suave
- ✅ 7.2 Recentes no seletor de alimentos
- ✅ 7.3 Igual a ontem
- ✅ 7.4 Histórico por exercício
- ✅ 7.5 Dia de descanso
- ✅ 7.6 Tipo de série (aquecimento fora do volume e dos recordes)
- ✅ 7.7 Registro rápido de calorias (total soma o que se sabe e avisa o que falta)
- ✅ 8.1 Nome do exercício cortado
- ✅ 8.2 Sem zoom de toque duplo
- ✅ 8.3 RPE pela linha do meio círculo
- ✅ 8.4 Contrato de uso, Política e Aviso de Saúde (contato lacallepm@gmail.com; falta a revisão jurídica)
- ✅ 8.5 Última vez como dica no campo vazio
- ✅ 8.6 Sem zoom ao tocar num campo no iPhone
- ✅ 8.7 Falhas de layout só no WebKit (eram da régua; `npm run test:browser:webkit`)
- ✅ 8.8 Percentuais do donut fora do anel
- ✅ 8.9 Dica da última vez (itálico testado e revertido; texto normal)
- ✅ 8.10 Verdant mais claro nos botões (só o botão principal, tema claro)
- ✅ 8.11 Logo verde no cabeçalho
- ✅ 8.12 Transição de entrada ao abrir uma aba (falta confirmar no iPhone)
- ✅ 8.13 Campos da série com 44px e número alinhado
- ✅ 8.14 "Última vez" só com a data
- ✅ 8.15 Campos no meio da faixa da série
- ✅ 8.16 "Observações" cortado no rodapé da refeição (320px Confortável)
- ✅ 8.17 Refeição nova com nome padrão; "Igual a ontem" sem depender de acento
- ✅ 8.18 Água chega nos outros aparelhos (sync na abertura; conflito não trava)
- ✅ 8.19 Cabeçalho da landing cabe no celular (só "Entrar" abaixo de 640px)
- ✅ 8.20 CI do GitHub verde pela primeira vez (Node 24 + folha do RPE com fonte do Linux)
- ✅ 9.1 Reorganização e resumo da aba Perfil (sem conta, a conta vem primeiro)
- ⬜ 10.1 Exercícios: grupos musculares logo no topo
- ⬜ 10.2 Exercícios: 19 músculos agrupados em 6 regiões
- ⬜ 10.3 Exercícios: menos texto em cada linha
- ⬜ 10.4 Exercícios: recentes e mais usados

### Ordem de prioridade do que falta (29/09/2026)

Critério: facilidade (o dado já existe? mexe no que é salvo e sincronizado?) contra o ganho no uso. Na fase de estabilização, mexer no dado salvo é o que mais pesa: pede mudança de esquema, sincronização e migração.

| Ordem | Item | Por que nesta posição | Mexe no dado salvo? | Esforço |
| --- | --- | --- | --- | --- |
| 1 | ✅ **8.5** Semana passada como dica no campo vazio (entregue 29/09/2026) | O dado já existe (`LastPerformance` guarda cada série da última vez); muda o placeholder em `performed-set-row.tsx`. Protótipo rápido antes, e cuidar para não confundir com a meta planejada. | Não | P |
| 2 | ✅ **7.2** Recentes no seletor de alimentos (entregue 30/09/2026) | Sai dos registros do diário que já existem (cada item guarda `foodId` e gramas). Protótipo já aprovado. | Não, só leitura | M |
| 3 | ✅ **7.3** Igual a ontem (entregue 30/09/2026) | Lê o dia anterior e copia com as funções de edição que já existem. Protótipo aprovado. Vizinho da 7.2 (mesma tela). | Não além de copiar itens | M |
| 4 | ✅ **7.4** Histórico por exercício (entregue 30/09/2026) | Tudo sai dos treinos já salvos (`services/history.ts`); tela nova no detalhe do exercício. | Não, só leitura | M |
| 5 | ✅ **8.7** Falhas de layout só no WebKit (resolvido 30/09/2026) | Investigação com o WebKit já instalado, reproduzível no PC. Sem mudança de dado; reduz risco de bug de iPhone nas próximas entregas. | Não | M |
| 6 | ✅ **7.5** Dia de descanso (entregue 30/09/2026) | Não existe onde guardar "hoje é descanso": pede campo novo, persistido e sincronizado. | **Sim** | M |
| 7 | ✅ **7.6** Tipo de série (entregue 30/09/2026) | Campo novo em `PerformedSet`, sincronizado, e muda volume e recordes da Evolução. **Decidido (30/09/2026):** aquecimento sai do volume e dos recordes. | **Sim** | G |
| 8 | ✅ **7.7** Registro rápido de calorias (entregue 30/09/2026) | Item de diário sem alimento do catálogo: muda o modelo do diário e a sincronização. | **Sim** | G |
| ✅ | **8.4** Contrato de uso (entregue 30/09/2026) | A página em si é pequena; depende do texto jurídico (e provavelmente da política de privacidade) vir do Pedro. | Só se houver aceite registrado | P, quando houver texto |

Os quatro primeiros não mexem em nada que é salvo: são os de menor risco e os que mais aparecem no uso diário.
