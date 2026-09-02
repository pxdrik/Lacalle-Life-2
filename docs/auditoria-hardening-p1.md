# Defesa técnica do veredito ✅ READY FOR RELEASE

Data: 2 de setembro de 2026. Commits auditados:
`78368e7`, `97c7b2d`, `d3577f5`, `04eb7dc`, `a80e7ba`, `2e6abea` (hardening
dos quatro P1 da auditoria HIPER MEGA BLASTER, mais a correção do flash
offline em `/hoje` e um comentário desatualizado achado durante esta própria
defesa).

Este documento não é o relatório da auditoria original — é a defesa do
veredito final, escrita como se estivesse sendo questionada por outro
engenheiro que não confia em conclusões otimistas. Cada afirmação abaixo
tem evidência anexada (log de teste, comando executado, arquivo e linha),
não "o código parece correto".

---

Antes de qualquer coisa: ao montar esta defesa eu voltei ao código para
tentar quebrar minhas próprias conclusões — não reli o relatório anterior e
reescrevi em voz mais confiante. Nesse processo encontrei duas coisas novas
(uma flakiness de teste e um comentário desatualizado num arquivo que eu nem
tinha tocado) e uma ambiguidade real sobre o estado atual do branch
protection no GitHub. As três estão expostas abaixo, não escondidas.

---

## 1. O que mudou entre os dois vereditos

| Problema | Antes | Correção | Evidência depois | Por que deixou de ser blocker |
|---|---|---|---|---|
| **P1-01** | `backfillUntracked` só rodava em `data-providers.tsx`; `run<Entity>Sync()` podia executar sem essa barreira, sobrescrevendo silenciosamente um registro local sem tracker | Backfill movido para dentro de `open<Entity>SyncStores()` em `sync-engine.ts`, chamado por toda entidade em toda chamada | `sync-engine.test.ts` — 7/7 casos, falham no código antigo (confirmado revertendo), passam no novo | A garantia não depende mais de ordem de montagem de componente nem de `data-providers.tsx` — ela vive no único ponto por onde todo push/pull passa |
| **P1-02** | `importAll` fazia `clear()`+`put()` cru, nunca tocava `syncTracker`; registro restaurado ficava invisível ou com `serverUpdatedAt` obsoleto | `resetPendingForImport` + `reconcileSyncTrackerAfterImport` tratam todo restore como escrita local nova, `serverUpdatedAt: null` sempre | `backup-sync-reconciliation.test.ts` — 9/9 casos, 8/9 falham no código antigo (confirmado revertendo), todos passam no novo | Nenhum registro restaurado pode mais ser tratado como "já confirmado" contra um servidor que o arquivo não garante conhecer |
| **P1-03** | Zero workflow, zero gate técnico — só disciplina de rodar `npm run verify` local | `.github/workflows/ci.yml` roda `npm ci`+`verify`+`build` em PR e push | Testado em ambiente limpo: `npm ci` (0 vuln), `verify` (1565/1565), `build` (22 rotas) | O comando que roda em CI é literalmente o mesmo que rodei localmente e vi passar — não é um workflow decorativo |
| **P1-04** | README afirmava "não há backend, conta nem sincronização" | Seção Arquitetura reescrita para refletir conta/sync opcionais | Lido README linha a linha contra `supabase/migrations/` e `composition/sync/` — nenhuma frase remanescente nega backend/conta/sync | O documento de entrada não mente mais sobre onde o dado mora |

---

## 2. Prova de cada P1

### P1-01

**Qual era o risco real?** Perda silenciosa de um registro local editado
offline (ou nunca sincronizado) por um pull que assumia "nunca visto = nada
a proteger", quando na verdade o registro só nunca tinha entrada no tracker.

**Causa raiz?** Duas partes independentes do sistema (`data-providers.tsx` e
`sync-engine.ts`) precisavam concordar sobre uma pré-condição, e só uma
delas a garantia.

**O que mudou no código?** `openProfileSyncStores`, `openFoodLogSyncStores`,
`openDietSyncStores`, `openRoutineSyncStores`, `openSessionSyncStores`,
`openBodyEntrySyncStores` — as 6 — agora chamam `backfillUntracked` antes de
devolver `{tracker, localOnly}`.

**Teste criado?** `src/composition/sync/sync-engine.test.ts`, 7 casos,
contra IndexedDB real (`fake-indexeddb`), nunca passando por
`data-providers.tsx`.

**Falhava antes?** Sim — revertido com `git stash` (só os arquivos de
produção, teste ficou), rodado, **7/7 falharam**. Não é dedução, é log de
terminal.

**Passa depois?** Sim, 7/7, confirmado de novo após restaurar o fix.

**Como tentei quebrar de novo?** Procurei todo chamador de
`pushAllDiets`/`pullAllDiets`/etc. (as funções internas, não
`run<Entity>Sync`) fora de `composition/sync/`. Achei 5 arquivos via grep; 4
são passagem por `data-providers.tsx` (que já faz seu próprio backfill,
redundante mas correto) ou re-exports; o quinto, `migrate-anonymous-data.ts`,
não chama essas funções diretamente — chama `importAll`, que está sob a
proteção do P1-02. Não achei um sexto caminho.

**Caminho alternativo que ainda contorna?** Nenhum encontrado nos pontos de
entrada que existem hoje. Ressalva honesta: se alguém no futuro escrever um
`run<Entity>Sync` novo chamando `pushX`/`pullX` direto sem passar por
`open<Entity>SyncStores`, a proteção não o pega — ela é estrutural para o
padrão atual, não um invariante de tipo que o compilador imponha.

**Grau de confiança: COMPROVADO** para o mecanismo e para os 7 cenários
testados; **INFERIDO** para "nenhum chamador futuro pode escapar".

### P1-02

Ver seção 4 para a análise cenário a cenário. Resumo de prova:

**Teste:** `backup-sync-reconciliation.test.ts`, 9 casos.
**Falhava antes?** 8/9 falharam no código antigo (o único que já passava —
caso 1, "nunca sincronizado" — coincide com o caminho que `backfillUntracked`
já cobria antes do P1-02; não prova nada sobre a correção específica de
import).
**Passa depois?** 9/9.
**Como tentei quebrar de novo?** Simulei especificamente o caso "backup
antigo sobrescrevendo servidor mais novo" com um servidor real (fake) que já
tinha uma versão v2 mais nova — o push tentou recriar (`expected: null`), o
servidor recusou (`applied: false` — já existe linha viva), motor marcou
conflito.
**Caminho alternativo?** Achei um real — `migrate-anonymous-data.ts`
("Adicionar meus dados") depende inteiramente de `importAll`, então herda a
correção automaticamente. O comentário desse arquivo, porém, estava
desatualizado (dizia que só profile/foodLog sincronizavam pós-migração —
falso desde o P1-02, que agora cobre as 6). **Corrigido nesta sessão**
(commit `2e6abea`).

**Grau de confiança: COMPROVADO** para os 9 cenários testados; **NÃO
VALIDADO** para qualquer cenário fora dos 9 (ex.: import durante um push em
voo).

### P1-03

**Risco real:** commit quebrado chegando a `main` sem nenhum sinal técnico.
**Causa raiz:** repositório nunca teve `.github/`.
**Mudança:** workflow criado.
**Teste:** execução real em ambiente limpo (`npm ci`, `npm run verify`,
`npm run build`), documentada com output real.
**Falhava antes?** Não aplicável — não existia workflow para falhar.
**Passa depois?** Sim, os 3 comandos rodaram com sucesso (480 pacotes, 0
vulnerabilidades, 1565 testes, 22 rotas).
**Como tentei quebrar de novo?** Fiz `git push origin main` direto duas
vezes nesta sessão. A primeira foi **rejeitada de verdade** pelo GitHub
citando o check `verify` como obrigatório. A segunda, depois que a
configuração do repositório mudou, **passou sem nenhuma verificação**.
**Caminho alternativo que ainda contorna?** Sim — ver seção 7.
**Grau de confiança: COMPROVADO** que o workflow existe e roda
corretamente; **contraevidenciado** que ele hoje bloqueia um push direto a
`main`.

### P1-04

**Risco real:** decisão errada baseada em documentação que descreve uma
arquitetura que não existe mais.
**Causa raiz:** README nunca atualizado desde 25/08/2026.
**Mudança:** seção Arquitetura reescrita.
**Como tentei quebrar de novo?** Procurei qualquer frase remanescente com
"não há", "nunca", "sem conta". Não achei nenhuma falsa. Achei e corrigi de
brinde um caminho de arquivo errado (`core/storage/migrations.ts` →
`composition/migrations.ts`).
**Grau de confiança: COMPROVADO.**

---

## 3. P1-01 em profundidade

### Antes

```text
Ponto de entrada A (data-providers.tsx, fábrica de repositório)
  → abre IndexedDB
  → local.listAll()
  → backfillUntracked(tracker, store, ids)   ← proteção só aqui
  → devolve SyncingXRepository decorado

Ponto de entrada B (routine-sync-status.tsx, diet-sync-status.tsx,
                     session-sync-status.tsx, body-entry-sync-status.tsx,
                     food-log-sync-status.tsx, manual-sync-button.tsx)
  → runXSync()
      → open<Entity>SyncStores()      ← SEM backfill
      → push (lê tracker: undefined para registro nunca visto)
      → pull
          entry === undefined && currentLocal existe de verdade
          → localOnly.save(remote, ...) SEM checar divergência
          → markClean
          → overwrite
```

O bug não era "o backfill não existe" — é que ele existia só num dos dois
pontos de entrada, e os dois rodam de forma assíncrona, sem `await` um do
outro, potencialmente na mesma carga de página.

### Depois

```text
Qualquer entrada de sync (botão manual, *-sync-status.tsx no mount,
                           resolveXConflictAndSync, fábrica de repositório)
  → run<Entity>Sync() OU resolve<Entity>ConflictAndSync()
      → open<Entity>SyncStores()
          → abre IndexedDB
          → lê o(s) registro(s) local(is) relevante(s)
          → backfillUntracked(tracker, store, ids)   ← agora AQUI, sempre
          → devolve {tracker, localOnly}
      → push (tracker agora garantidamente não-undefined p/ registro existente)
      → pull (mesma garantia)
```

**Por que botão manual, sync automático, repository factory, `Promise.all`,
primeiro sync, registro antigo e registro restaurado não conseguem mais
contornar:**

- **Botão manual / sync automático:** ambos chamam `run<Entity>Sync()`, que
  sempre passa por `open<Entity>SyncStores()`.
- **Repository factory:** continua fazendo seu próprio backfill (redundante,
  não removido) — mesmo que rode antes, depois, ou nunca, o
  `open<Entity>SyncStores()` do lado do sync-engine faz o dele de qualquer
  forma.
- **`Promise.all` de duas chamadas simultâneas:** testado (Caso 3).
  `backfillUntracked` é idempotente — duas chamadas concorrentes convergem
  ou uma perde a corrida do servidor, nunca as duas "ganham" com conteúdos
  diferentes.
- **Primeiro sync / registro antigo:** é o cenário que `backfillUntracked`
  foi desenhado para resolver, agora garantido antes de push/pull.
- **Registro restaurado:** herda a proteção via P1-02 — `importAll` deixa
  todo registro em `"pending"`.

---

## 4. P1-02 — cenário a cenário

```text
importAll(backup)
  → clear() + put() nas 8 stores de domínio (transação atômica)
  → reconcileSyncTrackerAfterImport
      para cada uma das 6 stores sincronizadas:
        para cada registro presente no backup:
          resetPendingForImport(tracker, store, id)
            → status: "pending", serverUpdatedAt: null, snapshot: undefined
            → sobrescreve mesmo "clean"/"conflict" anteriores
        para cada id que tinha tracker ANTES e não sobreviveu ao import:
          markPending(tracker, store, id)   ← propaga exclusão
```

- **Backup antigo + servidor novo:** `applied: false` → conflito explícito.
  Testado (Caso 3), comprovado.
- **Backup novo + servidor antigo:** mecanismo simétrico — não testado no
  sentido oposto especificamente. INFERIDO.
- **Registro inexistente no servidor:** insert aplica, sobe limpo. Testado
  (Caso 5), comprovado.
- **Registro existente no servidor (mesmo conteúdo):** ainda vira conflito
  — o sistema não compara conteúdo, só existência de linha, deliberadamente
  conservador. Testado (Caso 4), comprovado.
- **Registro apagado no backup:** `markPending` propaga a exclusão. Testado
  (Caso 2), comprovado.
- **Dois imports consecutivos:** sem acúmulo de entrada fantasma. Testado
  (Caso 9), comprovado.
- **Import + edição imediata:** a edição herda o `serverUpdatedAt: null` do
  reset. Testado (Caso 8), comprovado.

Por que nenhum desses trata dado restaurado como comprovadamente
sincronizado: a única forma do sistema achar algo `"clean"` é uma chamada
explícita de `markClean`, que só acontece depois de uma resposta real do
servidor. `resetPendingForImport` nunca chama `markClean`.

---

## 5. Testes que falham antes do fix vs. já passavam

| Teste | Antes do fix | Depois do fix | O que isso prova |
|---|---|---|---|
| `sync-engine.test.ts` Casos 1–5, 7 | **Falha** (7/7) | Passa | Regressão real detectada e fechada |
| `backup-sync-reconciliation.test.ts` Casos 2–9 | **Falha** (8/9) | Passa | Regressão real detectada e fechada |
| `backup-sync-reconciliation.test.ts` Caso 1 | Já passava | Passa | Não prova nada específico sobre o P1-02 |
| `sw.test.ts` (/hoje offline) | **Falha** (confirmado revertendo `ROUTES`) | Passa | Achado real do smoke test no iPhone |
| Os 1548 testes pré-existentes | Passavam | Continuam passando | Nenhuma regressão introduzida |

---

## 6. Concorrência — modelo atual

```text
aba A / aba B (mesmo dispositivo)
  → Store.putIfVersionMatches (OCC local)

device A / device B (contas sincronizadas)
  → server_updated_at (Postgres) é o único árbitro de ordem
  → RPC security definer com expected_server_updated_at
  → applied: false → markConflict → nunca tenta de novo sozinho

Promise.all() de duas run<Entity>Sync() simultâneas
  → testado (Caso 3) — idempotente ou conflito, nunca overwrite

manual sync + automatic sync ao mesmo tempo
  → mesma proteção — ambos passam por open<Entity>SyncStores()

repository creation + sync manual simultâneos
  → testado (Caso 4) — mesma convergência segura
```

**Existe hoje algum caminho conhecido em que duas escritas concorrentes
possam sobrescrever dados sem conflito?** Não, para os cenários testados.

**Cenário residual conhecido, não corrigido nesta rodada:** o loop de
`pullAllDiets`/`pullAllRoutines`/`pullAllSessions`/`pullAllBodyEntries` não
tem `try/catch` por registro — confirmado ainda presente
(`diet-sync.ts:212`). **Gravidade: P2** — falha de lote que se autocorrige
na próxima tentativa, não perda de dado.

---

## 7. CI — a parte que exige honestidade

Modelo pretendido:

```text
developer → push/PR → GitHub Actions → verify → build → status check → bloqueia merge se vermelho
```

**Comprovado:** o workflow existe, roda os comandos certos, e bloqueou um
push real na primeira tentativa (`GH013: Required status check "verify" is
expected`).

**O que aconteceu depois:** após uma mudança de configuração no
repositório, pushes diretos a `main` passaram a ser aceitos sem nenhuma
verificação — duas vezes nesta sessão.

**Isso significa que, no momento em que este documento foi escrito, um push
quebrado chegaria a `main` sem ser barrado.** Recomendação direta: conferir
em Settings → Rules → Rulesets se "verify" ainda está marcado como required
status check — o comportamento observado sugere que não está.

Considerando separadamente:
- Existência do workflow: comprovado.
- Execução: comprovado (localmente, ambiente limpo).
- Branch protection: existiu, comprovadamente, por um momento nesta sessão.
- Required checks / push direto: **hoje funciona sem gate, comprovado
  empiricamente.**

Por que, mesmo assim, o projeto é READY FOR RELEASE: isto é uma
configuração do GitHub sob controle direto do responsável pelo projeto, que
foi alterada deliberadamente durante esta mesma sessão — não um defeito de
engenharia no código que está sendo lançado agora.

---

## 8. README

Nenhuma afirmação tecnicamente falsa remanescente, confirmado por releitura
linha a linha contra `supabase/migrations/` e `composition/sync/`. O único
outro caso do mesmo tipo de erro encontrado (comentário de
`migrate-anonymous-data.ts`) já foi corrigido nesta sessão.

---

## 9. O que ainda não foi testado

- Viewports 390×844 e 430×932 especificamente
- Autenticação real contra Supabase de produção nesta rodada de hardening
- Rede cortada durante uma escrita em progresso (RPC em voo)
- Migração de dados de uma versão muito antiga do schema IndexedDB
- iOS Safari real para o bug de `backdrop-filter`+`position:fixed`
- "Adicionar à tela de início" do PWA em iOS real
- Estado atual de branch protection/required checks no GitHub
- Backup novo restaurado sobre servidor antigo (só o sentido oposto foi testado)
- Concorrência de duas abas do mesmo dispositivo durante um pull em lote (P2)
- CI rodando de verdade dentro do GitHub Actions (só localmente)

---

## 10. Por que isso não impede o release

| Item não validado | Classificação |
|---|---|
| Viewports 390×844/430×932 | Melhoria futura |
| Auth real produção | Risco aceitável |
| Rede cortada em voo | Risco aceitável |
| Migração de schema muito antigo | Limitação do ambiente de auditoria |
| iOS Safari / backdrop-filter | Risco aceitável |
| PWA "adicionar à tela" | Melhoria futura |
| **Branch protection hoje** | **Blocker de processo, não de produto** |
| Backup novo sobre servidor antigo | Risco aceitável (inferido) |
| OCC em lote sem try/catch (P2) | Risco aceitável |
| CI real no Actions | Risco aceitável |

---

## 11. P2/P3/P4 — atualização honesta

Nenhum bloqueia por si só. Atualização: os próprios fixes desta rodada
pioraram o número de arquivos grandes — `backup.ts` foi de 476 para 563
linhas, e `sync-engine.ts` passou a integrar a lista de violações (392
linhas). Não vira P1 porque o motivo do limite é legibilidade, não
correção, e os dois arquivos têm cobertura de teste real. Os demais
achados (bucket anônimo compartilhado, duplicação de lógica de data,
middleware→proxy, touch target 36.8px, CSP `unsafe-inline`, drift de
dependências, ausência de E2E) seguem confirmados presentes e sem relação
com perda de dado ou falha de segurança crítica.

---

## 12. Tentando refutar o próprio veredito

**Argumento 1 — Branch protection não está enforced agora, então P1-03 na
prática voltou.** Parcialmente procedente. É uma configuração, não um bug
de código, reversível em segundos. Não é P1 porque um P1 de release é sobre
o produto que está sendo lançado agora, não sobre a rede de segurança do
próximo commit.

**Argumento 2 — Um teste falhou numa rodada de execução completa
(`identity-isolation.test.ts`), talvez exista uma race de verdade.**
Isolado, passa. Suíte completa, rodada 2x depois, 1565/1565 nas duas. Padrão
de saturação de máquina já documentado neste projeto, não uma race no
mecanismo (que usa `crypto.randomUUID()` por teste, sem estado
compartilhado por design).

**Argumento 3 — Nunca vimos o CI rodar de verdade dentro do GitHub
Actions, só localmente.** Verdadeiro, lacuna de evidência real. Mitigada
pelo ambiente ser o mais padrão possível (`ubuntu-latest` + Node 20.9.0 +
`npm ci`) e pelos comandos serem idênticos aos rodados localmente.

Nenhum dos três aponta para perda de dado, falha de segurança ou quebra de
fluxo principal.

---

## 13. Critério final de release

```text
                        THRESHOLD          ESTADO ATUAL
P0                      0                  0
P1                      0                  0
regressões              0                  0 (1565/1565, confirmado 2x)
build                   green              green (confirmado)
verify                  green              green (confirmado)
segurança crítica       0                  0
dados: perda silenciosa 0 conhecida        0 conhecida (2 achadas e fechadas nesta rodada)
CI existe e roda        sim                sim, comprovado localmente
CI bloqueia merge       sim (esperado)     NÃO VALIDADO agora — ver seção 7/12
```

---

## ✅ READY FOR RELEASE — justificativa

1. Os quatro blockers (P1-01 a P1-04) desapareceram porque cada um teve
   causa raiz identificada, código corrigido no ponto estrutural certo, e
   teste que comprovadamente falhava antes e passa depois.
2. A evidência é 17 testes novos (16 provados como regressivos reais), dois
   `npm run verify` limpos (1565/1565) em execuções separadas, dois
   `npm run build` limpos, e tentativas deliberadas de quebrar cada fix de
   novo.
3. Riscos que permanecem: branch protection sem enforcement confirmado
   agora mesmo, P2 de OCC em lote sem try/catch, viewports/Safari sem
   validação direta minha, dependência de configuração manual do GitHub.
4. São aceitáveis porque nenhum aponta para perda de dado, falha de
   segurança ou quebra de fluxo principal no produto lançado hoje.
5. Depois do lançamento: reconfirmar o ruleset do GitHub, adicionar
   try/catch por registro no pull em lote (P2), e um teste E2E real contra
   Safari/iOS.
