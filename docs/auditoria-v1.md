# Auditoria da V1

Repositório auditado: `pxdrik/Lacalle-Life` (commit `98eabee`).
Também auditado: `C:\Users\Pedro\Lacalle-Life-2`, um scaffold anterior de V2.

**Princípio:** reutilizar conhecimento é inteligente; reutilizar arquitetura
antiga por comodidade não é. Nada entra na V2 por já existir — entra por ser
atemporal, desacoplado e verificável.

---

## 1. Pode ser reutilizado

### 1.1 Banco de alimentos — `shared/foodsData.ts` ✅ já integrado

216 alimentos PT-BR com macros por 100 g. Auditado antes de entrar:

| Verificação | Resultado |
| --- | --- |
| Duplicatas de nome | 0 |
| Valores fisicamente implausíveis | 0 |
| Macros somando > 100 g em 100 g | 0 |
| Descompasso energia × macros > 15% | 3 |

Os três descompassos (Limão, Milho cozido, Milho doce cozido) **não são erros**.
São artefato de fibra, que rende ~2 kcal/g em vez de 4 — o valor medido está
correto e a estimativa de Atwater é que superestima. Mantidos como estavam.

Por que vale: catalogar 216 alimentos brasileiros com macros confiáveis é
trabalho de semanas. É o ativo mais valioso da V1.

**Estado:** integrado na Etapa 3 como `src/features/foods/data/catalogue.json`,
com ids em slug e validação de schema em tempo de build.

### 1.2 Catálogo de exercícios — `exercises_processed.json` ⏳ pendente

377 exercícios categorizados em 18 grupos musculares.

| Verificação | Resultado |
| --- | --- |
| Duplicatas | 4 |
| Nomes com cara de preenchimento sintético | 1 (`Rolo Antebraço`) |
| Campo de equipamento | ausente em 100% |
| Campo de músculo primário/secundário | ausente em 100% |

Distribuição plausível (54 Peito, 52 Quadríceps, 47 Ombros, 45 Abdominais…),
sem a grade artificial de 20-por-grupo que contamina a outra lista.

Por que vale: nomenclatura PT-BR de academia é conhecimento local difícil de
gerar. Precisa de enriquecimento (equipamento, grupo muscular), mas a base de
nomes é sólida.

**Ação:** importar como semente na etapa de treinos, deduplicar os 4, e
enriquecer incrementalmente.

### 1.3 Escala de RPE — `client/src/components/PSESelector.tsx` ⏳ pendente

**Achado mais valioso depois dos alimentos.** A escala com meios-pontos e as
descrições ancoradas em RIR (*reps in reserve*):

| RPE | Significado |
| --- | --- |
| 6 | Poderia ter feito +4 reps |
| 7 | Poderia bem ter feito +3 reps |
| 7,5 | Poderia talvez ter feito +3 reps |
| 8 | Podia bem ter feito +2 reps |
| 8,5 | Podia talvez ter feito +2 reps |
| 9 | Podia bem ter feito +1 rep |
| 9,5 | Podia talvez ter feito +1 rep |
| 10 | Não foi possível fazer mais reps |

Isto é domínio real, e é a escala que Alpha Progression e Boostcamp usam. Note
que `shared/nutrition.ts` tem uma versão **pior** da mesma coisa
(`INTENSITY_LABELS`, só inteiros de 6 a 10) — a do PSESelector é a correta.

**Ação:** reutilizar os valores e os textos. Descartar o componente (Dialog do
shadcn + gradientes `from-red-600 to-red-700`, incompatíveis com a identidade
monocromática da V2).

### 1.4 Regra de três nutricional — `calculatePortionNutrition` ✅ já integrado

`valor = (valorPor100g / 100) × gramas`. Trivial, mas é a operação mais
executada do produto.

**Estado:** `scaleMacros` em `src/core/domain/macros.ts`, com uma diferença
deliberada: a V1 arredondava dentro da função, o que empurra erro para dentro
de todo total construído em cima. A V2 mantém precisão cheia e arredonda por
porção antes de somar — para que a coluna na tela feche com o total impresso.

### 1.5 `cn()` — `client/src/lib/utils.ts` ✅ já integrado

`twMerge(clsx(inputs))`. Seis linhas, idêntico na V2. Não é conhecimento da V1,
é o padrão da comunidade — mas confirma a escolha.

### 1.6 Multiplicadores de atividade ⏳ pendente

`sedentary 1.2 · light 1.375 · moderate 1.55 · active 1.725 · very_active 1.9`.

Padrão consolidado da literatura, não invenção da V1. Reutilizar.

### 1.7 Conceito de validação de dieta contra metas — `validateDiet` ⏳ pendente

O **conceito** vale: comparar totais atingidos contra metas e sinalizar desvio
acima de 10%, com mensagem por macro. Vira a camada visual de progresso quando
as metas opcionais existirem.

O **código** não vale: assume a estrutura de refeição da V1 e devolve três
campos (`compatibilityScore`, `varietyScore`, `adherenceScore`) fixos em `0`
com o comentário "será calculado em outro lugar" — que nunca foi.

---

## 2. Deve ser reescrito

### 2.1 Motor nutricional (TMB / TDEE / macros) — **ressalva grave**

Este era o candidato número um a reutilização. **Não é conhecimento validado —
é conhecimento contraditório.** Três fontes no mesmo repositório discordam
sobre qual fórmula o produto usa:

| Fonte | Afirma |
| --- | --- |
| `README.md` | "Fórmula de Mifflin-St Jeor", com a fórmula de Mifflin escrita por extenso |
| `shared/nutrition.ts` | Implementa Harris-Benedict **revisada** (Roza & Shizgal, 1984) |
| `server/nutrition.test.ts` | Comenta a Harris-Benedict **original** (1919) nos casos de teste |

E o teste não resolve a disputa: ele assere apenas
`expect(tmb).toBeGreaterThan(1400)` e `toBeLessThan(1550)` — uma faixa larga o
bastante para as três fórmulas passarem. O teste foi escrito para passar, não
para fixar comportamento.

A mesma divergência atinge os macros:

| Fonte | Distribuição |
| --- | --- |
| `README.md` | Proteína 2 g/kg · Carboidrato 4 g/kg · Gordura 1 g/kg |
| `shared/nutrition.ts` | Proteína 2 g/kg · Gordura 0,8 g/kg · Carboidrato = resto |

Além disso o motor da V1 não tem piso algum: `calculateTargetCalories` aceita
TDEE de 1.200 com déficit agressivo e devolve 450 kcal/dia sem reclamar.

**Decisão:** não reutilizar o motor da V1. Usar o de
`C:\Users\Pedro\Lacalle-Life-2\src\domain\nutrition\`, que é estritamente
superior: Katch-McArdle quando há percentual de gordura (melhor para corpos
magros ou muito treinados) e Mifflin-St Jeor caso contrário, limites de déficit
e superávit com *advisories* explícitas, piso de metabolismo basal, piso
clínico absoluto, realocação de macros por prioridade e um portão de segurança
final que recusa emitir um plano inválido.

Adaptações necessárias: quebrar os 405 linhas em módulos dentro do orçamento de
250, e mantê-lo **isolado da feature de dietas** — conforme sua decisão de que
montar dieta nunca depende de ter perfil preenchido.

### 2.2 Componentes base (shadcn/ui)

53 componentes presentes, **43 importados, 10 nunca usados**
(`button-group`, `chart`, `empty`, `field`, `form`, `input-group`, `item`,
`kbd`, `navigation-menu`, `spinner`).

Copiar os arquivos da V1 não daria nada que rodar o CLI do shadcn não desse — e
traria os nomes de token da V1 (`--primary`, `--secondary`, `--sidebar-*`) que
não existem na V2 (`--accent`, `--ink`, `--line`, `--canvas`).

**Reutilizar o padrão** (primitiva Radix sem estilo + Tailwind), não os
arquivos. E só quando uma tela pedir: `Button`, `Input` e `Field` já existem na
V2, escritos do zero e com testes. `Dialog`, `Tooltip` e `Tabs` entram quando
houver tela que precise — e `Dialog` talvez nunca, já que rota simples venceu
modal duas vezes até agora (`/alimentos/novo` e o picker inline).

### 2.3 Design tokens — `client/src/index.css`

O conceito é bom e foi mantido: OKLCH, variáveis semânticas, tema por atributo.

Os valores não: paleta esmeralda + petróleo + dourado, `--sidebar-*` para uma
sidebar que a V2 não tem, e nenhuma verificação de contraste. A V2 usa
identidade monocromática com contraste asserido por teste que lê o próprio CSS.

### 2.4 Tipagens de domínio — `drizzle/schema.ts`

Bom **mapa conceitual** — mostra as entidades que o produto precisa. Mas
modelado para MySQL relacional, e a V2 usa agregados em documento.

O sintoma está no próprio schema: `workoutTemplates.exercisesJson: text` e
`dietPlans.planJson: text` guardam JSON dentro de uma coluna. O schema já
estava admitindo que agregado era o modelo certo, sem poder assumir isso.

Aproveitar: quais entidades existem e quais campos importam.
Descartar: chaves estrangeiras, enums MySQL, e o `userId` em toda tabela (a V2
é local-first, single-user).

---

## 3. Deve ser descartado

### 3.1 Superfície de IA — 11 arquivos

`server/_core/llm.ts`, `_core/imageGeneration.ts`, `_core/voiceTranscription.ts`,
`components/AIChatBox.tsx`, `pages/AIChat.tsx`, tabela `ai_chat_messages`,
dependência `streamdown`, e os pontos de chamada em `routers.ts`, `db.ts`,
`App.tsx`, `pages/DietPlan.tsx`.

Decisão de produto, explícita no brief.

### 3.2 `server/nutritionRules.ts` — 418 linhas

Cabeçalho do arquivo: *"Transforma o gerador de dietas em um nutricionista
esportivo experiente"*. `DECISION_HIERARCHY`, `MEAL_COMPATIBILITY`,
`VARIETY_LIMITS`, `PersonalizationFactors`, `getFoodPriorityForMeal` — tudo
existe para alimentar o prompt do LLM que gerava dietas automaticamente.

É a base de conhecimento da funcionalidade que foi cortada. Parece domínio
nutricional; é engenharia de prompt.

(Única exceção: o conceito de `validateDiet`, listado em 1.7.)

### 3.3 `server/_core/` inteiro — plataforma Manus

OAuth, storage S3, notificações, heartbeat, contexto tRPC, SDK. Não é código
seu, é framework de terceiro. Sozinho já justificava produto novo.

### 3.4 `client/src/lib/exercises.ts`

424 nomes únicos, dos quais apenas **13 coincidem** com o catálogo bom de 377.
Conteúdo sintético gerado para preencher grade de 20 por grupo: "Puxada com
V-Bar", "Encolhimento com Plataforma", "Rosca com Plataforma Antebraço",
"Abdominal com Barra Hexagonal". Exercícios que não existem.

### 3.5 `client/src/lib/exerciseMuscles.ts`

Mapeia 42 exercícios. Cobertura do catálogo de 377: **0%** — os nomes não
batem com nenhum. Inútil como está, e refazer o mapeamento é mais barato que
reconciliar.

### 3.6 Peso morto

| Arquivo | Linhas | Motivo |
| --- | --- | --- |
| `pages/ComponentShowcase.tsx` | 1405 | Vitrine de componentes, não é produto |
| `pages/Workouts_backup.tsx` | 455 | Arquivo de backup versionado |
| `components/Map.tsx` + `@types/google.maps` | — | Google Maps num app de dieta |
| `PremiumMuscleMap` / `MuscleMapViewer` / `MuscleGroupImages` | ~500 | Decoração; não ajuda a montar treino |
| Sistema de `alerts` | tabela + UI | Notificação que ninguém pediu |
| 10 componentes `ui/` | — | Nunca importados |

### 3.7 Decisões arquiteturais

Arquitetura por camada (`pages/`, `components/`, `lib/`) em vez de por feature.
Wouter com patch aplicado. tRPC + Express + Drizzle + MySQL/TiDB para dados que
na V2 vivem no navegador. Arquivos de 752, 589 e 512 linhas.

---

## 4. Placar

| Categoria | Itens | Estado |
| --- | --- | --- |
| Reutilizado e integrado | 216 alimentos, regra de três, `cn()` | ✅ Etapas 3–5 |
| Reutilizar, pendente | 377 exercícios, escala RPE, multiplicadores de atividade, conceito de `validateDiet` | ⏳ Etapas de treino e metas |
| Reescrever | motor nutricional (de `Lacalle-Life-2`, não da V1), componentes base, tokens, tipagens | ⏳ sob demanda |
| Descartar | IA (11 arquivos), `nutritionRules.ts`, `_core/` Manus, 2 listas de exercícios ruins, ~2.400 linhas de peso morto | ✅ decidido |

**Aproveitamento real da V1: dados e regras. Nada de arquitetura, nada de UI.**

A conclusão que mais importa é a da seção 2.1: o que parecia ser o ativo técnico
mais valioso da V1 — o motor nutricional — é o item que **não** deve ser
reutilizado, porque três fontes do próprio repositório discordam sobre qual
fórmula ele implementa e os testes são frouxos demais para desempatar.
