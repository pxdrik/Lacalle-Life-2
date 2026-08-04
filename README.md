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
| Testes | Vitest 4 + `fake-indexeddb` | O adapter real é exercitado, não substituído por mock |

## Arquitetura

### Local-first

O IndexedDB do navegador é a **única** fonte da verdade. Não há backend, conta
nem sincronização. O servidor Next entrega o shell da aplicação e nada mais —
ele nunca lê nem escreve dado de usuário.

Toda entidade nasce com `id`, `createdAt` e `updatedAt`. O `updatedAt` não tem
uso hoje: existe para que uma futura camada de sincronização tenha um
discriminador de last-write-wins sem precisar de migração ou backfill.

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
`src/core/storage/migrations.ts` é append-only: um navegador instalado pode
estar em qualquer versão anterior, e o caminho a partir dela precisa continuar
funcionando.

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

## Convenções

- Arquivos até ~250 linhas. Acima disso, refatore.
- `any` é erro de lint, não aviso.
- Código não usado é erro de lint, não aviso.
- `strict` do TypeScript mais `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes` e `erasableSyntaxOnly`.
- Estado ilegal não deve ser representável. Quando o tipo puder impedir, ele
  impede — veja `IndexQuery`.
