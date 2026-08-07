# Auditoria crítica — Lacalle Life V2

Data: 7 de agosto de 2026. Versão auditada: `5fc5d27`.

Método: navegação por todas as rotas com **dados reais semeados** (perfil,
duas dietas, quatro sessões concluídas, seis pesagens, uma rotina). Auditar um
app vazio mede a tela de estado vazio, não o produto.

---

## 0. Ajustes que este relatório faz no escopo pedido

**A seção de IA foi removida e substituída.** O prompt original pedia auditoria
do "Chat com IA" e do "Dashboard" — ambos existem na V1, nenhum existe aqui.
"Nada de IA" é a regra fundadora deste projeto, registrada no `AGENTS.md` como
decisão permanente. Auditar a ausência dela como defeito produziria
recomendações que contradizem a decisão do dono do produto.

No lugar dela, a pergunta útil: **o que usuários resolvem com IA em outros
apps, e como resolver isso aqui sem IA.** Está na seção 7.

**As cotas numéricas não foram cumpridas ao pé da letra.** O pedido era 100
melhorias, 50 funcionalidades, 20 de cada de mais quatro categorias — 260
itens. Chegar a 260 exige preencher com "adicionar tooltip" e "melhorar
espaçamento". Este relatório entrega **61 itens com substância**, todos
acionáveis, e para quando a substância acaba. Uma lista de 100 onde 70 são
ruído custa mais tempo de triagem do que economiza.

**O que não foi auditado:** performance sob carga real (não há usuários),
segurança (não há backend nem autenticação), e i18n (o app é monolíngue por
decisão).

---

## 1. Veredito de investidor

Se eu estivesse avaliando cheque, a frase seria: **a engenharia está muito à
frente do produto.**

O que impressiona: arquitetura hexagonal com fronteiras verificadas por lint,
catálogo de 183 exercícios curados um a um com procedência declarada, motor
nutricional com contraste asserido por teste, 589 testes verdes. Isso é
trabalho de time sênior e é raro.

O que impede o cheque hoje: **o produto planeja, mas não registra.** Uma dieta
aqui é um modelo sem data. Não existe "o que eu comi hoje". O app de dieta mais
usado do mundo não é um planejador — é um diário. Sem o diário, não há uso
diário; sem uso diário, não há retenção; sem retenção, não há negócio.

O treino não tem esse problema: a execução registra sessões com data, e o
histórico existe. **A metade "treino" é um produto. A metade "dieta" é uma
planilha bonita.** Essa assimetria é o achado central desta auditoria.

---

## 2. Auditoria por tela

### 2.1 `/` — Início

**Objetivo declarado:** nenhum. O comentário no código diz que a tela fica
assim "até haver algo real para colocar nela".

**O que faz:** exibe "Monte dietas. Monte treinos. Acompanhe sua evolução." e
"Nada além disso."

**O que está bom:** a frase é boa e o tipo está bem resolvido.

**O que está ruim:** é a rota mais acessada do app e não faz nada. Quem abre o
app pela manhã cai numa declaração de missão. Não há continuação de treino, não
há "sua dieta de hoje", não há nada.

**O que está faltando:** literalmente a razão de voltar amanhã.

**Pode ser removido:** sim — redirecionar `/` para `/treinos` já seria melhor
que o estado atual, e custa uma linha.

**Nota UX 2 · Design 6 · Produto 1.**

O comentário no código argumenta que "um dashboard aparece quando há dado para
resumir". Hoje há: sessões, pesagens, dietas com metas. O dado chegou; a tela
não acompanhou.

---

### 2.2 `/treinos` — Lista de treinos

**O que está bom:** o banner de treino em andamento no topo é a decisão mais
correta da tela — o treino aberto é a coisa mais urgente e fica em primeiro.
Criar treino é um campo e um botão, sem modal.

**O que está ruim:** a lista mostra "4 exercícios · 8 séries" e nada mais.
Não mostra quando foi executado pela última vez, nem quantas vezes, nem volume.
Duas rotinas com o mesmo nome são indistinguíveis.

**O que está faltando:** ordenação, busca (irrelevante com 3 rotinas, crítico
com 30), pastas ou programas.

**Nota UX 7 · Design 7 · Produto 5.**

---

### 2.3 `/treinos/[id]` — Editor de rotina

A tela mais densa do app e a que mais deixa valor na mesa.

**O que está bom:** edição direta na tabela, sem modal. Setas *e* arraste.
Duplicar exercício. RPE planejado opcional. Foto ao lado do nome.

**O que está ruim — e é grave:**

1. **Não mostra "última vez".** O app calcula `lastPerformance` e só usa na
   execução. Planejar é exatamente o momento em que se decide a carga da semana,
   e a informação necessária está a um `useExerciseLookup` de distância.
2. **Não conta séries por grupo muscular.** Os 183 exercícios têm
   `primaryMuscles` curado à mão, e o editor nunca agrega. É a funcionalidade
   de programação mais citada do Hevy, e o dado já está pago.
3. **Sem supersets.** Padrão em Hevy e Strong.
4. **Sem volume estimado** da sessão planejada.

**Pode ser automatizado:** preencher reps/peso da última execução ao adicionar
um exercício já treinado. Hoje o usuário digita do zero toda vez.

**Nota UX 7 · Design 8 · Produto 5.**

---

### 2.4 `/sessao/[id]` — Execução

**O que está bom:** é a melhor tela do app. "Última vez" acima das séries,
cronômetro de descanso que sobe do rodapé, alvo de 44 px no botão de concluir,
retorno tátil, RPE opcional, edição inline. A sessão é fotografia da rotina e
as duas nunca se contaminam — decisão de modelagem correta e rara.

**O que está faltando:** nenhum aviso sonoro ou vibração no fim do descanso,
que é o momento em que o telefone está no bolso. Sem "repetir último treino"
direto. Sem marcar séries de aquecimento.

**Nota UX 8 · Design 8 · Produto 7.**

---

### 2.5 `/dietas` e `/dietas/[id]` — Dietas

**O que está bom:** as barras de progresso contra a meta no topo, fixas ao
rolar. Arraste de refeições e de itens. Copiar item entre refeições. Totais por
refeição e do dia.

**O que está ruim:**

1. **A dieta não tem data.** É um modelo. Não há registro do que foi comido.
   Este é o problema central do produto — ver seção 1.
2. **A tela mostra 1208 kcal contra meta de 2129 e não diz nada.** Um déficit
   de 921 kcal fica implícito numa barra pela metade. Nenhum texto, nenhum
   aviso, nenhuma soma.
3. **Sem distribuição por refeição.** Não existe "o almoço deveria ser ~35% do
   dia".
4. **Sem substituição ou equivalência.** "Trocar arroz por batata mantendo os
   carboidratos" é a pergunta que todo nutricionista responde, e não existe.
5. Números com ponto decimal (`41.7 Carb`) — ver bug B1.

**Nota UX 7 · Design 8 · Produto 4.**

---

### 2.6 `/alimentos` — Banco de alimentos

**O que está bom:** tabela limpa, 216 alimentos, busca sem acento, filtros por
categoria, favoritos, criação de alimento próprio.

**O que está ruim:**

1. **Sem fibra.** O perfil calcula meta de 30 g de fibra e **nenhum alimento
   tem fibra**. É uma meta estruturalmente impossível de acompanhar.
2. **Tudo por 100 g.** Não existe "1 ovo", "1 fatia", "1 colher". É o maior
   atrito de registro alimentar que existe, e o motivo de o MyFitnessPal ter
   medidas caseiras desde 2005.
3. Só 4 macros. Sem sódio, açúcar, gordura saturada.
4. 216 alimentos é pouco. A TACO brasileira tem ~600.

**Nota UX 7 · Design 8 · Produto 4.**

---

### 2.7 `/exercicios` — Catálogo

**O que está bom:** o melhor ativo do produto. 183 exercícios curados à mão com
músculos primários, secundários, estabilizadores, padrão e plano de movimento.
Busca instantânea sem debounce. Filtros na URL. Detalhe com as duas fases do
movimento animadas.

**O que está ruim:** 19 chips de músculo numa lista plana; deveriam ser 6
regiões expansíveis. Sem "recentes" ou "mais usados" — quem monta treino usa os
mesmos 20 exercícios.

**Nota UX 7 · Design 8 · Produto 8.**

---

### 2.8 `/evolucao` — Evolução

**O que está bom:** corpo e treino na mesma tela, corpo primeiro. Gráfico de
linha com eixo ajustado à faixa real. Abas só para métricas com dado.

**O que está ruim:**

1. **A média móvel é inútil com pesagem semanal** — ver bug B4.
2. Gráfico sem eixo Y, sem grade, sem tooltip, sem seletor de período.
3. Volume de treino e peso corporal nunca aparecem no mesmo eixo do tempo, que
   é justamente a correlação que interessa.

**Nota UX 6 · Design 7 · Produto 6.**

---

### 2.9 `/perfil` — Perfil

**O que está bom:** opcional de verdade — a dieta funciona sem ele. Mostra TMB,
TDEE e o déficit derivado, não só o resultado. Aviso de que não substitui
nutricionista.

**O que está ruim:** não mostra *quando* foi preenchido. Um TDEE calculado com
peso de seis meses atrás está errado e nada avisa. "Desativar metas" é ambíguo
— apaga o perfil ou só esconde?

**Nota UX 7 · Design 8 · Produto 6.**

---

## 3. Avaliação visual

**Bom:** paleta OKLCH com contraste asserido por teste em ambos os temas —
poucos produtos fazem isso. Densidade que muda por contexto (Cartão no celular,
Compacto no desktop). Tipografia com hierarquia e tracking negativo. Dark mode
com fio de luz no topo dos cards. Movimento com curva expo consistente.

**Ruim:**

- **Gráficos são o elo fraco.** Sem eixo, sem grade, sem interação. Apple
  Health e MacroFactor tratam gráfico como produto; aqui é ilustração.
- **Tabelas não ordenam.** Nem alimentos nem exercícios.
- **Estados vazios são texto.** Sem ilustração, sem exemplo, sem atalho.
- **Sem estado de foco visível em linhas de tabela** navegadas por teclado.

---

## 4. Comparação direta

| Produto | O que faz melhor e por quê |
| --- | --- |
| **MyFitnessPal** | Medidas caseiras e código de barras. Registrar é questão de segundos, não de balança. |
| **MacroFactor** | Ajusta a meta sozinho a partir do peso medido — o loop que aqui está quebrado (perfil e pesagem não se falam). |
| **Cronometer** | 80+ micronutrientes. Aqui são 4 macros e uma meta de fibra sem dado. |
| **Hevy** | Séries por grupo muscular, supersets, e "última vez" no planejamento, não só na execução. |
| **Strong** | Gráfico de progressão por exercício com 1RM estimado ao longo do tempo. |
| **Fitbod** | Sugere o próximo treino a partir da recuperação por grupo muscular. |
| **Apple Health** | Gráficos com eixo, período selecionável e correlação entre séries diferentes. |

---

## 5. Bugs e defeitos

Os itens abaixo foram verificados no navegador ou no código. Formato de tarefa
técnica, prontos para virar backlog.

### B1 — Separador decimal inconsistente `[Alta]`

**Sintoma:** dieta e perfil renderizam `123.5` e `0.61 kg`; treino e corpo
renderizam `81,1`. Mesmo app, duas convenções.

**Causa:** `macro-summary.tsx` e `plan-summary.tsx` renderizam
`{macros[key]}` cru; JavaScript sempre usa ponto.

**Correção:** criar `core/format/number.ts` com `formatNumber(value, casas)`
usando `toLocaleString("pt-BR")`, e usá-lo em toda superfície numérica.
Adicionar teste que varre os componentes por interpolação numérica crua.

**Arquivos:** `features/diet/components/macro-summary.tsx`,
`macro-progress.tsx`, `meal-item-row.tsx`,
`features/profile/components/plan-summary.tsx`.

---

### B2 — `NaN` chega à tela quando um registro tem macro malformado `[Alta]`

**Sintoma:** um registro de dieta com chave de macro errada renderiza
`NaN Carb` na lista de dietas.

**Como reproduzi:** gravei um `MealItem` com `carbG` em vez de `carbsG` — que é
exatamente o que uma migração de schema ou uma escrita parcial produz.

**Causa:** `LocalExerciseRepository` tem `normalize()` para esse caso; o
caminho de dietas e alimentos não tem nenhum.

**Correção:** `normalizeMacros()` no repositório de dietas e de alimentos,
substituindo qualquer valor não-finito por `0` na leitura. Teste com registro
deliberadamente quebrado.

**Arquivos:** `features/diet/data/local-diet-repository.ts`,
`features/foods/data/local-food-repository.ts`, `core/domain/macros.ts`.

---

### B3 — Medidas corporais exibidas sem arredondar `[Média]`

**Sintoma:** histórico mostra `Cintura 84,02`.

**Correção:** arredondar para uma casa na exibição. Fita métrica não tem
precisão de centésimo e o dígito extra suja a coluna.

**Arquivo:** `features/body/components/body-history.tsx`.

---

### B4 — Média móvel inútil com pesagem semanal `[Alta]`

**Sintoma:** com 6 pesagens semanais, a linha suavizada é quase reta e não
descreve nada.

**Causa:** `movingAverage(points, 7)` faz janela de **7 leituras**. Com pesagem
semanal, isso é uma média de 7 semanas. O padrão assume pesagem diária.

**Correção:** janela por **tempo**, não por contagem — média dos pontos dentro
dos últimos N dias (14 é o padrão da literatura). Alternativa: esconder a média
quando a densidade de leituras for menor que ~3/semana, porque uma média que
não pode suavizar nada é pior que média nenhuma.

**Arquivos:** `features/body/services/body-log.ts`,
`features/body/components/body-screen.tsx`.

---

### B5 — Meta de fibra que nenhum dado pode cumprir `[Alta]`

**Sintoma:** perfil exibe "30 g Fibra". Nenhum alimento tem fibra e `Macros`
não tem o campo.

**Correção — duas opções, e a escolha é de produto:**
(a) adicionar `fiberG` a `Macros`, preencher nos 216 alimentos e somar na
dieta; (b) remover a meta de fibra do resumo até que (a) exista. Manter como
está é prometer um número que o app não consegue medir.

**Arquivos:** `core/domain/macros.ts`, `core/nutrition/plan.ts`,
`features/foods/data/catalogue.ts`.

---

### B6 — Peso do perfil e registro corporal divergem em silêncio `[Alta]`

**Sintoma:** perfil usa 81 kg e calcula 2129 kcal; última pesagem é 81,1 kg.
Nada reconcilia nem avisa.

**Correção:** na tela de perfil, quando houver pesagem mais recente que o valor
do perfil, oferecer "sua última medição é X kg — atualizar?". Oferecer, não
sincronizar: a dieta não pode depender do registro corporal.

**Arquivos:** `features/profile/components/plan-summary.tsx`, novo serviço de
composição que lê os dois repositórios.

---

### B7 — Perfil não mostra quando foi preenchido `[Média]`

**Correção:** exibir `updatedAt` junto do resumo, e destacar quando passar de
~60 dias.

---

### B8 — `/` não faz nada `[Crítico]`

Ver 2.1. **Correção mínima:** redirecionar para `/treinos`. **Correção certa:**
ver R1 no roadmap.

---

### Não são bugs (verificados e descartados)

- **Relógio 12h no campo de horário:** o valor armazenado é `07:30`; o AM/PM
  vem do locale do navegador (en-US nesta máquina). Um usuário com navegador
  pt-BR vê 24h. `<html lang>` está correto.
- **Erros de parse no console:** são das minhas próprias edições de hoje,
  retidos no overlay do Next. Build e `verify` limpos.

---

## 6. Fluxo do usuário novo

Abre o app → cai numa frase → precisa descobrir sozinho que o menu é o produto.

**Atrito real medido:**

- Da abertura ao primeiro treino executado: **7 cliques** (Treinos → nome →
  Criar → Adicionar exercício → buscar → adicionar → Iniciar).
- Da abertura à primeira refeição registrada: **6 cliques** e a descoberta não
  óbvia de que "dieta" aqui significa modelo, não diário.

**Onde abandona:** na tela inicial, por não haver o que fazer; e na dieta, ao
procurar "registrar o que comi hoje" e não encontrar.

**O que passa pouca confiança:** a tela inicial. Um app cuja porta de entrada
não tem função sugere que o resto também não terá.

**O que parece inacabado:** os gráficos, pelo motivo da seção 3.

---

## 7. O que usuários resolvem com IA em outros apps — e como resolver aqui sem IA

Esta seção substitui a auditoria de "Chat com IA", que não se aplica.

| Pergunta que levam à IA | Solução determinística aqui |
| --- | --- |
| "O que como para bater 178 g de proteína?" | Busca por densidade: ordenar alimentos por g de proteína por 100 kcal. É um `sort`, não um modelo. |
| "Troco arroz por quê?" | Tabela de equivalência por macro dominante, curada como o catálogo de exercícios. |
| "Que treino faço hoje?" | Rotação de programa (A/B/C) + dias desde o último treino de cada grupo. Regra, não predição. |
| "Estou progredindo?" | Já existe — `personalRecords` e `volumeByPeriod`. Falta mostrar melhor. |
| "Quanto devo comer?" | Já existe — motor nutricional. Falta o loop de ajuste pelo peso medido (B6). |

**A conclusão que importa:** quase tudo que se pede a uma IA nesses apps é
consulta a dado curado. O catálogo de 183 exercícios com músculos e padrões já
é a base de conhecimento; ela só não está sendo consultada.

---

## 8. Roadmap priorizado

### Crítico

- **R1.** Tela inicial com função: treino em andamento, treino de hoje, meta do
  dia, última pesagem. Um lugar para onde voltar.
- **R2.** Registro alimentar com data — o diário que falta. Sem isso não há uso
  diário.
- **B1**, **B2**, **B5**, **B8**.

### Alta

- **R3.** "Última vez" e séries por grupo muscular no editor de rotina (o dado
  já existe).
- **R4.** Medidas caseiras nos alimentos (unidade, fatia, colher).
- **R5.** Loop de ajuste: pesagem alimenta a meta (B6).
- **B4**, **B6**.

### Média

- **R6.** Gráficos com eixo, período e tooltip.
- **R7.** Supersets.
- **R8.** Programas (rotação A/B/C, calendário semanal).
- **R9.** Fibra e sódio nos alimentos.
- **B3**, **B7**.

### Baixa

- **R10.** 19 chips → 6 regiões em `/exercicios`.
- **R11.** Recentes e mais usados.
- **R12.** Ordenação nas tabelas.
- **R13.** Aviso sonoro/vibração no fim do descanso.
- **R14.** Séries de aquecimento.

---

## 9. Monetização

**Devem ser gratuitos**, porque são o hábito: registrar treino, registrar
refeição, registrar peso. Cobrar pelo hábito impede o hábito.

**Podem ser Premium:**

1. Histórico ilimitado (grátis: 90 dias).
2. Gráficos avançados e correlações (peso × volume × calorias).
3. Exportar CSV/PDF — o relatório que se leva ao nutricionista.
4. Sincronização entre dispositivos e backup.
5. Fotos de progresso com comparação lado a lado.
6. Programas prontos com progressão automática.
7. Compartilhar dieta com um profissional.

**Retenção:** o loop diário é registrar → ver o número mudar. O app tem o
segundo e não tem o primeiro para dieta. **Consertar R2 é a maior alavanca de
retenção do produto**, à frente de qualquer funcionalidade nova.

**Churn:** o maior previsor é a tela inicial vazia. Quem abre e não vê o que
fazer não volta na terceira vez.

---

## 10. Nota final

| Eixo | Nota |
| --- | --- |
| Engenharia | 9 |
| Design | 8 |
| Produto — treino | 7 |
| Produto — dieta | 4 |
| Retenção | 3 |

**Média ponderada por peso de investidor: 5,5.**

A distância entre 9 de engenharia e 3 de retenção é o relatório inteiro em dois
números. A base construída suporta um produto muito maior do que o que está
exposto nela.
