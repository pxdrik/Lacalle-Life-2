# Como trabalhar neste projeto

As regras de produto e de arquitetura estão em `AGENTS.md` e não são repetidas
aqui. Este arquivo é sobre **processo**: como implementar, o que verificar
antes de dizer "pronto", e os erros que já custaram tempo.

---

## Ao terminar, sempre

1. `npm run verify` verde (typecheck, lint, testes).
2. `npm run build` passando.
3. **Commit e push.** Toda entrega termina no GitHub, sem precisar ser pedido.
   Trabalho que existe só na máquina não existe.
4. Atualizar `docs/roadmap.md` quando um item sair ou entrar. O documento
   existe para não depender da memória de nenhuma conversa — um roadmap que
   lista como pendente algo já entregue é pior que nenhum.

Mensagens de commit em português, explicando **por que**, não o que o diff já
mostra. Escreva a mensagem num arquivo e use `git commit -F` — here-strings do
PowerShell quebram com aspas.

---

## Ordem de trabalho

1. Explicar o que será feito e por quê
2. Listar os impactos
3. Implementar
4. Lint e testes
5. Corrigir
6. Revisão crítica: isso precisava existir? Existe forma mais simples? Existe
   componente duplicado? Código morto? Estado ilegal que o tipo poderia ter
   impedido?

---

## Erros que já aconteceram aqui

Cada um destes custou tempo de verdade. Estão aqui para não custarem de novo.

### Nunca criar arquivo de texto pelo PowerShell

`Set-Content -Encoding utf8` grava BOM e quebra `JSON.parse`; `Get-Content -Raw`
com replace produz mojibake em acentos. Use as ferramentas de escrita e edição
de arquivo. O PowerShell é para rodar comandos.

### Fixture de teste tem que reproduzir a realidade, não a forma conveniente

O backfill de fotos tinha teste, o teste passava, e o app quebrava inteiro no
navegador. O fixture criava a linha antiga com `media: null` — que descreve
uma linha que **já passou** pelo código novo. A linha real não tinha a chave:
`undefined`. Se um teste cobre migração ou dado legado, construa o estado
antigo do jeito que a versão antiga realmente gravava.

Corolário: **dado lido do IndexedDB não obedece ao tipo.** O tipo descreve o
que escrevemos hoje; o banco tem o que alguma versão anterior gravou.

### Feature visual se confere no navegador

Teste verde não prova que a imagem chegou na tela. Suba o servidor e olhe —
inclusive nos dois temas.

### Não escrever dado falso em arquivo curado para testar o teste

Se é preciso provar que uma checagem dispara, use fixture quebrada de
propósito, num arquivo de teste. O catálogo é dado de produção.

### Na dúvida, omitir

Vale para classificação de exercício e para casamento de foto. **Foto errada é
pior que foto nenhuma**, classificação errada é pior que campo vazio. `null`
significa "ninguém decidiu" — nunca um chute.

### `setState` com efeito colateral dentro do updater

Aconteceu duas vezes (`use-food-catalogue`, `use-diet-editor`). O updater é
puro. Leia o estado nas dependências e chame o efeito fora.

### Comentário que mente é pior que ausência de comentário

Já houve comentário afirmando que um componente ligava `aria-describedby` sem
ligar, e outro descrevendo as fotos como desenhos sobre fundo branco quando
são fotografias — o que levou a um placeholder branco berrante no dark mode.
Se o código mudar, o comentário muda junto.

---

## Ao mexer em fotos de exercício

- A licença é CC BY-SA 4.0 (Everkinetic). Toda superfície que mostra foto
  renderiza a atribuição a partir de `taxonomy/media-sources.ts`, nunca
  escrita à mão.
- Nada de imagem copiada para o repositório. Entrega por CDN.
- Pares `exercício → foto` são verificados à mão em
  `scripts/build-exercise-media.mjs`. Casamento automático **não é fonte** —
  metade das propostas estava errada.
