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

**Corrigido depois da revisão adversarial de §19 — a versão original deste
documento permitia UPDATE direto de tabela sem checar `server_updated_at`,
o que quebrava a garantia de "nunca sobrescreve silenciosamente" toda vez
que alguém (código ou pessoa) chamasse a tabela em vez da função RPC.** A
correção: **só a função RPC pode escrever.** RLS continua sendo a fronteira
de propriedade (quem é dono da linha), mas o `authenticated` não recebe
`INSERT`/`UPDATE` direto na tabela — só `EXECUTE` na função, que é onde o
`server_updated_at` esperado é de fato comparado. Ver §19.1 para o raciocínio
completo.

```sql
alter table public.diets enable row level security;

-- SELECT continua liberado direto na tabela — ler não tem o problema do
-- OCC, só INSERT/UPDATE precisam ser forçados a passar pela função.
create policy "diets_select_own" on public.diets
  for select using (auth.uid() = user_id);

-- Nenhuma política de INSERT nem de UPDATE aqui de propósito — ver abaixo.
-- Sem política, o RLS nega por padrão; a única porta de escrita é a função
-- `save_diet` (§18.5), que roda `security definer` e escreve por dentro
-- dela mesma, já validado.

revoke insert, update on public.diets from authenticated;
revoke insert, update on public.diets from anon;
-- select continua concedido — a política acima decide o que cada um vê.

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

**Corrigido depois de §19.1: `security definer`, não `security invoker`.**
Com `invoker`, a função roda com os privilégios de quem chama — e como
§18.3 revogou `INSERT`/`UPDATE` direto de `authenticated` na tabela, uma
função `invoker` ficaria travada pela própria revogação que existe para
protegê-la. `definer` roda com os privilégios de quem **criou** a função
(o dono, fora do alcance do `REVOKE` de §18.3), o que é exatamente o ponto:
esta função é a única porta de escrita.

Isso troca um risco por outro — `security definer` é o jeito clássico de
introduzir escalonamento de privilégio no Postgres se a função confiar em
qualquer coisa que o chamador possa manipular. Duas regras não-negociáveis
nela, não só nesta como em toda função `definer` deste schema:

1. **Nunca aceitar `user_id` como parâmetro.** Sempre `auth.uid()` lido de
   dentro da função — um parâmetro seria o chamador dizendo de quem são os
   dados, e a função confiando cegamente.
2. **`set search_path = public` fixo na declaração da função — sem
   `pg_temp`.** Corrigido depois de §19.10: a primeira versão deste
   documento incluía `pg_temp` no `search_path`, que é o próprio vetor de
   sequestro que a regra existe para evitar — `pg_temp` é o schema
   temporário **do chamador**, e um chamador malicioso pode criar uma
   tabela temporária chamada `diets` nele antes de invocar a função. Toda
   referência de tabela no corpo da função já é escrita como
   `public.diets` (nunca `diets` sozinho), o que neutraliza o sequestro
   mesmo com `pg_temp` no caminho — mas depender de "sempre qualificamos
   por engano certo" é pior que remover o vetor de propósito. `public`
   sozinho fecha isso sem depender de disciplina de quem editar a função
   depois.

O outbox local não fala SQL cru; chama uma função RPC por entidade, que faz
o mesmo "ler, comparar, escrever" atômico que `Store.putIfVersionMatches`
já faz localmente — só que comparando contra `server_updated_at` em vez de
`updatedAt` (§8.5). Esboço para `diets`, o mesmo formato vale para as
outras tabelas com `payload` e chave UUID:

```sql
create or replace function public.save_diet(
  p_id uuid,
  p_payload jsonb,
  p_client_updated_at bigint,
  p_expected_server_updated_at timestamptz -- null = criação
) returns table (server_updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_expected_server_updated_at is null then
    insert into public.diets (id, user_id, payload, client_updated_at)
    values (p_id, v_uid, p_payload, p_client_updated_at)
    on conflict (id) do nothing;
  else
    update public.diets
    set payload = p_payload,
        client_updated_at = p_client_updated_at,
        deleted_at = null
    where id = p_id
      and user_id = v_uid
      and server_updated_at = p_expected_server_updated_at;
  end if;

  return query
    select d.server_updated_at from public.diets d
    where d.id = p_id and d.user_id = v_uid;
end;
$$;

revoke execute on function public.save_diet from public;
revoke execute on function public.save_diet from anon;
grant execute on function public.save_diet to authenticated;

-- A mesma exclusão de verdade, com o mesmo guarda de versão — nunca um
-- DELETE incondicional (§19.2). Reaproveita o parâmetro de versão
-- esperada; sem isso, o dispositivo A poderia apagar por cima de uma
-- edição do B sem passar pelo conflito visível.
create or replace function public.delete_diet(
  p_id uuid,
  p_expected_server_updated_at timestamptz
) returns table (server_updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  update public.diets
  set deleted_at = now()
  where id = p_id
    and user_id = v_uid
    and server_updated_at = p_expected_server_updated_at;

  return query
    select d.server_updated_at from public.diets d
    where d.id = p_id and d.user_id = v_uid;
end;
$$;

revoke execute on function public.delete_diet from public;
revoke execute on function public.delete_diet from anon;
grant execute on function public.delete_diet to authenticated;
```

Zero linhas afetadas pelo `insert`/`update`/`delete` (mas a linha existe
com outro `server_updated_at`) é exatamente o mesmo sinal de conflito que
`VersionedWriteResult.ok === false` já usa localmente — o motor de sync lê
o `server_updated_at` retornado, compara com o que esperava, e se
divergiu, é o gatilho para a UI de conflito da §8.

**Este é um esboço para revisão na Sprint de Schema, não uma função pronta
para aplicar** — falta, por exemplo, decidir se o merge por `Meal.id` de
`food_logs` (§17.2) acontece dentro de uma função equivalente no Postgres
ou inteiramente no cliente antes de chamar uma função "burra" igual a esta
(recomendação em §19.5: no cliente, a função no banco continua burra).

Toda tabela `payload` com chave UUID (`diets`, `routines`,
`workout_sessions`, `user_custom_foods`, `user_custom_exercises`) recebe o
mesmo par `save_*`/`delete_*`. As duas de chave composta (`profiles` por
`user_id` sozinho, `body_entries`/`food_logs` por `user_id, day`) seguem o
mesmo formato trocando o `where id = p_id` por `where day = p_day` — sem
`on conflict (id)`, usa `on conflict (user_id, day)`.

### 18.6 Cursor de sincronização — não é uma tabela do Postgres

O cursor por tabela (`syncState.lastPulledAt`, um por store) vive **no
IndexedDB local**, não no servidor — cada dispositivo lembra até onde já
puxou, o servidor não precisa saber quem puxou o quê. Uma nona store local
(§7, `pendingSync`) mais uma décima (`syncState`) são as duas únicas
adições ao schema local do IndexedDB que a sincronização exige; nenhuma das
oito stores de domínio muda de forma.

---

## 19. Revisão adversarial do §18 — 24/08/2026

Feita para quebrar o schema, não para confirmá-lo. **Veredito: não
aprovado como estava escrito.** Um achado estrutural real (§19.1) já foi
corrigido diretamente em §18.3/§18.5 acima — as duas seções já refletem a
versão corrigida, não a original. Os demais são precisão que faltava ou
limitações a aceitar de olhos abertos, não bugs de segurança.

### 19.1 P0 — RLS de `UPDATE` sozinho não impõe o OCC. Corrigido.

Este é o achado que teria passado despercebido se a régua fosse só "RLS
habilitado, `auth.uid() = user_id` em toda política" — exatamente o ponto
cego que você citou.

A versão original de §18.3 tinha uma política `for update using (auth.uid()
= user_id) with check (auth.uid() = user_id)` **direta na tabela**, ao lado
da função `save_diet`. RLS de UPDATE só verifica **propriedade** — quem é
dono da linha — nunca o conteúdo da escrita. Isso significa que qualquer
chamada `supabase.from('diets').update({payload}).eq('id', x)` feita
**fora** da função RPC teria sucesso, sobrescrevendo o `payload` sem
nenhuma checagem de `server_updated_at`. O dono da linha sempre pode
atualizar sua própria linha via RLS — a proteção contra sobrescrita
concorrente não é responsabilidade do RLS, é responsabilidade exclusiva da
função `save_*`, e a política de UPDATE direta na tabela dava um caminho
que ignorava a função inteiramente.

Consequência prática, se isso não fosse corrigido: um bug no motor de sync
(chamar `.from().update()` em vez do RPC por engano, um dia de pressa) ou
uma chamada direta via API do Supabase reintroduziria exatamente o
last-write-wins silencioso que §17.1 promete que nunca vai acontecer — e o
schema, sozinho, não impediria. **Um schema "bonito" com RLS habilitado em
toda tabela e ainda assim inseguro para a garantia que mais importa aqui.**

Correção aplicada em §18.3 e §18.5: `REVOKE` de `INSERT`/`UPDATE` direto de
`authenticated` em toda tabela sincronizável — só `SELECT` continua
concedido direto na tabela. Escrever passa a exigir a função `security
definer`, que é a única com privilégio para inserir/atualizar. Duas regras
fixadas para toda função `definer` deste schema (nunca aceitar `user_id`
como parâmetro; `search_path` fixo) fecham o risco clássico de
escalonamento de privilégio que vem junto de qualquer `security definer`.

### 19.2 Tombstones

- **Reviver ao sincronizar — verificado, seguro, com uma correção.** A
  primeira versão de `save_diet` fazia `update ... set deleted_at = null`
  incondicionalmente dentro do UPDATE de edição — reviver um registro
  apagado é o comportamento pretendido para "editar depois de apagar", mas
  só é seguro porque o `where server_updated_at = p_expected_...` já
  protege esse caso: se o dispositivo A apagou (o que também passa pelo
  guarda de versão, via `delete_diet`) e o dispositivo B tenta editar com
  uma versão antiga esperada, a atualização de B falha por versão
  divergente — cai em conflito visível, não revive silenciosamente por
  cima do apagamento de A. **Isso só é verdade agora que existe uma função
  `delete_diet` com o mesmo guarda de versão** — a versão original do
  documento nunca chegou a especificar como o apagamento em si era
  escrito, o que deixava em aberto se ele passava pela mesma checagem.
  Fechado: ver o par `save_*`/`delete_*` em §18.5.
- **`service_role` não interfere no fluxo normal — verificado.**
  `service_role` no Supabase tem `bypassrls`, então nunca passa pelas
  políticas nem pelas funções acima — é uma chave separada, usada só pelo
  processo de exclusão de conta e por uma eventual limpeza periódica.
  Nenhuma chamada que o app faz com a chave `anon`/sessão de usuário chega
  perto dela.
- **Achado não resolvido, para decisão explícita: janela de retenção do
  tombstone.** Um dispositivo que fica offline por mais tempo do que a
  limpeza física periódica mantém as linhas apagadas (`deleted_at`
  preenchido, nunca purgadas) — se um job de limpeza um dia apagar de
  verdade linhas com `deleted_at` antigo, e um dispositivo muito tempo
  offline nunca chegou a puxar aquele tombstone, seu registro local não
  sincronizado poderia "reviver" o que foi definitivamente apagado, sem
  ninguém decidir isso. **Recomendação: não implementar nenhuma limpeza
  física de tombstone no V1.** O custo de armazenamento de linhas mortas é
  pequeno comparado ao risco de ressuscitar dado apagado; se um dia isso
  precisar existir, a janela tem que ser maior que qualquer offline
  razoável (meses, não dias) e é decisão de produto, não faz parte deste
  schema.

### 19.3 `server_updated_at`

- **Só o trigger altera — verificado.** O trigger roda `before insert or
  update`, incondicional, e sobrescreve `new.server_updated_at` não
  importa o que o cliente mandou no INSERT/UPDATE. Como a única porta de
  escrita agora é a função `definer` (§19.1), e o trigger dispara mesmo
  assim (triggers não são afetados por `security definer`/`invoker`), não
  existe caminho para o cliente escolher esse valor.
- **Dois relógios de dispositivo diferentes não quebram o cursor —
  verificado.** O cursor de pull (§18.6) compara contra
  `server_updated_at`, carimbado pelo Postgres num relógio só, nunca
  contra `client_updated_at`. Os dois relógios do PC e do iPhone nunca
  entram nessa comparação.

### 19.4 Concorrência — `Profile`, `Diet`, `Routine`, `BodyEntry`

A garantia ("o segundo recebe conflito, nunca last-write-wins silencioso")
**dependia inteiramente da correção de §19.1** — sem revogar o acesso
direto de UPDATE, a resposta a este item do checklist seria não. Com a
correção aplicada, e assumindo que o motor de sync realmente só chama as
funções `save_*`/`delete_*` (nunca `.from().update()` direto — isso passa
a ser uma regra de código a impor na Sprint de Sync, o schema sozinho
garante que a tabela recusaria a tentativa, mas não pode obrigar o cliente
a *tentar* pelo caminho certo, só impedir que o caminho errado funcione):
sim, o segundo dispositivo a tentar salvar com uma `server_updated_at`
esperada desatualizada recebe zero linhas afetadas, o motor de sync lê
isso como conflito, e a UI de §8 aparece. Verificado por construção, não
por teste — vale um teste de integração real na Sprint de Sync que
literalmente abre duas conexões, edita a mesma linha pelas duas, e
confirma que uma das duas chamadas retorna a versão antiga.

### 19.5 `FoodLog` — merge por `Meal.id`

- **Duas adições independentes no mesmo dia não geram conflito —
  verificado, com a mecânica precisada.** `Meal` não tem `updatedAt`
  próprio (não é uma `Entity`, só carrega `id`) — o merge não pode
  comparar timestamp por refeição, e o §17.2 original deixava isso
  implícito de um jeito que soa como se comparasse. A mecânica real é
  **diff estrutural por conjunto de ids, não por tempo**: união dos
  `Meal.id` dos dois lados; um id presente só de um lado entra sem
  questionar; um id presente dos dois lados com conteúdo idêntico não gera
  nada; um id presente dos dois lados com conteúdo diferente é o único
  caso que vira conflito visível. Isso funciona sem precisar guardar uma
  versão-base de referência.
- **Onde a mecânica roda: no cliente, não numa função Postgres.** O
  Postgres nunca vê o merge — ele só recebe o `payload` de `food_logs` já
  resolvido a cada `save_food_log`, com o mesmo par de guarda de versão
  (`server_updated_at` esperado) de qualquer outra tabela. O merge por
  `Meal.id` é lógica do motor de sync local, que primeiro puxa o `payload`
  remoto, faz o diff contra o local, resolve ou pergunta, e só então chama
  `save_food_log` com o resultado — a função no banco continua "burra"
  como as outras.
- **Ordem das refeições após a união — fechada em 24/08/2026, corrigindo a
  primeira recomendação deste documento.** `Meal[]` é um array — a
  interface já tem drag-and-drop de refeições (roadmap), então a ordem é
  dado de produto, não só exibição. A recomendação original ("refeições
  sem horário no final, na ordem em que apareceram localmente") não
  resiste a uma segunda olhada: **"localmente" não é uma referência única**
  quando dois dispositivos fizeram a união cada um do seu lado — o
  aparelho A vê sua própria ordem local como "a ordem", o aparelho B vê a
  dele, e os dois calculariam resultados diferentes para o mesmo merge,
  cada um tentando depois "corrigir" o outro numa sincronização sem fim.
  Uma regra de merge que depende de qual lado a executa não é uma regra.

  **Decisão fechada:** ordenar o resultado da união por `Meal.time`
  quando presente (refeições sem horário vão para o final), e entre
  refeições empatadas em horário (inclusive as duas sem horário) desempatar
  por `Meal.id` em ordem lexicográfica. `Meal.id` é um UUID estável dos
  dois lados — qualquer dispositivo que rode o merge chega exatamente à
  mesma ordem, porque a regra não depende de qual array veio "primeiro".
- **Granularidade confirmada: por refeição inteira, nunca por item dentro
  dela.** Editar o nome de uma refeição num aparelho e adicionar um item a
  ela no outro, ambos offline, é tratado como o mesmo caso "mesmo
  `Meal.id`, conteúdo diferente" — conflito visível na refeição inteira,
  não um merge de campo. Consistente com §14 (fora de escopo: merge
  campo-a-campo).

### 19.6 `Session`

- **Sessão em progresso permanece local — verificado por construção**, já
  que ela nunca entra no outbox enquanto `finishedAt === null` (§17.3) —
  não há um "esquecimento" possível porque não existe o gatilho que a
  colocaria na fila antes da hora.
- **Fechar o app durante o treino não cria lixo na nuvem — verificado**,
  pelo mesmo motivo: nada é enfileirado até o treino terminar.
- **Achado adjacente, já rastreado, não deste schema:** uma sessão que
  nunca é finalizada (usuário abandona o treino sem tocar em "Finalizar")
  fica órfã localmente para sempre e nunca sincroniza — o roadmap já lista
  "sessão de treino não tem teto de duração" como item aberto,
  independente de sync. Sincronização não piora nem resolve esse problema
  específico; só está registrado aqui para não parecer esquecido.

### 19.7 Migração

- **"Merge não duplica entidades" — verdadeiro só no sentido técnico, e é
  importante não deixar a frase original enganar.** Para `BodyEntry` e
  `FoodLog`, a chave é o próprio dia — duplicação é estruturalmente
  impossível, e a colisão vira o mesmo conflito visível de §8.1/§8.2
  aplicado em lote durante o primeiro sync. Para `Diet`, `Routine` e
  entidades de UUID: **duplicação técnica é impossível (dois UUIDs
  distintos nunca colidem), mas duplicação semântica é possível e não
  resolvida** — duas rotinas chamadas "Treino A", criadas
  independentemente em cada aparelho antes de existir conta, sobrevivem
  as duas depois do merge. Isso é uma limitação aceita do V1, não um bug:
  detectar "duas rotinas que provavelmente são a mesma coisa" exigiria
  comparação de conteúdo com um limiar de similaridade, que é uma feature
  própria (fica fora do V1, §14) — o usuário vê as duas e apaga a
  redundante manualmente.
- **"Descarte é irreversível e só ocorre após confirmação" — a UI está
  descrita, o mecanismo não estava.** §10/§17.5 diziam que a tela nunca
  decide silenciosamente, mas nunca disseram **o que "descartar" faz
  tecnicamente**: apagar os dados locais do aparelho que está entrando
  (equivalente a um `forgetDevice()` só do domínio, mantendo login) ou
  simplesmente nunca subir aqueles registros locais e deixá-los orfãos no
  aparelho? **Decisão fechada agora:** descartar apaga localmente
  (`forgetDevice()` de domínio, preservando a sessão de login) e então
  sincroniza do zero a partir da nuvem — do jeito que ficam órfãos e
  divergindo de novo silenciosamente é pior que apagar de vez, e é
  consistente com o mecanismo que "Esquecer este dispositivo" já
  implementa hoje.

### 19.8 Backup

- **Import não destrói dado mais novo na nuvem — depende inteiramente da
  correção de §19.1, e por isso vale repetir aqui.** Sem revogar o UPDATE
  direto, uma importação de backup antigo por cima de dado mais novo na
  nuvem teria sucesso silencioso assim que sincronizasse — exatamente o
  cenário que o checklist pediu para verificar, e a resposta seria não.
  Com a correção: cada registro importado tenta salvar via `save_*`, e um
  registro cuja versão na nuvem já avançou entra em conflito visível como
  qualquer outra escrita — o import não ganha um caminho especial que
  ignora a checagem.
- **Achado novo, não estava no documento: nada valida o formato do
  `payload` depois que ele já está no Postgres.** `jsonb` aceita qualquer
  JSON — nenhuma coluna ou função aqui restringe a forma de
  `payload`. Isso reabre exatamente o problema que a Sprint 3/Round 3 já
  resolveu para importação de arquivo (`backup-schemas.ts`, os schemas Zod
  que validam um backup antes de gravar): se um bug numa versão futura do
  app, uma chamada manual, ou uma migração mal escrita colocar um
  `payload` malformado numa linha, hoje nada impede que ele seja puxado e
  escrito direto no IndexedDB local de outro aparelho. **Recomendação
  obrigatória, não opcional: todo registro que chega por `pull` passa
  pelos mesmos `RECORD_SCHEMAS` (Zod) que já validam um arquivo de backup
  importado, antes de tocar o IndexedDB local.** O Postgres nunca devia
  ser tratado como "já validado só por ter vindo do próprio banco" — é
  exatamente o mesmo raciocínio que already existe documentado em
  `composition/backup.ts` para arquivo, agora estendido para rede.

### 19.9 Matriz de segurança por tabela

Igual em todas as dez tabelas — a checagem de dono nunca varia por tabela,
só a chave muda (`id` nas seis de UUID, `user_id`/`day` nas duas de dia,
`user_id` sozinho em `profiles`, `user_id + food_id`/`exercise_id` nas
duas de favorito).

| Operação | Dono | Outro usuário | Sem autenticação (`anon`) | `service_role` |
| --- | --- | --- | --- | --- |
| `SELECT` direto na tabela | ✅ (política RLS) | ❌ (`auth.uid() ≠ user_id`) | ❌ (`auth.uid()` é `null`) | ✅ (`bypassrls`) |
| `INSERT`/`UPDATE` direto na tabela | ❌ (revogado, §19.1) | ❌ | ❌ | ✅ |
| `INSERT`/`UPDATE` via `save_*`/`delete_*` (`security definer`) | ✅, só a própria linha (`auth.uid()` lido de dentro, nunca por parâmetro) | ❌ (a função só escreve com `user_id = auth.uid()`) | ❌ (`raise exception` se `auth.uid()` é `null`) | não usa esse caminho — escreve direto |
| `DELETE` físico | ❌ (nenhuma política de `delete`, nenhuma função expõe) | ❌ | ❌ | ✅ (fora do RLS, processo de exclusão de conta) |
| Soft delete (`deleted_at`) | ✅, só via `delete_*` | ❌ | ❌ | ✅ |

Duas colunas do formato original do Pedro colapsam numa linha aqui —
"`INSERT`" e "`UPDATE`" — porque neste schema as duas sempre andam juntas:
não existe tabela em que uma está aberta e a outra revogada, e separar em
duas linhas idênticas não acrescentaria informação.

### 19.10 Atacando `save_*`/`delete_*` de verdade — 24/08/2026

Pedido direto: não ler o SQL de novo e confirmar que parece certo — rodar
cada cenário do checklist contra o corpo real das funções, linha por linha,
e só marcar como rejeitado o que de fato falha na execução. Oito cenários,
todos contra `save_diet`/`delete_diet` (o mesmo raciocínio vale para o par
de qualquer outra tabela, porque o formato é idêntico).

1. **Usuário A tenta salvar registro de B.** Caminho de criação
   (`p_expected_server_updated_at = null`): `insert ... on conflict (id) do
   nothing` — o `id` já existe (de B), o `ON CONFLICT` dispara, nada é
   inserido. Caminho de atualização: `where id = p_id and user_id = v_uid
   and server_updated_at = ...` — `user_id` da linha real é B, `v_uid` é A,
   a cláusula nunca bate, `0` linhas afetadas nos dois caminhos. O `select`
   final também filtra por `user_id = v_uid`, então A recebe um resultado
   **vazio**, nunca o conteúdo de B. **Rejeitado — e sem vazar o conteúdo
   de B na resposta.**
2. **Usuário A tenta alterar `server_updated_at`.** Não existe parâmetro
   para isso em nenhuma das duas funções — o valor nunca é aceito como
   entrada, só escrito pelo trigger (`before insert or update`, incondicional,
   sempre `now()`). **Rejeitado por construção: não há como sequer tentar.**
3. **Usuário A tenta deletar registro de B.** Mesmo caminho do item 1 em
   `delete_diet`: `where id = p_id and user_id = v_uid and
   server_updated_at = ...` nunca bate porque a linha é de B. **Rejeitado —
   `deleted_at` de B nunca muda.**
4. **Usuário A envia versão antiga (o conflito de verdade, não ataque).**
   `server_updated_at = p_expected` não bate contra o valor atual (mais
   novo), `0` linhas afetadas, o `select` final devolve o
   `server_updated_at` **atual**, diferente do que A esperava — o motor de
   sync lê isso como `CONFLICT`. **Funciona como desenhado**, com uma
   lacuna de precisão encontrada no caminho: a função devolve só o
   timestamp, não o registro inteiro, diferente do `VersionedWriteResult`
   local (que devolve `current: T | undefined` completo). Não é falha de
   segurança — o dono sempre pode ler a própria linha inteira via `SELECT`
   direto, permitido por RLS — mas custa uma chamada extra que o
   `putIfVersionMatches` local não custa. Registrado como ajuste de
   protocolo para a Sprint de Sync, não do schema.
5. **Usuário A envia versão futura.** A comparação é `=` estrita, nunca
   `>=`/`<=` — não existe tratamento especial para um timestamp "no
   futuro"; ele simplesmente não bate com o valor real armazenado, do
   mesmo jeito que qualquer outro valor errado. **Rejeitado, sem
   diferença de comportamento por direção do erro** — o que importa, já
   que "no futuro" não é uma categoria mais perigosa que "errado" aqui.
6. **Usuário A chama a RPC com IDs aleatórios.** Criação com id novo:
   sucesso normal — é exatamente o fluxo pretendido (o cliente já escolhe
   o UUID). Atualização com id inexistente: `0` linhas, `select` final
   vazio. **Não é um ataque que quebra nada, mas expôs uma ambiguidade
   real de protocolo**, não de segurança: hoje "id não existe", "id existe
   mas é de outro usuário" e "id existe, é seu, mas a versão não bate"
   devolvem exatamente o mesmo resultado vazio/divergente para quem chama.
   O motor de sync consegue decidir corretamente o que fazer em cada um
   dos três casos (são tratamentos diferentes: recriar, nunca recriar,
   mostrar conflito) só inferindo pelo contexto que ele mesmo já tinha
   antes de chamar — funciona, mas é frágil o bastante para valer a pena
   registrar como melhoria de protocolo antes de escrever o motor de sync:
   a função poderia devolver um status explícito (`created` / `updated` /
   `conflict` / `not_found`) em vez de só `server_updated_at`.
7. **Usuário sem autenticação chama a RPC.** Duas camadas, não uma:
   `EXECUTE` nunca foi concedido a `anon` (só a `authenticated`, e o
   `REVOKE` explícito de `anon` fechado nesta revisão remove qualquer
   ambiguidade sobre isso) — a chamada é recusada pelo Postgres antes da
   função rodar. Mesmo que rodasse, `auth.uid()` seria `null` e `if v_uid
   is null then raise exception` aborta. **Rejeitado nas duas camadas,
   redundância proposital.**
8. **Usuário A tenta manipular `user_id`.** Não existe parâmetro
   `p_user_id` em nenhuma função — `user_id` nunca é entrada, só
   `auth.uid()` lido de dentro. **Rejeitado pela mesma razão do item 2: não
   há superfície para tentar.**

**Dois achados adicionais, fora da lista original, que só apareceram
tentando de verdade em vez de ler:**

- **`search_path = public, pg_temp` era o próprio vetor que a regra dizia
  evitar.** `pg_temp` é o schema temporário de quem chama a função — um
  chamador poderia criar uma tabela temporária chamada `diets` nele antes
  de invocar `save_diet`. Como todo `insert`/`update`/`select` no corpo da
  função já escreve `public.diets` por extenso (nunca `diets` sozinho), o
  sequestro não tinha efeito prático nesta versão — mas contar com
  "sempre qualificamos por hábito" para fechar um vetor de ataque é frágil
  para quem editar a função depois sem saber por quê. **Corrigido em
  §18.5: `search_path = public`, sem `pg_temp`.**
- **Corrida entre dois dispositivos do mesmo usuário — verificada, não é
  falha.** Duas chamadas concorrentes de A (PC e iPhone) com o mesmo
  `server_updated_at` esperado: o `UPDATE` do Postgres adquire lock de
  linha durante a avaliação do `WHERE`; a segunda chamada só executa depois
  da primeira commitar, e a essa altura o `server_updated_at` já mudou —
  a segunda vê `0` linhas, exatamente o conflito que deveria ver.
  Garantia do MVCC do Postgres, não precisa de `SELECT ... FOR UPDATE`
  explícito.

### 19.11 Veredito

**Não aprovado na forma original.** Um achado P0 real (§19.1), já corrigido
diretamente em §18. Dois achados P1 que exigiam decisão de mecanismo, não
só de UI, e foram fechados agora (§19.2 apagamento com guarda de versão,
§19.7 o que "descartar" faz de fato). Um achado que fica como recomendação
obrigatória para a Sprint de Sync, fora do escopo do schema em si mas
registrado para não ser esquecido (§19.8, validar `payload` no pull com os
mesmos schemas Zod do backup). Um achado sem decisão ainda, deliberadamente
adiado (§19.2, janela de retenção de tombstone — recomendação é não
purgar no V1). A ordenação de `FoodLog` depois do merge, fechada acima em
§19.5 — a primeira recomendação deste documento não era determinística
entre dois dispositivos e foi corrigida para uma regra que é.

**A tentativa de ataque às RPCs (§19.10) não encontrou nenhuma falha de
segurança nova** — os oito cenários pedidos são todos corretamente
rejeitados pela versão corrigida das funções — mas encontrou dois ajustes
reais de qualquer jeito: o `search_path` continha um vetor de sequestro que
só não era explorável por sorte de estilo, não por desenho (corrigido), e o
protocolo de retorno das funções é ambíguo o bastante para valer um ajuste
antes da Sprint de Sync (registrado, não bloqueia migration).

Com essas correções aplicadas em §18, considero o schema pronto para a
Sprint de Auth começar em paralelo — auth não depende de nenhuma tabela de
domínio. **A Sprint de Schema (criar as migrations de verdade) só deveria
começar depois de você concordar com as correções desta seção**, em
especial §19.1, que muda a forma de duas seções inteiras do documento.

---

## 20. Sprint de Schema — migrations reais aplicadas em 25/08/2026

As 20 migrations de `supabase/migrations/` (numeradas 0001–0020) aplicaram
o desenho de §18 no projeto `rtvscxcfwfsamxatkwit` de verdade — 10
tabelas, RLS, triggers, 16 funções `save_*`/`delete_*`. `list_tables`
confirmou as 10 tabelas com `rls_enabled: true`, PKs e FKs exatamente como
desenhado. `get_advisors(type: security)` só apontou os 16 avisos
esperados ("`authenticated` pode executar função `security definer`" —
exatamente o desenho pretendido, a única porta de escrita) e um item de
hardening de Auth não relacionado ao schema (proteção contra senha
vazada, desligada — recomendação registrada, não bloqueia).

### 20.1 Achado real — só apareceu atacando o banco de verdade

Os oito cenários de ataque de §19.10 tinham sido verificados só contra o
**desenho**. Rodá-los de novo contra as funções **de verdade**, com um
usuário real autenticado (o mesmo `pedrofunesctt@gmail.com` da validação
E2E do Sprint 1), achou um bug funcional real que nenhuma leitura do SQL
pegou: toda chamada de `UPDATE` (ou seja, todo caminho de conflito — o
mecanismo central da arquitetura inteira) falhava com

```
column reference "server_updated_at" is ambiguous
```

**Causa:** `returns table (server_updated_at timestamptz)` cria, dentro do
corpo `plpgsql` da função, uma variável de saída chamada
`server_updated_at`. A cláusula `where ... and server_updated_at =
p_expected_server_updated_at` não qualificava essa referência com o nome
da tabela — e o Postgres não consegue decidir se `server_updated_at` ali
é a variável de saída da função ou a coluna real da tabela. Erro `42702`,
em produção, nas 8 funções `save_*` e nas 8 `delete_*` — as 16 funções que
existiam.

Isso não é um problema de segurança (nada vazou, nada foi sobrescrito
indevidamente) — é um bug funcional que teria quebrado toda edição e todo
apagamento reais assim que a Sprint de Sync começasse a chamar essas
funções. **A leitura estática do SQL em §18.5, feita duas vezes antes
desta sessão, não pegou isso** — o texto lê perfeitamente bem, a
ambiguidade só existe em tempo de execução, dentro do escopo de nomes do
`plpgsql`. É exatamente o motivo de "não confiar na leitura, atacar de
verdade" (§19.10) ter sido a exigência certa desde o início — só que
faltava fazer isso contra o banco real, não só contra o desenho.

**Correção:** qualificar toda referência a `server_updated_at` dentro do
`WHERE` com o nome completo da tabela (`public.diets.server_updated_at`,
não `server_updated_at` sozinho). Aplicado nas 8 tabelas, cada correção
testada individualmente contra o banco real antes de seguir para a
próxima — criação, tentativa de conflito com versão antiga, e leitura do
conteúdo real da linha confirmando que a tentativa maliciosa não foi
aplicada.

### 20.2 Confirmado contra o banco real, não simulado

Com um único usuário real autenticado (token de acesso obtido via login
de verdade), rodados contra as 8 tabelas:

- **Criação real** — todas as 8 `save_*` criaram um registro com sucesso,
  `server_updated_at` real devolvido.
- **Conflito real (cenário 4/5 de §19.10, agora contra produção)** —
  chamada com `server_updated_at` esperado desatualizado (passado e
  futuro, os dois testados) devolveu o timestamp atual sem aplicar a
  mudança; conteúdo da linha lido depois confirma que o valor malicioso
  nunca chegou a gravar.
- **Sem autenticação (cenário 7)** — `401 permission denied for function
  save_diet`, bloqueado na camada de `GRANT`/`REVOKE`, antes mesmo da
  função rodar.
- **`workout_sessions` com `finished_at = null` (§17.3 reforçada no
  banco)** — `400`, `"workout_sessions only sync once finished"`.
- **Tombstone real** — `delete_diet` com versão errada não mudou
  `deleted_at`; com a versão certa, `deleted_at` foi preenchido com
  timestamp real.

Os cenários 1 e 3 de §19.10 (A tenta ler/escrever/apagar dado de B)
seguem verificados só por desenho (RLS `auth.uid() = user_id`, o
primitivo padrão do próprio Supabase) — um segundo usuário real para
testar isolamento entre contas de verdade fica como item em aberto, não
bloqueante, para quando fizer sentido criar um segundo teste E2E.

### 20.3 Estado do schema

**Aplicado e íntegro em produção.** As migrations em `supabase/migrations/`
espelham fielmente o histórico real do projeto — incluindo as 8 versões
com o bug (0005–0012) e as 8 correções (0013–0020) como entradas
separadas, append-only, a mesma regra que `composition/migrations.ts` já
usa para o schema local. Ninguém que ler os arquivos do zero vai encontrar
uma versão silenciosamente "consertada" sem o registro de que ela já
existiu quebrada.

Dados de teste criados durante o ataque foram apagados pelas próprias
`delete_*` (tombstone real, não faxina bruta) — o mesmo caminho que
qualquer usuário real percorreria.

Nenhuma tabela de domínio tem dado real do Pedro ainda. A Sprint de Sync
(outbox, pull, motor de merge) é a próxima, e é a primeira que
efetivamente lê/escreve dado de domínio do dispositivo local.
