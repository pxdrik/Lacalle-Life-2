# Life Pro: diagnóstico e plano de implementação

> Escrito em 01/10/2026. Cumpre as Etapas 1 (auditoria) e 2 (planejamento
> técnico) de `docs/visao-adm-pro.md`. Protótipos aprovados pelo Pedro, que são
> a base visual e de comportamento:
>
> - Painel da nutricionista (v3, 28/09/2026): https://claude.ai/artifact/EYmbA15HyK99R7NrbiZxUA
> - Funcionamento e lado do paciente (30/09/2026): https://claude.ai/artifact/7GRUPWh76oDhFcqWdaFhEM
> - Administração (01/10/2026): https://claude.ai/artifact/5gJeBRir2mCrsE3pBsyQn4

## 1. Como o app funciona hoje (o que importa para o Life Pro)

**Banco (Supabase, `supabase/migrations/0001` a `0032`).** Cada dado pessoal
é uma tabela com `user_id` e regra de leitura "só o dono" (`auth.uid() =
user_id`). Ninguém escreve direto nas tabelas: toda escrita passa por uma
função `save_*`/`delete_*` (SECURITY DEFINER, `search_path = public`) que pega
o usuário de `auth.uid()` e confere a versão (concorrência otimista).
Exclusão é lápide (`deleted_at`). Não existe papel, perfil de conta, nem
nada que um usuário possa editar para ganhar permissão: hoje não há o que
escalar.

- `profiles` é o **perfil nutricional** (metas), escrito pelo usuário. Não
  serve para guardar papel nem aprovação, e a tabela nova não pode ter esse
  nome.
- `diets`, `food_logs`, `body_entries`, `water_entries`, `rest_days`: os
  dados que a nutricionista vai querer ler.
- Alimentos personalizados **não sincronizam** (só locais). Cada item de
  refeição carrega uma cópia dos nutrientes (`per100g`), então um plano é
  autossuficiente: não depende do catálogo de quem lê.

**Aparelho (IndexedDB, local primeiro).** Um banco por identidade
(`lacalle-life` anônimo, `lacalle-life:acct:<uid>` por conta). A
sincronização empurra e puxa coleção por coleção. **Toda leitura do servidor
filtra explicitamente por `user_id` do usuário logado** (por exemplo
`diet-sync.ts:220-223`): uma regra nova que deixe a nutricionista ler dados
do paciente **não** faz a sincronização dela baixar esses dados. Os esquemas
de validação (zod) são estritos: uma versão antiga do app descarta, sem
avisar, uma dieta ou um dia de Diário que tenha um campo que ela não conhece.

**Telas.** O app roda num servidor de verdade (Vercel, sem exportação
estática; o Android abre o site publicado), então dá para ter código no
servidor. Hoje não há bloqueio de rota: tudo é do aparelho, e a tela só muda
pelo estado da conta. O grupo de rotas `(app)` monta a sincronização pessoal
inteira (`AppDataBoot`).

## 2. O que dá para reaproveitar

- Formato de dieta e refeição (`Diet`, `Meal`, `MealItem`): o plano usa o
  mesmo. Orientação por refeição = `Meal.notes`; opções da refeição =
  `Meal.alternatives`.
- Cálculos: `itemMacros`, `mealMacros`, `dietMacros` (`diet/services/diet-macros.ts`),
  sem duplicar conta nenhuma.
- Diário: `startDayFromDiet`, `checkMeal`, `openMeal` já aceitam qualquer
  objeto no formato de dieta. "Fazer uma cópia" = `duplicateDiet`.
- Componentes: `PageHeader`, `Card`, `Badge`, `Metric`, `Button`, `Dialog`
  (centro e folha de baixo), `Tabs`, `Field`, `Input`, `Select`, `Toast`,
  `ConfirmButton`, `EmptyState`, `Skeleton`, `Section`.
- Padrão do banco: tabela sem escrita direta + função SECURITY DEFINER que
  confere quem chama.

## 3. O que precisa mudar ou nascer

**Banco (tabelas novas, nenhuma existente muda de forma):**

| Tabela | Para quê | Quem lê | Quem escreve |
| --- | --- | --- | --- |
| `app_admins` | Quem é administrador (a conta lacallepm@gmail.com) | ninguém pelo app; só funções | só migração/SQL direto |
| `professional_profiles` | Pedido e situação do profissional (em análise, aprovado, recusado, suspenso) | o próprio e o admin | o próprio só pede; mudar a situação só o admin, por função |
| `admin_audit_log` | Histórico de aprovação, recusa, suspensão | admin | só as funções de admin |
| `care_links` | Vínculo profissional ↔ paciente, com o que o paciente liberou e a situação | os dois lados | só funções (aceitar, mudar o que libera, encerrar) |
| `care_invites` | Convite por link: código guardado como hash, vale 7 dias, uso único | o profissional | só funções |
| `prescribed_plans` + `prescribed_plan_versions` | Plano por vínculo; cada publicação é uma versão imutável | profissional e paciente do vínculo | só o profissional, por função que valida o conteúdo |
| `plan_templates` | Biblioteca de modelos do profissional | o próprio | o próprio, por função |
| `plan_schedules` | Em que dias o paciente segue o plano (é escolha dele) | o paciente | o paciente, por função |

**Leitura do profissional:** por funções no banco
(`pro_patient_diary`, `pro_patient_body`, `pro_patient_basics`), **nunca**
abrindo a leitura das tabelas do paciente. Cada função confere vínculo ativo
e o que foi liberado, entrega só os campos permitidos e tira lápides e
refeições apagadas. Isso evita, de uma vez, que uma consulta sem filtro vaze
dados, que o Realtime (se um dia for ligado) transmita linhas alheias, e que
uma linha inteira saia quando só parte dela foi liberada.

**Aparelho do paciente:** o plano chega numa coleção nova, só de leitura
(store `prescribedPlans`, migração de IndexedDB v11), puxada filtrando por
`patient_id` e fora do backup. **Não** entra em `diets`: lá o paciente
conseguiria editar e apagar, a escolha de dias reescreveria o plano, e
versões antigas do app o descartariam. A escolha de dias fica em
`planSchedules`, do paciente. "Dieta de hoje" passa a ser uma função só, que
olha as dietas dele e os planos, usada pelo Diário e pela aderência.

**Telas:** grupo de rotas próprio `(pro)` com layout, barra lateral e
largura de tela larga (1600px, escala maior a partir de 1440px, regra do
`docs/brandbook.md`, ligada só nessa área). Fica fora do `AppDataBoot`: a
área profissional não carrega a sincronização pessoal. Administração em
`(pro)/admin`, com entrada no Perfil só para o admin. Peças novas no design
system: tabela com colunas proporcionais, casca de página larga, barra
lateral reutilizável.

## 4. Riscos para os dados de quem já usa

| Risco | Como fica coberto |
| --- | --- |
| Profissional ler paciente sem vínculo, ou outro profissional | Leitura só por função que confere vínculo ativo e escopo; teste em banco real |
| Usuário se dar acesso profissional ou de admin | Situação e admin só mudam por função de admin; `app_admins` sem permissão nenhuma para o app; teste em banco real |
| Sincronização baixar dados alheios | Já filtra por `user_id`; teste novo que falha se algum filtro sumir; nenhuma regra de leitura nova nas tabelas do paciente |
| Plano corromper as dietas do paciente | Coleção separada, só leitura; a cópia é uma dieta nova |
| Versão antiga do app quebrar | Nenhum campo novo nas dietas e no Diário; as coleções novas uma versão antiga simplesmente não conhece |
| Encerrar vínculo apagar dados | Encerrar só muda a situação; nada é apagado, nos dois lados |
| Página do profissional ficar no cache do aparelho | Dados do paciente só pelo navegador, nunca na página gerada no servidor; rotas `/pro` fora do cache do service worker |
| Política de Privacidade desatualizada | Atualizar antes de abrir o Life Pro (compartilhamento por consentimento e o que a administração vê) |

**A lacuna principal:** hoje **nenhum teste confere as regras de acesso num
banco de verdade**; o isolamento entre contas foi verificado "por desenho"
(`docs/arquitetura-sincronizacao.md`). O Life Pro é a primeira função cuja
segurança depende de regras entre usuários diferentes, então a Etapa 0 cria
esse teste antes de qualquer tabela nova.

## 5. Plano em etapas

Cada etapa fecha com `npm run verify` e `npm run build` verdes, commit, push e
CI conferida, como sempre. Toda mudança no Supabase de produção
(`rtvscxcfwfsamxatkwit`) é ensaiada antes numa transação desfeita e **só é
aplicada com confirmação do Pedro**, uma migração por vez.

**Etapa 0. Rede de segurança (nada muda para o usuário).**
- Teste que falha se qualquer leitura da sincronização perder o filtro de
  `user_id`.
- Banco Postgres de verdade dentro dos testes (PGlite, Postgres compilado
  para rodar no Node, sem Docker e sem servidor), aplicando as 32 migrações
  com um `auth.uid()` de teste. Primeiro teste de isolamento real: a conta A
  não lê nem escreve nada da conta B. Começa por uma prova de conceito; se o
  PGlite não aguentar as migrações, paro e apresento alternativas.

**Etapa 1. Profissional e administrador (banco).** `app_admins`,
`professional_profiles`, `admin_audit_log` e as funções de pedir acesso,
aprovar, recusar, suspender e reativar. Testes no banco de verdade: ninguém se
aprova, ninguém se faz admin, quem não é admin não chama função de admin, toda
decisão fica no histórico. Depois, com confirmação, aplicar em produção e
marcar a conta lacallepm@gmail.com (que precisa existir antes).

**Etapa 2. Telas de pedido e de administração.** No Perfil: "Área
profissional" (pedir acesso, em análise, recusado com motivo, aprovado) e,
só para o admin, "Administração". Área `(pro)/admin`: Pedidos (com
conferência do CRN), Aprovados (com detalhes), Histórico. Teste de navegador
em 6 larguras × 3 densidades e em 1280, 1440 e 1600.

**Etapa 3. Casca do Life Pro.** Grupo `(pro)`, layout, barra lateral,
largura e escala de tela larga, tabela proporcional, estados vazios. Só abre
para profissional aprovado (redirecionamento no servidor; a proteção de
verdade continua no banco).

**Etapa 4. Vínculos e convites.** `care_links`, `care_invites` e funções.
Profissional: Pacientes, gerar link de convite. Paciente: `/convite/[código]`
(com e sem conta) e "Acompanhamento" no Perfil (mudar o que libera,
encerrar). Administração: lista de vínculos nos detalhes do profissional, sem
conteúdo.

**Etapa 5. Planos.** Tabelas de plano, versão e modelo; editor do
profissional reaproveitando os componentes e cálculos da dieta, com orientação
e opções por refeição; rascunho e publicar versão. Paciente: seção "Da sua
nutricionista" em Dietas, leitura do plano, "Fazer uma cópia", dias da
semana, aviso de versão nova com o que mudou, "Opção de hoje" no Diário.

**Etapa 6. Acompanhamento.** Funções de leitura do profissional e as telas
Visão geral, Diário e Evolução do paciente, com dados reais e estados vazios.

**Etapa 7. Textos legais.** Política de Privacidade e Termos de Uso
atualizados (texto proposto aqui, revisão jurídica do Pedro) antes de abrir o
Life Pro para qualquer profissional.

Fora desta versão (como a especificação pede): treinadores, cobrança, e-mail
automático (o convite é por link), chat, IA.

**Decidido pelo Pedro em 01/10/2026, depois de testar a prévia:**

- **Etapa 5e. Os dias do plano são da nutricionista.** Ela escolhe os dias
  ao montar o plano (padrão: todos); os dias entram no rascunho e em cada
  versão, e mudar os dias aparece no "o que mudou". O paciente não muda os
  dias do plano. No Diário, num dia do plano, o plano é o padrão; se o dia
  também for de uma dieta do paciente, ele escolhe qual usar, e a escolha
  fica no próprio dia (`dietId` do registro), à vista da profissional no
  acompanhamento (Etapa 6). Vínculo encerrado: o plano sai do Diário e
  fica só para leitura. A aderência conta o que o paciente escolheu.
- **Etapa 8. Treino prescrito.** Um perfil profissional só monta dieta e
  treino, e o nome passa de "nutricionista" a "treinador" no app. Cada
  prescrição de treino é uma rotina (no formato das rotinas do app), com
  versões, "o que mudou" e cópia, como o plano alimentar. Dias da semana
  opcionais: o profissional escolhe ou não; sem dias, o paciente faz quando
  quiser. Registro, uma vez: dieta é atribuição de quem tem CRN e
  prescrição de exercício de quem tem CREF; com um perfil só, o pedido de
  acesso passa a aceitar os dois conselhos, e vale confirmar com a revisão
  jurídica antes de abrir para profissionais.

## 6. Decisões em aberto (com o padrão que vou usar se ninguém mudar)

| Decisão | Padrão (como no protótipo) | Precisa até |
| --- | --- | --- |
| Aprovação manual ou automática | Manual, pelo Pedro | decidido (manual) |
| Onde aparece "Área profissional" no Perfil | Para todo mundo com conta | Etapa 2 |
| Opções do convite já marcadas | Marcadas; o paciente desmarca | Etapa 4 |
| "Dados do perfil" como opção do convite | Sim (idade, altura, objetivo) | Etapa 4 |
| Plano vale para todos os dias ao chegar | Sim; o paciente muda | Etapa 5 |
| Dia que já tem dieta do paciente quando o plano chega | **Decidido pelo Pedro (01/10/2026): vale a dieta dele.** O plano cobre os outros dias, e nada do que ele configurou muda sozinho. Escolher dias para o plano é ato dele: esses dias saem das dietas dele | decidido |
| "O que mudou" na versão nova | Comparação automática + nota da profissional | Etapa 5 |
| Plano depois de encerrar o vínculo | Continua como leitura, sem versões novas | Etapa 4 |
| Água e dia de descanso entram no "Diário" liberado | Sim, como parte do diário | Etapa 6 |

## 7. Andamento

Branch `life-pro`, pull request #1 em rascunho (nada vai para o site publicado
antes de o Life Pro estar completo).

- **Etapa 0, entregue 01/10/2026.** PGlite aplica as migrações num Postgres de
  verdade dentro dos testes (`npm run test:db`, no `verify`). Isolamento entre
  contas nas 12 tabelas e filtro por `user_id` em toda leitura da
  sincronização, os dois vistos vermelhos com a falha provocada.
- **Etapa 1, entregue 01/10/2026.** Migração 0033 aplicada em produção
  (`20261001033701`). A conta lacallepm@gmail.com foi criada e marcada como
  administradora em 01/10/2026, com o `insert into public.app_admins` do fim
  da migração, a pedido do Pedro (o e-mail de confirmação caiu fora da caixa
  de entrada e foi confirmado direto no banco).
- **Etapa 2, entregue 01/10/2026.** No Perfil: "Área profissional" (pedir
  acesso, em análise, não aprovado com motivo, aprovado, suspenso) e, só para
  o administrador, "Administração". Área `/admin` com casca larga
  (`WorkspaceShell`, 1600px): Pedidos com conferência do CRN (Aprovar só liga
  depois da confirmação), Aprovados com detalhes e suspensão em dois toques,
  Histórico. Os pacientes de cada profissional entram nos detalhes com os
  vínculos (Etapa 4). Testes de navegador em 320 a 1600px, nas três
  densidades.
- **Etapas 3 e 4, entregues 01/10/2026.** Migração 0034 aplicada em produção
  (`20261001035939`). `/pro` só para profissional aprovado, na mesma casca da
  administração: Visão geral (só números reais: pacientes ativos e convites
  esperando) e Pacientes (convidar por link, cancelar convite, encerrar
  vínculo). `/convite/[código]`: com conta, escolhe o que libera (já marcado,
  como no protótipo) e aceita; sem conta, entrar ou criar conta volta para o
  convite (`?next=`). Perfil: "Acompanhamento" (mudar o que libera, encerrar
  em dois toques) e "Abrir Life Pro" para quem foi aprovado. Administração:
  pacientes de cada profissional nos detalhes, só o vínculo. Dietas, Evolução
  e Biblioteca entram na navegação do Life Pro com as Etapas 5 e 6.
  Limite conhecido: quem cria conta pelo convite e precisa confirmar o e-mail
  volta para `/hoje` depois da confirmação, e reabre o link do convite.
- **Etapa 5, em andamento.** Banco (migração 0035) aplicado em produção
  (`20261001043336`). Feito do lado da profissional (5a, 01/10/2026): a
  página do paciente (`/pro/pacientes/[id]`, aberta pelo nome em Pacientes),
  com o plano e as versões publicadas; criar plano; o editor de dieta do app
  editando o rascunho no Supabase (`/pro/pacientes/[id]/plano/[planId]`), com
  orientação e outras opções por refeição; publicar versão nova com nota.
  Publicar espera a última edição chegar ao banco, e a ida ao seletor de
  alimentos não perde edição a caminho (os dois vistos vermelhos). O
  cabeçalho do Life Pro no celular passou a rolar com a página, como o do
  app: grudado no topo, cobria a barra de totais do editor (medido).
  Do lado do paciente (5b, 01/10/2026): o plano publicado desce para o
  aparelho numa coleção só de leitura (`prescribedPlans`, IndexedDB v11, fora
  do backup), ao abrir o app e ao abrir Dietas, filtrando por `patient_id`
  (rascunho nunca desce; a profissional não puxa os planos que montou; os
  dois vistos vermelhos). Em Dietas, "Da sua nutricionista" acima de "Suas
  dietas", com "Profissional" e "Atualizado" até o paciente abrir a versão
  nova; o plano abre para leitura (`/dietas/plano/[id]`) com orientação e
  outras opções por refeição; "Fazer uma cópia" vira uma dieta dele.
  Dias e Diário (5c, 01/10/2026): os dias do plano descem de
  `plan_schedules`, e a dieta do dia sai de uma função só (`dietOfDay`),
  usada pelo Diário e pela aderência da Evolução: a dieta da pessoa manda
  nos dias dela (decisão do Pedro), o plano cobre o resto e só a partir do
  dia em que chegou. Em Dietas, o cartão do plano mostra os dias em que ele
  vale de fato; dar dias ao plano grava no servidor e tira esses dias das
  dietas da pessoa. No Diário, "Plano de hoje" e, nas refeições do plano com
  outras opções, "Opção de hoje" (só antes de marcar como comida; sem campo
  novo no registro do dia).
  O que mudou (5c2, 01/10/2026): no cartão do plano com versão nova, o
  aviso "atualizou seu plano" e a folha "O que mudou na versão N", com a
  nota da nutricionista e a comparação automática com a versão anterior
  (refeição nova, saiu, renomeada; alimento que entrou, saiu ou mudou de
  quantidade; orientação; outras opções; total do dia antes e depois). As
  refeições se reconhecem pelo id, não pelo nome. Abrir conta como visto.
  Dias da nutricionista (5e, 01/10/2026; migração 0036): os dias entram no
  rascunho e em cada versão, e o paciente perde `set_plan_schedule`
  (`plan_schedules` fica, sem uso; as versões já publicadas herdaram os dias
  dela). No editor do Life Pro, "Dias do plano" (o seletor de Dietas, sem
  os atalhos de treino, que seriam os da nutricionista). Em Dietas, os dias
  aparecem só para leitura. No Diário, num dia do plano, o plano é o padrão;
  se o dia também for de uma dieta do paciente, "Qual vale hoje?", e a
  escolha fica no dia (`dietId`; um dia com escolha e sem refeição deixou
  de ser apagado, visto vermelho). Vínculo encerrado tira o plano do
  Diário, mas o dia feito por ele continua dele. A Evolução conta o que o
  paciente escolheu, e mudar os dias aparece no "o que mudou". Isso substitui
  a regra da 5c (a dieta da pessoa mandava no dia dela). Mostrar a escolha
  para a profissional fica para o acompanhamento (Etapa 6).
  Biblioteca (5d, 02/10/2026; sem migração, a 0035 já tinha `plan_templates`
  e as funções): "Biblioteca" na navegação do Life Pro, com os modelos em
  cartões (refeições, kcal, data), "Novo modelo", Apagar com confirmação e
  "Usar em paciente". O modelo abre no editor de dieta do app
  (`/pro/biblioteca/[id]`), pelo mesmo repositório em fila do rascunho do
  plano, sem dias e sem publicar. "Usar em paciente" oferece só vínculo
  ativo e cria um plano em rascunho com uma cópia das refeições, com ids
  novos, numa chamada só (`save_plan_draft`); mudar o modelo depois não mexe
  no plano. A Biblioteca mora na composição (`composition/template-repository.ts`),
  porque o Life Pro não importa a dieta. A lista espera a gravação do editor
  ainda a caminho, para não mostrar o modelo de antes. Só modelos de plano
  alimentar: modelo de treino, "Usado em N planos" do protótipo (não há
  registro de qual modelo originou o plano) e "Salvar plano como modelo"
  ficam para depois. Achados na captura, não nos testes, que passaram: o
  título encavalava em "Novo modelo" em 390px e "Usar em paciente" caía
  sozinho numa segunda linha do rodapé; as duas medições entraram no teste
  e foram vistas vermelhas.
- **Etapa 8, em andamento** (protótipo aprovado em 01/10/2026:
  https://claude.ai/artifact/FbMLzGtkhwUdNQVgfUTAkN). 8a, treinador e os dois
  registros (migração 0037): a profissão é uma só, `trainer` (quem já tinha
  pedido ou sido aprovado virou treinador com o CRN que tinha); o pedido
  guarda CREF (`012345-G`, UF) e CRN, cada um opcional, pelo menos um, e o
  banco garante. A administração confere cada registro com o próprio número
  para copiar. Convite e vínculo mostram os registros por uma função só
  (`professional_councils`): juntar região e número dava vazio para quem só
  tem CREF (visto vermelho). No app, "nutricionista" virou "treinador" no que
  o paciente lê, e a Política e os Termos falam de CREF ou CRN. Padrões até o
  Pedro decidir: qualquer registro aprovado libera dieta e treino; "treinador"
  para todos; Hoje só sugere, sem aviso de treino perdido. Acrescentar um
  registro depois da aprovação fica para depois (pede situação por registro).
  8b, o banco do treino (migração 0038): `prescribed_routines`, versões e
  rascunho, com o conteúdo no formato das rotinas do app; dias opcionais
  (sem escolha, nenhum: o paciente faz quando quiser). 8c, o Life Pro: seção
  "Treino" na página do paciente (A, B, C, cada um um treino) e o editor de
  treino do app no rascunho (`routine-draft-repository.ts`), sem "Iniciar
  treino", só com exercícios do catálogo (exercício criado não sincroniza e
  chegaria ao paciente sem foto nem músculo) e com "Dias do treino" abaixo
  do nome. Os dias vão na mesma fila do editor; ler o estado e enfileirar
  com um `await` no meio fazia trocar os dias apagar as edições de antes
  (visto vermelho no teste de banco). Os dias da semana passaram para
  `core/domain/weekday.ts`, porque deixaram de ser só da dieta.
  8d, o paciente: em Treinos, "Do seu treinador" acima de "Seus treinos",
  com "Profissional", versão, dias só para leitura, Iniciar e "Fazer uma
  cópia"; o treino abre só para leitura em `/treinos/prescrito/[id]` e conta
  como visto. Desce pela sincronização como o plano (só pull, coleção
  própria `prescribedRoutines`, IndexedDB versão 12, fora do backup). Iniciar
  é o `startSession` de sempre, e a sessão guarda o id do treino do treinador
  em `routineId` (sem chave estrangeira no banco); a cópia é o
  `duplicateRoutine`, com ids novos. Com o vínculo encerrado, o treino
  continua podendo ser iniciado e copiado, só sem versões novas (padrão até
  o Pedro decidir). Na linha do cartão, os dias ficam na largura deles e os
  botões descem quando não cabem: com `flex-1`, em 320px Confortável, os
  dias viravam uma coluna de um por linha (visto vermelho no teste de
  navegador).
  8e, Hoje: num dia do treino do treinador, sem treino em andamento, feito
  ou descanso marcado, o cartão de Treino sugere ("Treino de hoje · do seu
  treinador", com "Começar", que inicia esse treino, e "Hoje é descanso").
  Nos outros dias, o cartão de sempre diz quando o treino é, ou que está em
  Treinos para quando quiser. Só sugere, sem aviso de treino perdido.
  Acompanhamento encerrado sai do dia, como o plano sai do Diário. Com dois
  treinos no mesmo dia, sugere o publicado mais recente. O dia da semana
  sai de `day` ao meio-dia: `new Date("2026-08-07")` é meia-noite UTC, que
  no Brasil ainda é o dia anterior (visto vermelho). `weekdayOf` passou para
  `core/domain/weekday.ts`.
  8f, o que mudou: no cartão de Treinos, versão nova ainda não aberta ganha
  "Atualizado" e o aviso "atualizou seu treino", com a folha "O que mudou na
  versão N": nota do treinador, dias, exercício que entrou (séries e
  repetições), saiu ou foi trocado na mesma posição ("no lugar de"), séries,
  carga, repetições, RPE, duração, descanso e observação, cada um com o de
  antes riscado. Os exercícios se reconhecem pelo id da posição, como as
  refeições do plano. Séries com metas diferentes entre si não viram um "de,
  para" inventado: "as metas das séries mudaram". A ordem não entra. Abrir
  a folha conta como visto. A seta fica junto do valor novo: com o espaço
  depois do "para" do leitor de tela no fim da linha, a régua de texto
  cortado acusava 12px a mais em 320 e 360px (visto vermelho).
- **Etapa 6, acompanhamento** (protótipo aprovado em 02/10/2026:
  https://claude.ai/artifact/G9aujUmqExhv2V3Hgvr37x, "pode implementar em
  uat"). 6a, banco (migração 0039): "Treinos" é um item novo no que o
  paciente libera (decisão do Pedro), desligado nos vínculos de antes e
  marcado no convite novo; o aceite e a mudança sem o item novo continuam
  funcionando. Leitura só por funções (`pro_patient_sessions`, `_diary`,
  `_body`, `pro_overview`), cada uma conferindo vínculo ativo, treinador
  aprovado e item liberado, sem lápide e sem treino em andamento. 6b, a
  página do paciente ganha as abas Diário, Treinos e Evolução (só com
  vínculo ativo; "não libera" é estado, não erro): em Treinos, os números
  da semana, a semana com os dias prescritos e o prescrito ao lado do
  feito, série por série, com a carga comparada ao treino anterior; no
  Diário, cada refeição do plano por dia, comparada pelo conteúdo (a
  referência que o Diário usa não atravessa a rede); em Evolução, peso e
  medidas. Mora em `composition/follow-up-repository.ts`. 6c, a Visão
  geral: quem treinou e registrou, a lista com último treino, diário e
  peso, e "Precisa de atenção" (parado há 5 dias, contando o dia do aceite;
  menos da metade dos dias do treino na semana). Padrões assumidos: os
  treinos por conta própria aparecem, marcados; só treino finalizado.
  Achados medindo: carga com unidade cortada na coluna da série em 390px,
  a semana em quatro colunas no celular, e as colunas da série espalhadas
  no computador (captura).
- **Modelo de treino na Biblioteca** (migração 0040, `routine_templates`):
  a Biblioteca ganha as abas Planos alimentares e Treinos. O modelo de
  treino abre no editor do treino prescrito (catálogo, sem dias, sem
  iniciar), gravado pela mesma fila do rascunho (a fila virou genérica,
  `queuedRepository`). "Usar em paciente" cria um treino em rascunho, sem
  dias, com cópia de ids novos. "Salvar plano ou treino como modelo" fica
  para depois (padrão).
  Decidido pelo Pedro (01/10/2026): o link do convite fica no endereço do
  Vercel por enquanto. Abrir direto no app (Android App Links) e domínio
  próprio voltam quando houver app publicado e domínio.
  Bug de antes, registrado em 02/10/2026 e não corrigido: em Pacientes, no
  celular, o título fica por baixo de "Adicionar paciente" (390px: 117px de
  texto numa caixa de 61px). É o `PageHeader` compartilhado com um botão
  largo ao lado; a Biblioteca contornou com o botão só de ícone no celular.
  Pendente de antes: `/pro` e `/admin` ainda entram no cache do service
  worker (o risco da seção 4 previa que não). As páginas não levam dado de
  paciente, que só chega pelo navegador, então o risco é baixo, mas a
  promessa da seção 4 ainda não vale.
