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

## 6. Decisões em aberto (com o padrão que vou usar se ninguém mudar)

| Decisão | Padrão (como no protótipo) | Precisa até |
| --- | --- | --- |
| Aprovação manual ou automática | Manual, pelo Pedro | decidido (manual) |
| Onde aparece "Área profissional" no Perfil | Para todo mundo com conta | Etapa 2 |
| Opções do convite já marcadas | Marcadas; o paciente desmarca | Etapa 4 |
| "Dados do perfil" como opção do convite | Sim (idade, altura, objetivo) | Etapa 4 |
| Plano vale para todos os dias ao chegar | Sim; o paciente muda | Etapa 5 |
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
  (`20261001033701`). A conta lacallepm@gmail.com **ainda não existe**: quando
  o Pedro se cadastrar, rodar o `insert into public.app_admins` do fim da
  migração (com confirmação).
- **Etapa 2, entregue 01/10/2026.** No Perfil: "Área profissional" (pedir
  acesso, em análise, não aprovado com motivo, aprovado, suspenso) e, só para
  o administrador, "Administração". Área `/admin` com casca larga
  (`WorkspaceShell`, 1600px): Pedidos com conferência do CRN (Aprovar só liga
  depois da confirmação), Aprovados com detalhes e suspensão em dois toques,
  Histórico. Os pacientes de cada profissional entram nos detalhes com os
  vínculos (Etapa 4). Testes de navegador em 320 a 1600px, nas três
  densidades.
