# LaCalle Life — Arquitetura Local-First → Cloud Sync

Documento de **desenho**, não de implementação. Nenhuma linha de código deve
sair diretamente dele. O objetivo é responder, com evidência tirada do código
atual, as perguntas que precisam de decisão do Pedro antes de qualquer sprint
de implementação — em especial a pergunta central: **o que acontece quando o
mesmo dado é alterado em dois dispositivos enquanto ambos estão offline.**

Mapeado a partir do estado real do repositório em 2026-08-24 (commit da
auditoria externa + Round 3 de correções, 1132 testes, READY FOR RELEASE).

---

## 1. Por que login sozinho não resolve nada

Hoje cada dispositivo tem seu próprio IndexedDB (`lacalle-life`, versão 7),
completamente isolado:

```
PC                          iPhone
└── IndexedDB                └── IndexedDB
    ├── profile                   ├── profile
    ├── bodyEntries                ├── bodyEntries
    ├── diets                      ├── diets
    ├── foodLogs                   ├── foodLogs
    ├── foods                      ├── foods
    ├── exercises                  ├── exercises
    ├── routines                   ├── routines
    └── sessions                   └── sessions
```

Adicionar só `auth.users` no Supabase dá um UUID compartilhado entre os dois
aparelhos, mas não move um único byte de `bodyEntries` do PC para o iPhone.
**Autenticação identifica a pessoa; sincronização move o dado.** São duas
peças independentes e a segunda é a difícil.

A boa notícia, confirmada lendo o código, é que o local-first atual não foi
construído às pressas — ele já tem, desde o commit original, o gancho que uma
camada de sync precisa:

```ts
// src/core/domain/entity.ts
export interface Entity {
  readonly id: EntityId;
  readonly createdAt: number;
  /** Epoch milliseconds. Rewritten on every mutation. */
  readonly updatedAt: number;
}
```

> `updatedAt` exists today only so that a future sync layer has a
> last-write-wins discriminator without a migration.

E toda escrita já passa por um controle de versão otimista
(`Store.putIfVersionMatches`), usado por **todos os oito repositories**. Isso
significa que o problema "duas escritas concorrentes no mesmo registro" já
tem um mecanismo pensado — falta estendê-lo de "duas abas do mesmo navegador"
para "dois dispositivos diferentes". A seção 8 detalha exatamente onde esse
mecanismo precisa mudar e onde pode ficar como está.

---

## 2. Mapa completo das entidades atuais

Toda entidade estende `Entity` (`id`, `createdAt`, `updatedAt`). A tabela
abaixo é a base para decidir o schema do Postgres.

| Store (IndexedDB) | Tipo raiz | Chave | Quem escreve | Tamanho hoje | Aninha |
|---|---|---|---|---|---|
| `profile` | `Profile` | `"me"` (singleton) | usuário | 1 registro | `NutritionProfile` (sexo, idade, altura, peso, atividade, objetivo, %gordura, ritmo) |
| `bodyEntries` | `BodyEntry` | `day` (`YYYY-MM-DD`) | usuário | 1 por dia, ilimitado | `Measurements` (um número por local de medida) |
| `diets` | `Diet` | UUID | usuário | dezenas | `Meal[]` → `MealItem[]` |
| `foodLogs` | `FoodLog` | `day` (`YYYY-MM-DD`) | usuário | 1 por dia, ilimitado | `Meal[]` → `MealItem[]`, `dietId` (referência não-viva) |
| `foods` | `Food` | UUID (custom) / slug (catálogo) | **misto** — ver §3 | 581 catálogo + N custom | — |
| `exercises` | `Exercise` | UUID (custom) / slug (catálogo) | **misto** — ver §3 | 183 catálogo + N custom | `ExerciseMedia` |
| `routines` | `Routine` | UUID | usuário | dezenas | `RoutineExercise[]` → `PlannedSet[]`, referencia `exerciseId` |
| `sessions` | `Session` | UUID | usuário | ilimitado, cresce para sempre | `SessionExercise[]` → `PerformedSet[]`, referencia `exerciseId`/`routineId` (cópia congelada, não live) |

Pontos que já saltam do código e que importam para o desenho do banco:

- **`Diet`, `Routine`, `Session` são *aggregate roots* documentados como tal**
  — "a diet is saved as one document, so there is no partial-write path".
  O código já decidiu, para o local, que a unidade de escrita é o documento
  inteiro, nunca um item de dentro dele. Isso é uma decisão de domínio, não
  um detalhe do IndexedDB — deve valer também no Postgres (coluna `jsonb`
  para `meals`/`exercises`, não tabelas normalizadas de itens).
- **`Session` é uma fotografia congelada** de `Routine` no momento em que
  começa (deep-copy, IDs novos, sem referência viva). Editar a rotina amanhã
  nunca reescreve o histórico. Isso simplifica sync: sessões finalizadas são
  **essencialmente imutáveis** — o único campo que muda depois de escrito é o
  fechamento (`finishedAt`) e, durante o treino, o preenchimento das séries.
- **`BodyEntry` e `FoodLog` usam o próprio dia como identidade**
  (`id === day`). Duas escritas no mesmo dia já colidem por design — "logging
  again for a day you already logged replaces it". Isso é exatamente o
  cenário do exemplo do Pedro (peso 80/81/82) e é tratado na seção 8.

---

## 3. `foods` e `exercises` não são dados de um usuário só — são dois dados diferentes na mesma caixa

Este é o ponto que mais risco de decisão errada carrega se for ignorado.

Hoje `foods` (581 registros) e `exercises` (183 registros) misturam, na
**mesma store**, duas coisas de natureza completamente diferente:

```ts
// src/features/foods/types/food.ts
export interface Food extends Entity {
  readonly name: string;
  readonly category: FoodCategory;
  readonly per100g: Macros;
  /** Catalogue entries are `false`; foods the user created are `true`. */
  readonly isCustom: boolean;
  /** Marked by the user. */
  readonly isFavorite: boolean;
}
```

- **Catálogo** (`isCustom: false`) — dado de referência, idêntico para todo
  mundo, com IDs determinísticos (`"abdominal-bicicleta"`, não UUID), semeado
  localmente na primeira execução (`seedExerciseCatalogue` / equivalente de
  foods) a partir de um JSON embutido no bundle. **Não pertence a nenhum
  usuário.**
- **`isFavorite`** — um booleano por usuário, aplicado em cima de um registro
  de catálogo que pode ser do catálogo ou custom.
- **Custom** (`isCustom: true`) — criado pelo usuário, esse sim é dado
  pessoal de verdade.

Sincronizar a store `foods`/`exercises` inteira como está hoje replicaria o
catálogo de 581+183 registros por usuário no Postgres — desperdício de
armazenamento e, pior, cria 581 oportunidades de conflito de sync por usuário
toda vez que o catálogo levar um ajuste (ex.: corrigir uma classificação
muscular errada, como o `CLAUDE.md` do projeto já registra ter acontecido).

**Recomendação:** separar conceitualmente em três peças, mesmo mantendo uma
única `Food`/`Exercise` na UI local:

1. **Catálogo** — não vai para tabela por usuário. Fica como está: JSON
   versionado no bundle, semeado localmente. Uma atualização de catálogo é um
   deploy do app, não uma sincronização de usuário.
2. **`user_favorites`** (foods e exercises) — tabela pequena,
   `(user_id, item_id, item_type)`, sincroniza fácil, quase nunca conflita.
3. **`user_custom_foods` / `user_custom_exercises`** — só os registros com
   `isCustom: true`, essas sim tabelas normais com RLS por `user_id`.

A UI e os repositories locais continuam expondo `Food`/`Exercise` como um
tipo único (fazendo o join na leitura), exatamente como fazem hoje — a
mudança fica inteira na camada de sync, sem tocar em `features/foods` ou
`features/workouts` por cima da store.

---

## 4. O que nunca deveria ir para o Postgres

Já excluído do próprio backup/export hoje (`composition/backup.ts` só lê os
oito repositories de domínio) — confirmando que o time já tinha essa
distinção em mente:

| Chave | Onde vive | Por quê fica só local |
|---|---|---|
| `lacalle-life.theme` | `localStorage` | preferência de aparelho, não de conta |
| `lacalle-life.density` | `localStorage` | idem |
| `lacalle-life.training-days` | `localStorage` | preset de atalho, não dado de domínio ("localStorage porque é preferência de aparelho, como o tema") |
| `lacalle-life:exercise-media-revision` | `localStorage` | controle de cache de mídia, reconstrói sozinho |
| Cache Storage (Service Worker) | Cache API | assets estáticos, PWA offline |
| Sessão de treino em progresso (rascunho de UI antes do primeiro save) | memória/React state | nunca deveria existir em dois dispositivos ao mesmo tempo — ver §8.4 |

Nenhuma dessas seis linhas muda com a introdução de sync. Continuam
exatamente como estão.

---

## 5. Modelo conceitual no Postgres (Supabase)

```
auth.users (Supabase Auth)
      │ user_id (uuid)
      ├── profiles            (1:1)
      ├── body_entries        (1:N, chave natural: user_id + day)
      ├── diets               (1:N)
      ├── food_logs           (1:N, chave natural: user_id + day)
      ├── user_custom_foods   (1:N)
      ├── user_food_favorites (1:N, tabela fina)
      ├── user_custom_exercises (1:N)
      ├── user_exercise_favorites (1:N, tabela fina)
      ├── routines            (1:N)
      └── workout_sessions    (1:N, cresce sem limite)
```

Padrão de coluna para toda tabela sincronizável (não só `user_id` — isso o
Pedro já citou certo, mas faltam duas colunas que o RLS sozinho não cobre):

```sql
create table public.diets (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,           -- name, meals, weekdays: o documento inteiro
  client_updated_at bigint not null, -- o updatedAt que já existe hoje, preservado como histórico
  server_updated_at timestamptz not null default now(), -- fonte de verdade para LWW, ver §8
  deleted_at timestamptz,            -- tombstone, ver §9 — nunca DELETE de verdade
  created_at timestamptz not null default now()
);

alter table public.diets enable row level security;

create policy "own diets only"
  on public.diets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

**Por que `payload jsonb` e não colunas normalizadas para `meals`/`items`:**
porque o próprio código já decidiu que o documento inteiro é a unidade
atômica de leitura e escrita ("a diet is saved as one document"). Normalizar
`meals`/`items` em tabelas seria reintroduzir, no Postgres, exatamente a
junção que o design local rejeitou de propósito. `diets`, `routines` e
`workout_sessions` seguem esse padrão de payload único. `profiles` e
`body_entries` são pequenos o bastante para virar colunas de verdade se
preferir consultas SQL diretas (ex.: gráfico de evolução), mas isso é
detalhe de implementação, não decisão de arquitetura.

`body_entries` e `food_logs` usam `(user_id, day)` como chave de conflito
natural — exatamente como o `id` local já é o dia.

---

## 6. Camadas: onde a sincronização entra sem quebrar o que já existe

```
V1 atual                          V1.1 proposta
UI                                 UI
 ↓                                  ↓
Hooks                              Hooks
 ↓                                  ↓
Repositories (interface)          Repositories (mesma interface)
 ↓                                  ↓
LocalXRepository (IndexedDB)      SyncingXRepository
                                    ↙            ↘
                              LocalXRepository   OutboxWriter
                              (IndexedDB,         (fila de mutações
                               fonte de verdade    pendentes +
                               para a UI)          empurra pro Supabase
                                                    quando online)
```

Ponto central, e é o motivo pelo qual vale a pena ter mapeado tudo antes de
escrever: **a interface pública de cada repository (`FoodRepository`,
`DietRepository`, `BodyRepository`...) não muda.** Toda tela, hook e teste
que já existe continua funcionando sem edição, porque a fronteira já era
"fala em termos do domínio, nunca em termos de índice/chave" —
`FoodRepository`'s própria doc-comment já diz isso: "This — not `Store<T>` —
is what a remote backend would implement." O trabalho de sync entra **atrás**
dessa fronteira, num novo tipo de implementação da mesma interface.

A UI nunca espera a rede: todo `save()` grava local primeiro (como hoje) e
devolve; a sincronização acontece depois, em background, e só aparece na
UI se resultar em conflito (reaproveitando a mesma tela "isso foi alterado
em outro lugar, recarregue" que já existe para o Perfil).

---

## 7. Fila de sincronização (outbox) — o mecanismo, não a UI

Uma nona store local, `pendingSync`, guarda o que ainda não subiu:

```ts
interface PendingMutation {
  readonly id: string;           // uuid da própria mutação
  readonly store: StoreName;     // "diets", "bodyEntries", ...
  readonly recordId: EntityId;
  readonly op: "put" | "remove";
  readonly clientUpdatedAt: number; // o updatedAt do registro no momento da escrita
  readonly enqueuedAt: number;
}
```

- **Push:** ao ficar online (evento `online` + tentativa periódica), drena
  `pendingSync` em ordem, um `upsert` por mutação, condicionado ao
  `server_updated_at` que o cliente lembra de ter lido por último — o mesmo
  contrato de `putIfVersionMatches`, agora contra uma tabela remota em vez de
  uma store local.
- **Pull:** por tabela, guarda um cursor local (`syncState.lastPulledAt`) e
  pede ao Supabase `where server_updated_at > lastPulledAt` — ou usa Supabase
  Realtime para não precisar de polling. Registros vindos do pull escrevem
  direto no IndexedDB local (sem passar pela fila de novo, para não
  reenviar o que acabou de chegar).
- **Falha de push por conflito:** a mutação sai da fila e vira um evento de
  conflito local, tratado pela mesma UX que o Perfil já tem.

---

## 8. O problema central: mesmo dado, dois dispositivos, ambos offline

O exemplo do Pedro é exatamente o teste certo:

```
PC (offline):      peso 80 → 82
iPhone (offline):  peso 80 → 81
                        ↓
              os dois voltam a ficar online
```

Não existe uma resposta única — depende do tipo de entidade, e o código
atual já separa essas entidades em duas famílias por como cada uma trata
concorrência hoje:

### 8.1 Famílias de entidade e a regra recomendada para cada uma

| Entidade | Cenário real de conflito | Regra recomendada |
|---|---|---|
| `Profile` | dois dispositivos editam peso/altura/objetivo offline | **Conflito visível.** É a mesma tela que já existe hoje entre abas — só troca "outra aba" por "outro dispositivo" na mensagem. Perfil é editado raramente; interromper e perguntar é barato e correto. |
| `BodyEntry` (peso do dia) | exatamente o exemplo do Pedro: 80→82 no PC, 80→81 no iPhone, mesmo dia, ambos offline | **Este é o caso que meas justifica pensar duas vezes.** Ver §8.2 abaixo — não adotar LWW cego. |
| `Diet` / `Routine` | edição estrutural (reordenar refeições, trocar exercício) em dois lugares | **Conflito visível**, documento inteiro. Raro na prática — planos não são editados em paralelo em dois aparelhos no mesmo minuto. |
| `FoodLog` | registrar refeições do mesmo dia em dois dispositivos (cenário real e **frequente** — alguém loga o almoço no celular no restaurante e depois abre o PC à noite) | **Nunca pode ser last-write-wins do documento inteiro** — perderia uma refeição real. Ver §8.3. |
| `Session` | treino iniciado em um aparelho, nunca deveria continuar em outro | **Não sincroniza enquanto `finishedAt === null`.** Ver §8.4. |
| `Food`/`Exercise` custom | criar o "Bolo da vó" em dois aparelhos com nomes diferentes | **Sem conflito real** — são criações novas com UUIDs diferentes, os dois sobrevivem. Duplicata visual é um problema de produto (deixar o usuário mesclar depois), não de dado perdido. |

### 8.2 `BodyEntry` — resposta direta à pergunta do Pedro

Peso é o caso mais simples de errar por parecer o mais simples de acertar.
Duas opções reais:

- **(A) Last-write-wins pelo relógio do servidor.** Simples, mas **descarta
  silenciosamente uma medição real** — a pessoa pesou 82 no PC de manhã e
  81 no celular à noite; os dois são fatos verdadeiros sobre dias diferentes
  de vida, mesmo carimbados no mesmo `day`. Perder um sem avisar é o tipo de
  bug que mina confiança no produto inteiro (o mesmo motivo que already
  levou a `sumMacros` a nunca inventar um zero silencioso).
- **(B) Conflito visível, mesma UX do Perfil.** Ao sincronizar, se o servidor
  tem uma versão mais nova que a base que o dispositivo tinha quando editou
  offline, a mutação pendente entra em `CONFLICT` em vez de sobrescrever. O
  app mostra "peso deste dia mudou em outro lugar — usar 82 (este aparelho)
  ou 81 (sincronizado)?" — **duas opções, nunca um merge automático de
  número**, porque não existe uma forma correta de "mesclar" dois pesos.

**Recomendação: (B) para tudo, sem exceção — inclusive peso.** A diferença
de esforço entre A e B é pequena (o mecanismo de conflito já existe, é só
estendê-lo para chegar por sync e não só por outra aba), e o custo de A dar
errado uma vez ("por que meu peso de terça sumiu?") é maior que o custo de B
pedir uma escolha ocasional. Isso também mantém consistência: **uma única
regra de conflito ("nunca sobrescreve silenciosamente, sempre pergunta") em
vez de uma tabela de exceções por entidade** que alguém vai esquecer de
aplicar corretamente na próxima feature.

### 8.3 `FoodLog` — por que é diferente de `BodyEntry`

Mesmo `id === day`, mas o conteúdo é uma lista de refeições, não um número.
Registrar o almoço no celular e o jantar no PC no mesmo dia, ambos offline,
**não é um conflito de verdade** — são duas adições à mesma lista. Tratar
como (B) do jeito que está (documento inteiro, escolher um lado) perderia
uma refeição real de qualquer forma que o usuário escolhesse.

Isso é o único lugar deste desenho em que um merge automático estruturado
(por `Meal.id`, que já é um UUID estável) é defensável: unir as duas listas
de refeições por id, e só cair no conflito visível se a **mesma refeição**
(mesmo `Meal.id`) foi editada nos dois lados — cenário raro, já que cada
refeição normalmente é criada uma vez e não retocada depois de registrada.
Vale nomear isso como exceção explícita e não generalizar para `Diet`
(plano) nem `Routine` — só `FoodLog`, porque só ali "duas adições
independentes no mesmo dia" é o caso comum, não o raro.

### 8.4 `Session` — o jeito mais barato de eliminar conflito é não ter conflito

Uma sessão em progresso não tem por que existir em dois dispositivos ao
mesmo tempo — ninguém está no meio de um treino no PC e no celular
simultaneamente. Regra proposta: **sessões só entram na fila de
sincronização quando `finishedAt !== null`.** Enquanto em progresso, ficam
locais ao dispositivo que a iniciou. Isso elimina de saída a classe inteira
de conflito "duas séries registradas na mesma sessão em dois aparelhos",
sem nenhuma lógica de merge — o comportamento que `findInProgress()` já
assume (uma sessão em progresso por vez) simplesmente se estende a "por
dispositivo" em vez de "por conta".

### 8.5 O relógio do cliente não é confiável entre dispositivos

`entityTimestamp()` hoje é monotônico **dentro de um processo** — resolve
duas escritas na mesma aba na mesma milissegundo, mas dois relógios de
sistema diferentes (PC e iPhone) podem estar dessincronizados por segundos
ou minutos sem que ninguém perceba. **`server_updated_at`, carimbado pelo
Postgres no momento em que a escrita chega, precisa ser a única fonte de
verdade para decidir ordem e para o cursor de pull incremental.** O
`client_updated_at` (o `updatedAt` de hoje) continua existindo no payload
como histórico e para o `putIfVersionMatches` local, mas nunca decide quem
ganha entre dois dispositivos.

---

## 9. Exclusão precisa virar tombstone

Hoje `remove(id)` apaga de vez, local. Num mundo com dois dispositivos, um
`DELETE` de verdade no Postgres nunca chega ao outro dispositivo — na
próxima sincronização, o registro que ainda existe localmente lá seria
**reenviado e reviveria** o que foi apagado. Toda tabela sincronizável
precisa de `deleted_at timestamptz`, nunca um `DELETE` físico; o pull inclui
registros com `deleted_at` preenchido para que o outro lado também remova
localmente. Limpeza física definitiva (GDPR-like) só acontece em exclusão de
conta (§12), não em uso normal.

---

## 10. Migração dos dados que já existem

O app já está em produção, 100% local, sem `user_id`. Dois cenários reais:

1. **Uma pessoa com dados em um só dispositivo cria conta.** Primeira
   sincronização é um push completo e sem ambiguidade: tudo que está no
   IndexedDB local passa a pertencer ao `user_id` novo.
2. **Uma pessoa já usa o app em dois dispositivos sem conta (o caso mais
   delicado) e cria conta em um deles, depois entra com a mesma conta no
   outro.** O segundo dispositivo, ao logar, encontra dados locais
   pré-existentes **e** dados vindos do servidor que não são os mesmos.
   Isso não é um conflito de sincronização normal (não há uma base comum
   anterior) — é uma decisão de produto que precisa de tela própria: **"Este
   aparelho já tem dados do LaCalle Life. Você quer mesclar com o que está
   na sua conta, ou continuar só com o que está na nuvem?"** Nunca decidir
   isso silenciosamente nos dois sentidos possíveis (nem descartar o local,
   nem descartar o da nuvem).

---

## 11. Backup/import continuam existindo, sem regressão

Backup/export local (`composition/backup.ts`) não é substituído por sync —
continua sendo a rede de segurança para quem não quer conta e a forma de
portar dados manualmente. Duas integrações precisam de decisão, não de
código ainda:

- **Importar um backup estando logado:** substitui só o local, só a nuvem,
  ou os dois? Recomendação: mesma pergunta explícita do §10 — nunca
  silencioso quando existe uma base remota com histórico próprio.
- **Exportar continua lendo os mesmos oito repositories locais**, agora
  possivelmente alimentados pela camada de sync — nenhuma mudança na forma
  do arquivo `.json` é necessária.

---

## 12. Logout e exclusão de conta

- **Logout:** por padrão **mantém** o IndexedDB local (mesmo comportamento
  offline-first de hoje continua funcionando sem conta ativa). "Esquecer
  este dispositivo" continua existindo como ação **separada e explícita**
  (já implementada, `composition/forget-device.ts`) — logout não aciona isso
  sozinho.
- **Exclusão de conta:** apaga no Supabase (cascade via `on delete cascade`
  em `user_id`) e, no dispositivo que pediu a exclusão, aciona o mesmo
  `forgetDevice()` que já existe. Outros dispositivos ainda logados
  descobrem a exclusão na próxima tentativa de sincronizar (erro de auth) e
  devem então oferecer o mesmo `forgetDevice()` local.

---

## 13. Signup / login / reset de senha

Via Supabase Auth diretamente — nada disso é decisão de arquitetura de dados
e não há motivo para reinventar. Fica fora de escopo deste documento; entra
no desenho de UI quando a Sprint de implementação chegar lá.

---

## 14. Fora de escopo do V1 de sync (para não crescer sem controle)

- Colaboração em tempo real (duas pessoas vendo o mesmo dado ao vivo) —
  este produto é de uso individual, não precisa de presença nem de
  operational transform.
- Merge campo-a-campo dentro de um documento (`Diet`, `Routine`) além do
  caso já nomeado de `FoodLog` (§8.3) — documento inteiro ou conflito
  visível, ponto.
- Compartilhar exercícios/alimentos customizados entre usuários.
- Qualquer sincronização de `Session` em progresso entre dispositivos (§8.4
  já decide isso: não sincroniza até terminar).

---

## 15. Perguntas — fechadas em 24/08/2026, ver §17

1. **Confirma a regra de conflito por família de entidade (§8.1)?** Em
   especial: concorda em tratar `BodyEntry` com conflito visível em vez de
   last-write-wins silencioso, mesmo sendo "só um número"?
2. **Confirma o merge estruturado por `Meal.id` só para `FoodLog` (§8.3)** e
   não para `Diet`/`Routine`?
3. **Confirma que `Session` em progresso não sincroniza até `finishedAt`
   (§8.4)?**
4. **Catálogo de foods/exercises fica fora da sincronização por usuário
   (§3)** — só favoritos e customizados sincronizam?
5. **Cenário de migração com dois dispositivos já divergentes antes de
   existir conta (§10, caso 2)** — a tela de escolha explícita é aceitável,
   ou existe uma preferência de produto diferente?
6. **Importar backup estando logado (§11)** — qual o comportamento padrão
   esperado?

Nenhuma dessas é uma pergunta técnica — são decisões de produto que mudam o
comportamento que a pessoa vê. Respondidas em §17 depois do aval do Pedro em
24/08/2026 à direção geral do documento; o schema de §18 já é desenhado em
cima dessas respostas, não das recomendações em aberto.

---

## 16. Sequência de sprints sugerida (desenho, sem código)

1. **Sprint de arquitetura (concluída, 24/08/2026):** mapeamento de
   entidades, regra de conflito por família, decisões de escopo.
2. **Sprint de decisão (concluída, 24/08/2026):** ver §17 — as seis
   perguntas de §15 estão fechadas.
3. **Sprint de schema (concluída nesta rodada, ver §18):** DDL completo do
   Postgres + RLS + índices + funções de escrita condicional — desenho
   revisável, ainda **nenhum arquivo de migration real criado no projeto e
   nenhum código de app tocado.**
4. **Próxima sprint — auth:** Supabase Auth isolado, sem tocar em dados de
   domínio ainda (login/signup/logout funcionando, `user_id` disponível).
   Só começa depois que o schema de §18 for revisado e aprovado como está,
   ou ajustado.
5. **Sprint de outbox + push:** fila de mutações pendentes e push
   condicional, uma entidade por vez, começando pela mais simples
   (`Profile`, que já tem toda a UX de conflito pronta).
6. **Sprint de pull + merge:** trazer dados do servidor, aplicar a regra de
   conflito por família definida em §8.
7. **Sprint de migração:** fluxo de primeira sincronização e o caso de dois
   dispositivos divergentes (§10).
8. **Sprint de auditoria:** repetir o mesmo rigor do Round 3 anterior — agora
   testando explicitamente cenários offline/offline/reconecta, não só
   duas-abas-do-mesmo-navegador.

---

## 17. Especificação fechada — respostas às seis perguntas de §15

Fechadas em 24/08/2026, depois de o Pedro validar a direção geral do
documento (Supabase Auth + Postgres como fonte compartilhada, IndexedDB
nunca removido, catálogo fora da sincronização por usuário). O schema em
§18 já reflete estas seis respostas — não as alternativas descartadas.

**1. Regra de conflito por família (§8.1) — confirmada como está.**
`Profile`, `Diet`, `Routine` e `BodyEntry` sempre em conflito visível,
documento inteiro, nunca last-write-wins silencioso — inclusive peso, pelo
motivo já registrado em §8.2: uma única regra sem exceção por "isso é só um
número" é mais fácil de manter correta do que uma tabela de casos especiais.

**2. Merge por `Meal.id` — confirmado, só para `FoodLog`.** `Diet` e
`Routine` continuam documento inteiro. Nenhuma outra entidade ganha merge
estruturado no V1.

**3. `Session` não sincroniza em progresso — confirmado.** Só entra na fila
de sincronização quando `finishedAt !== null`. Isso também define uma regra
de schema: `workout_sessions.finished_at` é a coluna que o outbox local
verifica antes de sequer tentar enfileirar uma mutação de sessão.

**4. Catálogo fora da sincronização — confirmado.** `foods` e `exercises`
com `isCustom: false` nunca viram linha em tabela por usuário. O schema de
§18 não tem tabela `foods`/`exercises` nenhuma — só `user_custom_foods`,
`user_custom_exercises`, `user_food_favorites` e `user_exercise_favorites`.

**5. Migração com dois dispositivos já divergentes (§10, caso 2) — decisão
fechada:** tela de escolha explícita, sem default silencioso em nenhuma
direção, com **mesclar como opção recomendada e destacada**, não as duas
opções em pé de igualdade. Motivo: descartar dados é a única ação
irreversível das duas, então a UI não deve tratá-la como equivalente a
mesclar. Mecanismo: no primeiro login de um dispositivo que já tem dado
local, se a conta já tem dados remotos, a mesclagem aplica a mesma regra de
conflito por família do item 1 — um "primeiro sync" nada mais é que aplicar
§8 a cada registro que existe dos dois lados, uma única vez em lote, em vez
de inventar uma lógica de mesclagem paralela.

**6. Importar backup estando logado — decisão fechada:** o import continua
substituindo **o local** exatamente como hoje (nenhuma mudança na tela ou no
aviso existente — "substitui completamente, não soma, não mescla"), e o
resultado dessa substituição entra na fila de sincronização como qualquer
outra mutação local, registro por registro. Ou seja: **não existe um modo
especial de "importar para a nuvem"** — importar é uma escrita local grande,
e a nuvem recebe o que sempre recebe de uma escrita local: cada registro
tentando sincronizar com a regra de conflito da sua família. Um import que
colide com dado mais novo no servidor gera os mesmos conflitos visíveis que
qualquer outra edição geraria, um por registro — não um bloqueio único na
tela de import.

---

## 18. Schema PostgreSQL completo (Supabase)

DDL de referência para a Sprint de Schema. **Não é migration pronta para
rodar** — é o desenho a ser revisado, versionado como
`supabase/migrations/NNNN_*.sql` só depois de aprovado, seguindo a mesma
regra de "append only, nunca editar uma entrada já liberada" que
`composition/migrations.ts` já usa para o IndexedDB local.

### 18.1 Convenções que valem para toda tabela sincronizável

- `id uuid primary key` para agregados com UUID local (`diets`, `routines`,
  `workout_sessions`, `user_custom_foods`, `user_custom_exercises`) — o
  mesmo UUID que `crypto.randomUUID()` já gera no cliente, sem tradução.
- `primary key (user_id, day)` para as duas entidades cuja identidade local
  já é o dia (`body_entries`, `food_logs`) — nenhuma coluna `id` extra.
- `payload jsonb not null` para o corpo do agregado, espelhando a decisão já
  tomada localmente de que o documento inteiro é a unidade de escrita (§5).
- `client_updated_at bigint not null` — o `updatedAt` que já existe hoje,
  preservado como histórico e para o `putIfVersionMatches` local. **Nunca
  usado para arbitrar conflito entre dispositivos** (§8.5).
- `server_updated_at timestamptz not null default now()` — carimbado por
  trigger, nunca aceito como valor vindo do cliente (§18.3). É o único
  árbitro de ordem e o cursor de sincronização incremental.
- `deleted_at timestamptz` — tombstone (§9). Nenhuma tabela de domínio tem
  política de `DELETE` real; apagar é sempre um `UPDATE` que preenche esta
  coluna.
- `created_at timestamptz not null default now()`.
- RLS habilitado, mesma política nas quatro operações: `auth.uid() =
  user_id`.

```sql
create or replace function public.set_server_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.server_updated_at := now();
  return new;
end;
$$;
```
Uma função só, reaproveitada num trigger `before insert or update` por
tabela — repetida em cada `create trigger` abaixo, não recriada.

### 18.2 Tabelas

```sql
-- Perfil: singleton por usuário, tal como PROFILE_ID = "me" localmente.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,              -- NutritionProfile inteiro
  client_updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Evolução corporal: id local já é o dia.
create table public.body_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  weight_kg numeric,
  body_fat_percent numeric,
  measurements jsonb not null default '{}'::jsonb,
  notes text not null default '',
  client_updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- Dietas: aggregate root, documento inteiro.
create table public.diets (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,              -- { name, meals, weekdays }
  client_updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index diets_user_sync_idx on public.diets (user_id, server_updated_at);

-- Diário: id local já é o dia. Único com merge estruturado (§8.3, §17.2) —
-- o motor de sync lê `payload->'meals'` para o merge por Meal.id, não o SQL.
create table public.food_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  payload jsonb not null,              -- { meals, dietId }
  client_updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- Rotinas: aggregate root, documento inteiro.
create table public.routines (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,              -- { name, notes, exercises }
  client_updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index routines_user_sync_idx on public.routines (user_id, server_updated_at);

-- Sessões: só sincroniza com finished_at preenchido (§17.3).
-- routine_id é referência solta (cópia congelada) — sem FK de propósito,
-- igual ao Session.routineId local ("deliberately not a live link").
create table public.workout_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid,
  name text not null,
  started_at bigint not null,
  finished_at bigint,
  payload jsonb not null,              -- { exercises }
  client_updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index sessions_user_started_idx on public.workout_sessions (user_id, started_at desc);
create index sessions_user_sync_idx on public.workout_sessions (user_id, server_updated_at);

-- Alimentos e exercícios personalizados — nunca o catálogo (§17.4).
create table public.user_custom_foods (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,              -- { name, category, per100g }
  client_updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.user_custom_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,              -- todos os campos de Exercise exceto isCustom/isFavorite
  client_updated_at bigint not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- Favoritos: sem tombstone de propósito — ver §18.4.
-- food_id/exercise_id aceita tanto slug de catálogo ("abdominal-bicicleta")
-- quanto uuid de user_custom_*, por isso `text` e não `uuid`.
create table public.user_food_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  food_id text not null,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

create table public.user_exercise_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);
```

### 18.3 RLS — mesma política em toda tabela, sem política de `DELETE`

```sql
alter table public.diets enable row level security;

create policy "diets_select_own" on public.diets
  for select using (auth.uid() = user_id);

create policy "diets_insert_own" on public.diets
  for insert with check (auth.uid() = user_id);

create policy "diets_update_own" on public.diets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger diets_set_server_updated_at
  before insert or update on public.diets
  for each row execute function public.set_server_updated_at();
```

Repetir para `body_entries`, `food_logs`, `routines`, `workout_sessions`,
`profiles`, `user_custom_foods`, `user_custom_exercises` (com política
própria de `delete` só nas duas de favoritos, ver §18.4).

**De propósito, não existe política de `for delete`** nas tabelas com
tombstone. Um cliente não pode fisicamente apagar uma linha — só pode dar
`UPDATE ... set deleted_at = now()`, que a política de `update` já cobre.
Apagar de verdade só acontece via `service_role` (fora do RLS), acionado
pelo processo de exclusão de conta (§12) ou por uma limpeza periódica de
tombstones antigos — nenhum dos dois é uma chamada que o app faz direto.

### 18.4 Por que `user_food_favorites`/`user_exercise_favorites` não têm tombstone

Única exceção deliberada à regra de §9. Um favorito é um booleano puro sem
valor autoral: perder silenciosamente um "isso ficou favoritado de novo"
por causa de uma corrida rara entre dois dispositivos não apaga histórico
de ninguém — o pior caso é reabrir a lista de favoritos e favoritar de
novo. Diferente de perder uma medição de peso ou uma refeição registrada,
que são fatos que aconteceram e não voltam. Por isso essas duas tabelas
usam `insert ... on conflict do nothing` para favoritar e `delete` de
verdade para desfavoritar, sem fila de conflito nenhuma — o único par de
tabelas em todo o schema com essa simplicidade, e é importante que
continue sendo exceção rara, não o padrão que a próxima tabela copia sem
pensar.

### 18.5 Escrita condicional — a versão em Postgres de `putIfVersionMatches`

O outbox local não fala SQL cru; chama uma função RPC por entidade, que faz
o mesmo "ler, comparar, escrever" atômico que `Store.putIfVersionMatches`
já faz localmente — só que comparando contra `server_updated_at` em vez de
`updatedAt` (§8.5). Esboço para `diets`, o mesmo formato vale para as
outras tabelas com `payload`:

```sql
create or replace function public.save_diet(
  p_id uuid,
  p_payload jsonb,
  p_client_updated_at bigint,
  p_expected_server_updated_at timestamptz -- null = criação
) returns table (server_updated_at timestamptz)
language plpgsql
security invoker
as $$
begin
  if p_expected_server_updated_at is null then
    insert into public.diets (id, user_id, payload, client_updated_at)
    values (p_id, auth.uid(), p_payload, p_client_updated_at)
    on conflict (id) do nothing;
  else
    update public.diets
    set payload = p_payload,
        client_updated_at = p_client_updated_at,
        deleted_at = null
    where id = p_id
      and user_id = auth.uid()
      and server_updated_at = p_expected_server_updated_at;
  end if;

  return query
    select d.server_updated_at from public.diets d
    where d.id = p_id and d.user_id = auth.uid();
end;
$$;
```

Zero linhas afetadas pelo `insert`/`update` (mas a linha existe com outro
`server_updated_at`) é exatamente o mesmo sinal de conflito que
`VersionedWriteResult.ok === false` já usa localmente — o motor de sync lê
o `server_updated_at` retornado, compara com o que esperava, e se
divergiu, é o gatilho para a UI de conflito da §8. **Este é um esboço para
revisão na Sprint de Schema, não uma função pronta para aplicar** — falta,
por exemplo, decidir se o merge por `Meal.id` de `food_logs` (§17.2)
acontece dentro de uma função equivalente no Postgres ou inteiramente no
cliente antes de chamar uma função "burra" igual a esta.

### 18.6 Cursor de sincronização — não é uma tabela do Postgres

O cursor por tabela (`syncState.lastPulledAt`, um por store) vive **no
IndexedDB local**, não no servidor — cada dispositivo lembra até onde já
puxou, o servidor não precisa saber quem puxou o quê. Uma nona store local
(§7, `pendingSync`) mais uma décima (`syncState`) são as duas únicas
adições ao schema local do IndexedDB que a sincronização exige; nenhuma das
oito stores de domínio muda de forma.
