# Lacalle Life

Monte dietas. Monte treinos. Acompanhe sua evolução.

Nada além disso.

## Princípio

Toda funcionalidade responde a uma pergunta: **isso ajuda o usuário a montar
dieta ou treino?** O que não responde, não entra.

## Stack

| Camada | Escolha | Motivo |
| --- | --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) | Roteamento, code splitting e prefetch sem configuração |
| UI | React 19 + React Compiler | Memoização automática elimina a classe de bugs de `useMemo`/`useCallback` |
| Estilo | Tailwind CSS 4 | Tokens em CSS nativo, zero runtime |
| Validação | Zod 4 | Um schema serve de tipo e de validação |
| Persistência | IndexedDB via `idb` | Local-first: leitura em ~1 ms e funcionamento offline integral |
| Conta e sincronização (opcionais) | Supabase (Auth + Postgres) | Multi-dispositivo para quem cria conta; nada disso é obrigatório para usar o app |
| Testes | Vitest 4 + `fake-indexeddb` | O adapter real é exercitado, não substituído por mock |

## Arquitetura

### Local-first, com conta e sincronização opcionais

O IndexedDB do navegador é sempre a fonte da verdade **para a tela** — toda
leitura e escrita local passa por ele primeiro, e o app funciona por completo
offline e sem conta desde a instalação, exatamente como na v1. Isso não
mudou.

O que existe desde a v2: quem cria uma conta (Supabase Auth) ganha
sincronização multi-dispositivo para as seis entidades pessoais — Perfil,
Dieta, Rotina de treino, Sessão de treino, Peso/medidas (Evolução) e Diário.
Toda escrita continua gravando local primeiro e devolvendo na hora; a
sincronização acontece depois, em segundo plano (`src/composition/sync/`),
e só interrompe a tela quando há um conflito real — o mesmo registro editado
em dois lugares. Nunca escolhe um lado sozinho: o app sempre pergunta. Sem
conta, ou offline, nada muda — a pendência de envio fica gravada localmente
e nunca é drenada.

O catálogo de alimentos/exercícios nunca sincroniza por usuário (é dado de
referência, igual para todo mundo, semeado localmente a partir de um JSON no
bundle); só favoritos e itens criados pelo usuário são pessoais.

Backup/exportação (`composition/backup.ts`, tela de Perfil) continua
existindo sem relação com conta — é a rede de segurança de quem não quer
sincronizar e a forma de portar dados manualmente. Restaurar um backup
sempre substitui o local (nunca mescla) e, para quem já sincroniza, entra na
fila de sincronização como qualquer outra escrita local.

Toda entidade nasce com `id`, `createdAt` e `updatedAt`. `updatedAt` é o
discriminador local de concorrência otimista (`Store.putIfVersionMatches`) —
resolve duas escritas na mesma aba/dispositivo. Entre dispositivos
diferentes, quem decide ordem é o `server_updated_at` carimbado pelo
Postgres, nunca o relógio do cliente. O desenho completo — schema, RLS,
regra de conflito por entidade, o que nunca sincroniza — está em
`docs/arquitetura-sincronizacao.md`.

### A fronteira de persistência

```
features/<feature>/components/   ─┐
features/<feature>/hooks/         ├─→  features/<feature>/data/  ─→  core/storage/
features/<feature>/services/     ─┘         (interface)              (implementação)
```

Uma feature conversa apenas com a **interface** de repositório declarada no seu
próprio `data/`. Só a implementação dentro dessa pasta sabe que armazenamento
existe. É isso que permite trocar a implementação local por uma remota sem
tocar em lógica de negócio ou em componente.

Essa regra não é convenção: está no `eslint.config.mjs`. Importar
`@/core/storage/*` ou `idb` de fora de `features/*/data/` falha o lint.

> `Store<T>` não é a fronteira de troca. Uma API HTTP não é uma coleção
> indexada por chave, e forçá-la a ser produziria um contrato ruim dos dois
> lados. `Store<T>` é o encanamento compartilhado pelas implementações
> locais; o repositório de cada feature é a fronteira de verdade.

### Agregados

Dieta e rotina de treino são documentos únicos (`Diet → Meal[] → MealItem[]`),
não tabelas normalizadas. Um documento tem alguns KB, o que torna reordenação
um `array.move()`, escrita atômica e leitura de tela inteira uma só operação.

Séries temporais — sessões de treino executadas, medidas corporais — continuam
normalizadas: crescem sem limite e precisam de consulta por intervalo de data.

### Migrações

O schema é declarado como **dado**, não como código executado dentro de uma
transação de upgrade — o lugar menos tolerante a erro do IndexedDB. A lista em
`src/composition/migrations.ts` é append-only: um navegador instalado pode
estar em qualquer versão anterior, e o caminho a partir dela precisa continuar
funcionando. O schema do Postgres (`supabase/migrations/`) segue a mesma
regra — append-only, nunca editar uma entrada já liberada.

### Dois adapters, um contrato

`MemoryStore` não existe por conveniência. Ele é a segunda implementação que
transforma `Store<T>` em contrato de verdade, e não em descrição do que o
IndexedDB por acaso faz. Ambos rodam a mesma suíte de conformidade — clone
estrutural, ordenação por chave, exclusão de registros sem valor no índice.
Comportamento que só um dos dois tem é falha de teste, não surpresa em
produção.

## Comandos

```bash
npm run dev        # servidor de desenvolvimento
npm run build      # build de produção
npm run verify     # typecheck + lint + testes
npm test           # apenas testes
```

`npm run verify` é o portão. Nada avança com ele vermelho.

## CI

`.github/workflows/ci.yml` roda `npm ci`, `npm run verify` e `npm run build`
em todo `pull_request` e em todo push para `main`. **Branch protection
exigindo esse workflow como status check obrigatório ainda precisa ser
habilitada manualmente** em Settings → Branches no GitHub — o workflow por
si só audita, não bloqueia merge sem essa configuração.

## Convenções

- Arquivos até ~250 linhas. Acima disso, refatore.
- `any` é erro de lint, não aviso.
- Código não usado é erro de lint, não aviso.
- `strict` do TypeScript mais `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes` e `erasableSyntaxOnly`.
- Estado ilegal não deve ser representável. Quando o tipo puder impedir, ele
  impede — veja `IndexQuery`.
