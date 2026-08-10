# Instruções para agentes

## Next.js

Este projeto usa Next.js 16, que tem breaking changes em relação a versões
anteriores. **Leia `node_modules/next/dist/docs/` antes de escrever código
que toque no framework.** Pontos que costumam estar desatualizados no
conhecimento de modelos:

- `next lint` foi removido. O linter roda pela CLI do ESLint (`npm run lint`),
  e `next build` não linta mais.
- Turbopack é o bundler padrão.
- `reactCompiler` e `typedRoutes` são opções de topo em `next.config.ts`, não
  mais `experimental`.

## Regras do projeto

1. **Escopo.** O produto faz três coisas: montar dieta, montar treino,
   acompanhar evolução. Se uma ideia não serve a uma delas, ela não entra.
2. **Sem IA.** Nada de chat, geração automática, prompts, embeddings ou
   provedores de LLM. Foi decisão de produto, não omissão.
3. **Sem sugerir o que comer.** Nada de refeição sugerida, plano gerado,
   "trocar esta refeição" ou substituição automática por equivalente — com ou
   sem IA. Deu dor de cabeça na V1, onde a tela dependia da sugestão para ter
   conteúdo e ficava vazia quando ela falhava. A dieta se monta à mão. O
   porquê está em `docs/roadmap.md`.
4. **Fronteira de persistência.** Componentes, hooks e services jamais importam
   `@/core/storage/*` ou `idb`. Eles usam a interface de repositório da própria
   feature. O ESLint bloqueia o contrário.
5. **`src/composition/migrations.ts` é append-only.** Nunca edite ou renumere
   uma entrada já existente.
6. **Modal ou painel inline.** Uma pergunta decide: o conteúdo atrás precisa
   continuar visível enquanto se trabalha? Se sim, inline — adicionar alimento
   tem que mostrar o item entrar e os totais se moverem. Se não, `Dialog` —
   consulta, navegação, filtro. Modal que esconde o próprio resultado precisa
   reportá-lo; é por isso que o filtro de exercícios mostra a contagem viva. O
   raciocínio completo está no comentário de `design-system/components/dialog.tsx`.
7. **Portão.** `npm run verify` precisa passar. Não avance com ele vermelho.
8. **Tamanho.** Arquivos até ~250 linhas.

O processo de trabalho — como implementar, o que verificar antes de dizer
"pronto" e os erros que já custaram tempo neste projeto — está em
`CLAUDE.md`.

## Antes de considerar uma feature pronta

Pergunte, e responda honestamente:

- Isso precisava existir?
- Existe forma mais simples?
- Existe componente duplicado?
- Existe código morto?
- Existe estado ilegal que o tipo poderia ter impedido?

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
